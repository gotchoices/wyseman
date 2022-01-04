//Manage a schema release object/file
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- 
const Fs = require('fs')
const Zlib = require('zlib')
const Path = require('path')
const Crypto = require('crypto')
const Format = require('pg-format')
const Fields = 'obj_typ, obj_nam, obj_ver, module, source, min_rel, max_rel, deps, grants, col_data, crt_sql, drp_sql'

module.exports = class {
  constructor({db, init, from, release}) {
    if (db) {		//Building from objects in database, and parsed initialization SQL
      let dbr = db.one("select wm.last(), wm.next();")
      if (release == 'last') {			//Use specified release if possible
        this.release = dbr.last || dbr.next
      } else if (release == 'next') {
        this.release = dbr.next
      } else {
        this.release = release || dbr.last || dbr.next
      }
      let dbh = db.one(`select wm.hist(${this.release});`)
//console.log("Schema:", this.release, dbh.hist)
      this.releases = dbh.hist.releases
      this.publish = this.releases[this.release - 1]
      this.prev = EncodeSql(dbh.hist.prev)
      this.objects = db.x(`select ${Fields} from wm.objects_v_depth where release = wm.next() order by depth,obj_nam`)
      this.boot = this.bootSql(db, this.release),
      this.dict = this.dictSql(db),
      this.init = init,			//Initialization comes from wmi files
      this.object = this.objectSql(db)
    }
    if (from) {		//Building from a previously generated JSON schema file
      let newHash = Crypto.createHash('sha256')
//console.log("From:", from)
      ;['boot', 'init', 'dict'].forEach (k => {		//Decode it
        newHash.update(from[k])
        this[k] = this.decode(from[k], from.compress)
      })
      this.release = from.release
      this.releases = from.releases
      this.publish = from.publish
      this.prev = from.prev
      this.objects = []
      if (from.objects) from.objects.forEach(el => {
        el.crt_sql = this.decode(el.create, from.compress)
        el.drp_sql = this.decode(el.drop, from.compress)
        newHash.update(el.create || '')
        newHash.update(el.drop || '')
        this.objects.push(el)
      })
      let digest = newHash.digest('base64')
      if (digest != from.hash) throw "Failed hash in schema: " + digest
//console.log("Hash check:", from.hash, digest)
    }
  }

// Build Sql for a self-loading schema
// -----------------------------------------------------------------------------
  loader() {
    return Loader + JSON.stringify(this.get(false,false),null,1) + LoaderEnd
  }

// Return the JSON form of the schema file
// -----------------------------------------------------------------------------
  get(compress = true, doHash = true) {
    let newHash, hash
      , boot = this.encode(this.boot, compress)
      , init = this.encode(this.init, compress)
      , dict = this.encode(this.dict, compress)
    if (doHash) {
      newHash = Crypto.createHash('sha256')
      newHash.update(boot)
      newHash.update(init)
      newHash.update(dict)
    }
    let objects = []
    this.objects.forEach(el => {
      let { obj_typ, obj_nam, obj_ver, module, source, min_rel, max_rel, deps, grants, col_data} = el
      , create = this.encode(el.crt_sql, compress)
      , drop = this.encode(el.drp_sql, compress)
      if (doHash) {
        newHash.update(create)
        newHash.update(drop)
      }
      objects.push({obj_typ, obj_nam, obj_ver, module, source, min_rel, max_rel, deps, grants, col_data, create, drop})
    })
    if (doHash) {
      hash = newHash.digest('base64')
//console.log("Hash:", hash)
    }
//console.log("Get:", this.release, this.hist)
    return {
      hash,
      release: this.release, 
      publish: this.publish, 
      compress: !!compress,
      releases: this.releases,
      boot, init, dict, objects,
      prev: this.prev
    }
  }
  
// Output straight SQL to build a database from scratch
// -----------------------------------------------------------------------------
  sql() {
    let sql = "--Bootstrap:\ncreate schema if not exists wm;" + this.boot
    sql += "\n--Schema:\n" + this.object
    sql += "\n--Data Dictionary:\n" + this.dict
    sql += (this.init == '') ? '' : ("\n--Initialization:\n" + this.init)
    return sql
  }

// From utf-8 to base64, possibly compressed
// -----------------------------------------------------------------------------
  encode (str, compress = false) {
    if (compress)
      return Zlib.deflateSync(Buffer.from(str || '', 'utf-8')).toString('base64')
    return Buffer.from(str || '', 'utf-8').toString('base64')
  }
  
// From base64, possibly compressed, back to utf-8
// -----------------------------------------------------------------------------
  decode (str, compress = false) {
    if (compress)
      return Zlib.inflateSync(Buffer.from(str || '', 'base64')).toString('utf-8')
    return Buffer.from(str || '', 'base64').toString('utf-8')
  }
  
// Build schema bootstrap SQL
// -----------------------------------------------------------------------------
  bootSql(db, release = 1) {
    let sql = ''
    Fs.readFileSync(Path.join(__dirname, '../lib/bootstrap.sql')).toString()
    .split("\n").forEach(line => {		//Strip comments and wm creation
      if (line.slice(0,2) != '--' && !line.match(/create schema .* wm;/))
        sql += line + "\n"
    })
//console.log('boot:', sql)
    return sql
  }
  
// Build data dictionary SQL
// -----------------------------------------------------------------------------
  dictSql (db) {
    let sql = ''
    ;['wm.table_text','wm.column_text','wm.value_text','wm.message_text','wm.table_style','wm.column_style','wm.column_native'].forEach(tab => {
      let flds = db.one(`select array_to_string(array(select col from wm.column_pub where obj = '${tab}' order by field),',') as flds`).flds
//console.log('tab:', tab, 'flds:', flds)
        , irows = []
        , rows = db.x(`select ${flds} from ${tab} order by 1,2,3,4,5`)
      if (rows.length > 0) {sql += `insert into ${tab} (${flds}) values\n`}
      for (let i = 0; i < rows.length; i++) {
        let row = rows[i]
          , icols = []
//console.log('row:', row)
        flds.split(',').forEach(f => {
          icols.push(Format.literal(row[f]))
//console.log(' f:', f, 'val:', row[f])
        })
//console.log(' i:', icols)
        irows.push("(" + icols.join(',') + ")")
      }
      if (irows.length > 0) {sql += "  " + irows.join(",\n  ") + ";\n"}
    })
    return sql
  }

  // Build schema creation SQL
  // -----------------------------------------------------------------------------
  objectSql(db) {
    let sql = ''
      , roles = []

    this.objects.forEach(row => {
       sql += row.crt_sql + "\n"
//console.log("gr:", Array.isArray(row.grants), row.grants)
       row.grants.forEach(rec => {				//For each grant record
//console.log("  rec:", Array.isArray(row.grants), rec)
         let [ obj_nam, mod, level, priv ] = rec.split(',')
           , [ otyp, onam ] = obj_nam.split(':')
           , perm = (mod == 'public') ? mod : mod + '_' + level
         otyp = (otyp == 'view') ? 'table' : otyp
         if (!roles.includes(perm) && perm != 'public') {
           sql += `select wm.create_role('${perm}');\n`
           roles.push(perm)
         }
         sql += `grant ${priv} on ${otyp} ${onam} to ${perm};\n`
       })
    })
    return sql
  }

}	//class

// Encode SQL create and drop fields in an object array
// -----------------------------------------------------------------------------
const EncodeSql = function (objArr) {
  return objArr.map(el => {
    let create = Buffer.from(el.crt_sql || '', 'utf-8').toString('base64')
      , drop = Buffer.from(el.drp_sql || '', 'utf-8').toString('base64')
    delete el.crt_sql
    delete el.drp_sql
    Object.assign(el, {create, drop})
    return el
  })
}
module.exports.EncodeSql = EncodeSql

// Sql code to create a self-loading schema file
// -----------------------------------------------------------------------------
const Loader = `
create schema if not exists wm;
create or replace function wm.loader(sch jsonb) returns boolean language plpgsql as $$
  declare
    retval		boolean default false;
    qstring		text;
    rec			record;
    j			jsonb;
    i			int;
    t			timestamptz;

  begin
    qstring = convert_from(decode(sch->>'boot','base64'), 'UTF8');
--raise notice 'loader: %', qstring;
    execute qstring;

    i = 1; for j in select * from jsonb_array_elements(sch->'releases') loop
--raise notice 'release: %', j;
      t = nullif(j, '0'::jsonb)::text::timestamptz;
      insert into wm.releases (release, committed) values (i, t) on conflict
        on constraint releases_pkey do update set committed = t;
      i = i + 1;
    end loop;

--    for j in select jsonb_array_elements(sch->'prev') loop
--      insert into wm.objects (obj_typ,obj_nam,obj_ver,module,source,min_rel,max_rel,deps,col_data,grants,crt_sql,drp_sql)
--        values (j->>'obj_typ', j->>'obj_nam', (j->'obj_ver')::int, j->>'module', j->>'source', 
--          (j->'min_rel')::int, least((j->'max_rel')::int, i-1),
--          (select coalesce(array_agg(d),'{}') from jsonb_array_elements_text(j->'deps') as d),
--          (select coalesce(array_agg(d),'{}') from jsonb_array_elements_text(j->'col_data') as d),
--          (select coalesce(array_agg(d),'{}') from jsonb_array_elements_text(j->'grants') as d),
--          convert_from(decode(j->>'create','base64'), 'UTF8'),
--          convert_from(decode(j->>'drop','base64'), 'UTF8')
--        );
--    end loop;

    for j in select jsonb_array_elements(sch->'prev') union
             select jsonb_array_elements(sch->'objects') loop
      insert into wm.objects (obj_typ,obj_nam,obj_ver,module,source,min_rel,max_rel,deps,col_data,grants,crt_sql,drp_sql)
        values (j->>'obj_typ', j->>'obj_nam', (j->'obj_ver')::int, j->>'module', j->>'source',
          (j->'min_rel')::int, least((j->'max_rel')::int, i-1),
          (select coalesce(array_agg(d),'{}') from jsonb_array_elements_text(j->'deps') as d),
          (select coalesce(array_agg(d),'{}') from jsonb_array_elements_text(j->'col_data') as d),
          (select coalesce(array_agg(d),'{}') from jsonb_array_elements_text(j->'grants') as d),
          convert_from(decode(j->>'create','base64'), 'UTF8'),
          convert_from(decode(j->>'drop','base64'), 'UTF8')
        );
--raise notice 'object: % % %: %', j->'obj_typ', j->'obj_nam', j->'obj_ver', j->'deps';
    end loop;
    perform case when wm.check_drafts(true) then wm.check_deps() end;
return retval;
    perform wm.make(null, false, true);
    
    qstring = convert_from(decode(sch->>'dict','base64'), 'UTF8');
    execute qstring;

    qstring = convert_from(decode(sch->>'init','base64'), 'UTF8');
    execute qstring;

    return retval;
  end;
$$;
select wm.loader($schema$`

const LoaderEnd = "\n$schema$);drop function wm.loader(jsonb);"

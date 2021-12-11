//Manage a schema release object/file
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- 
const Fs = require('fs')
const Zlib = require('zlib')
const Path = require('path')
const Format = require('pg-format')
const Fields = 'obj_typ, obj_nam, obj_ver, module, source, deps, grants, col_data, crt_sql, drp_sql'

module.exports = class {
  constructor(db, initSql) {
    this.objects =
      db.x(`select ${Fields} from wm.objects_v_depth where release = wm.release() order by depth,obj_nam`)

    this.schema = {hash: null}
    this.release = db.one("select wm.release();").release
    this.publish = new Date().toISOString(),
    this.boot = this.bootSql(db, this.schema.release),
    this.init = initSql,
    this.dict = this.dictSql(db),
    this.object = this.objectSql(db)
    this.hash = 1234
  }

  get() {return {
    hash: this.hash,
    release: this.release, 
    publish: this.publish, 
    boot: this.compress(this.boot), 
    init: this.compress(this.init), 
    dict: this.compress(this.dict), 
    objects: this.objects.map(obj => {
      let { obj_typ, obj_nam, obj_ver, module, source, deps, grants, col_data } = obj
      return({obj_typ, obj_nam, obj_ver, module, source, deps, grants, col_data,
        create: this.compress(obj.crt_sql),
        drop: this.compress(obj.drp_sql),
      })
    })
  }}
  
// Output straight SQL to build a database from scratch
// -----------------------------------------------------------------------------
  sql() {
    let sql = "--Bootstrap:\n" + this.boot
    sql += "\n--Schema:\n" + this.object
    sql += "\n--Data Dictionary:\n" + this.dict
    sql += (this.init == '') ? '' : ("\n--Initialization:\n" + this.init)
    return sql
  }

  compress (str) {
    return Zlib.deflateSync(Buffer.from(str)).toString('base64')
  }
  
// Build schema bootstrap SQL
// -----------------------------------------------------------------------------
  bootSql(db, release = 1) {
    let sql = Fs.readFileSync(Path.join(__dirname, '../lib/boot.sql')).toString()

    sql += `create or replace function wm.release() returns int stable language sql as $$
  select ${release};\n$$;\n`
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

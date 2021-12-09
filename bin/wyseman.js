#!/usr/bin/env node
//Command line interface for managing a schema in wyseman, implemented in node.js
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//X- Port to node
//- Specify file with -s switch
//- Split sql schema component functions
//- Still outputs the same
//- Write new schema file format
//- Switch to output old format (mostly for debugging schema)
//- Switch to list dependency report?
//- Option to check dependencies against DB's opinion (if it has one)?
//- 
//- Try building schema on blank database
//- Make regression tests run properly
//- Why does tty blank out when node process dies in the middle
//- Implement schema versioning
//- 
//- Old ruby-based TODOs:
//- How to input/update table migration scripts (such as changing column names, adding or deleting columns)
//- Manage releases:
//-   Test: versions > 1 function correctly
//-   Move SQL output code to a separate module?
//X-   Generate a version function when SQL build code is generated
//-   Can generate SQL for any past version still in the database
//-   Can generate sql to upgrade existing database to a specified release specification
//-   Can dump wm.objects and restore it to a different site for version management there
//- "Make objects" on a DB built from pre-packaged schema fails the first time (but then works)
//- 

const DbClient = require('../lib/dbclient.js')
const DbSync = require('../lib/dbsync.js')
const Parser = require('../lib/parser.js')
const Format = require('pg-format')
const Path = require('path')
const Fs = require('fs')
const Pg = require('pg-native')
const Env = process.env

var opts = require('yargs')
  .alias('?', 'help')	.default('help', false, 'Show help message')	//{STDERR.puts opts; exit}
  .alias('n', 'dbname')	.default('dbname',	Env.WYSEMAN_DB,			'Specify the database name explicitly (rather than defaulting to the username)')
  .alias('h', 'host')	.default('host',	Env.WYSEMAN_HOST || 'localhost','Specify the database host name explicitly (rather than defaulting to the local system)')
  .alias('P', 'port')	.default('port',	Env.WYSEMAN_PORT || 5432,	'Specify the database port explicitly (rather than defaulting to 5432)')
  .alias('u', 'user')	.default('user',	Env.WYSEMAN_USER || 'admin',	'Specify the database user name explicitly (rather than defaulting to the username)')
  .alias('b', 'branch')	.default('branch',	'',				'Include the specified object and all others that depend on it')
  .alias('r', 'replace').boolean('replace').default('replace',	false,	'Replace views/functions where possible')
  .alias('m', 'make')	.boolean('make').default('make',	true,	'Build any uninstantiated objects in the database')
  .alias('p', 'prune')	.boolean('make').default('prune',	true,	'Remove any objects no longer in the source file(s)')
  .alias('d', 'drop')	.boolean('drop').default('drop',	true,	'Attempt to drop objects before creating')
  .alias('z', 'post')	.boolean('post').default('post',	true,	'Run the post-parse cleanup scans (default behavior)')
  .alias('i', 'init')	.boolean('init').default('init',	false,	'Write initialization SQL to stdout (as opposed to executing it in the DB)')
  .alias('q', 'quiet')	.boolean('quiet').default('quiet',	false,	'Suppress printing of database notices')
  .alias('s', 'sql')
  .argv
var argv = opts._
//console.log("opts:", opts, "argv:", argv)			//Debug

// Main
// -----------------------------------------------------------------------------
var dbc = new DbClient({			//Will connect using standard lib first
  host: opts.host, 				//It builds DB if not present
  database: opts.dbname, 
  user: opts.user,
})
dbc.connect(() => {
  let initSql = ''
    , db = new DbSync(opts)			//Now connect synchronously
    , branchVal = 'null'
    , wm = new Parser(db)			//Initialize the schema parser
  
  if (argv.length > 0) {			//If there are files to process
    for (let file of argv) {
      let sql = wm.parse(file)			//Accumulate sql commands for later
      initSql += sql
    }
  }	//parse files

//console.log('prune:', opts.prune, 'post:', opts.post)
  if (opts.post) wm.check(opts.prune)		//And do post-cleanup

//console.log('Make:', opts.make, 'Drop:', opts.drop)

    //Instantiate specified, or default objects in the database, with optional pre-drop
  if (opts.make) {				//Are branches specified
    let branchVal = (opts.branch == '') ? null : "'{" + opts.branch.trim().split(' ').join(',') + "}'"
      , res = db.one(`select wm.make(${branchVal},${opts.drop},true);`)	//Make specified objects
//console.log("make:", res)
    if (parseInt(res.make) > 0) {
      db.x("select wm.init_dictionary();")		//Re-initialize dictionary
    }
  }		//make

  if (opts.init && initSql != '') {
    console.error("Running Initialization SQL")
    db.x(initSql)
  }
  
console.log("s:", opts.s, !!opts.s, opts.s == true)
  if (!!opts.s) {					//Got some form of -s switch
    let outStream = process.stdout
    
    if (opts.s != true) {				//Looks like output file specified
console.log("outFile:", opts.s)
      outStream = Fs.createWriteStream(opts.s)
    }

    if (opts.sql) {					//Generate schema creation SQL on stdout
      console.log(bootSql(db))
      console.log(schemaSql(db))
      console.log(dictSql(db))
    }
    
    if (initSql != '') {
      console.log("--Initialization SQL:")
      console.log(initSql)			//See initialization code on stdout
    }
  }		//opts.s

  dbc.disconnect()				//Disconnect async connection
  process.exit(0);				//Die nicely (and reset the tty)
})

// Build schema bootstrap SQL
// -----------------------------------------------------------------------------
var bootSql = function (db) {
  let sql = "--Schema Bootstrap:\n"
    , version = db.one("select wm.release();").release
  
  sql += Fs.readFileSync(Path.join(__dirname, '../lib/boot.sql')).toString()

  sql += `create or replace function wm.release() returns int stable language sql as $$
  select ${version};\n$$;\n`
  return sql
}
  
// Build schema creation SQL
// -----------------------------------------------------------------------------
var schemaSql = function (db) {
  let sql = ''
    , roles = []
  db.x("select obj_nam,crt_sql,grants from wm.objects_v_depth where release = wm.release() order by depth,obj_nam").forEach(row => {
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

// Build data dictionary SQL
// -----------------------------------------------------------------------------
var dictSql = function (db) {
  let sql = "\n--Data Dictionary:\n"
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
    if (irows.length > 0) {sql += "  " + irows.join(",\n  ") + ";\n\n"}
  })

  return sql
}

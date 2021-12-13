#!/usr/bin/env node
//Command line interface for managing a schema in wyseman, implemented in node.js
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//X- Switch to generate dependency report?
//X- Output correct version
//X- Try building new schema format on blank database
//X- Generate real schema hash?
//- Why does tty blank out when node process dies in the middle (node bug?)
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
const Schema = require('../lib/schema.js')
const Path = require('path')
const Fs = require('fs')
const Pg = require('pg-native')
const Env = process.env
const file = Path.resolve('.', 'Wyseman.conf')

var config = {}
if (Fs.existsSync(file)) config = require(file)		//;console.log("config:", config)

var opts = require('yargs')
  .alias('?', 'help')	.default('help', false, 'Show help message')	//{STDERR.puts opts; exit}
  .alias('n', 'dbname')	.default('dbname',	config.dbname || Env.WYSEMAN_DB,			'Specify the database name explicitly (rather than defaulting to the username)')
  .alias('h', 'host')	.default('host',	config.host || Env.WYSEMAN_HOST || 'localhost','Specify the database host name explicitly (rather than defaulting to the local system)')
  .alias('P', 'port')	.default('port',	config.port || Env.WYSEMAN_PORT || 5432,	'Specify the database port explicitly (rather than defaulting to 5432)')
  .alias('u', 'user')	.default('user',	config.user || Env.WYSEMAN_USER || 'admin',	'Specify the database user name explicitly (rather than defaulting to the username)')
  .alias('b', 'branch')	.default('branch',	'',			'Include the specified object and all others that depend on it')
  .alias('S', 'schema')	.default('schema',	null,			'Create a schema file with the specified filename')
  .alias('r', 'replace').boolean('replace').default('replace',	false,	'Replace views/functions where possible')
  .alias('m', 'make')	.boolean('make').default('make',	true,	'Build any uninstantiated objects in the database')
  .alias('p', 'prune')	.boolean('make').default('prune',	true,	'Remove any objects no longer in the source file(s)')
  .alias('d', 'drop')	.boolean('drop').default('drop',	true,	'Attempt to drop objects before creating')
  .alias('z', 'post')	.boolean('post').default('post',	true,	'Run the post-parse cleanup scans (default behavior)')
  .alias('q', 'quiet')	.boolean('quiet').default('quiet',	false,	'Suppress printing of database notices')
  .alias('l', 'list')	.boolean('list').default('list',	false,	'List DB objects and their dependencies')
  .alias('s', 'sql')	.boolean('sql').default('sql',		false,	'Output SQL to create a database')
  .argv
var argv = opts._				//;console.log("opts:", opts, "argv:", argv)

var sourceFiles = []
argv.forEach(arg => {				//Gather source filenames
  if (arg in config) sourceFiles.push(...config[arg]); else sourceFiles.push(arg)
})						//;console.log("Files:", sourceFiles)

// Main
// -----------------------------------------------------------------------------
var dbc = new DbClient({			//Will connect using standard lib first
  host: opts.host, 				//It builds DB if not present
  database: opts.dbname || opts.user,
  user: opts.user,
  schema: Path.join(__dirname, '../lib', 'bootstrap.sql')
})
dbc.connect(() => {
  let initSql = ''
    , db = new DbSync(opts)			//Now connect synchronously
    , branchVal = 'null'
    , wm = new Parser(db)			//Initialize the schema parser

  if (opts.list) {
    let deplist = db.x("select depth,object,deps from wm.objects_v_depth order by depth,deps")
    console.log("Objects:", JSON.stringify(deplist, null, 2))
  }

  for (let file of sourceFiles) {		//parse source files
    let sql = wm.parse(file)			//Accumulate sql commands for later
    initSql += sql
  }

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

  if (initSql != '') {
    console.error("Running Initialization SQL")
    db.x(initSql)
  }
  
//console.log("s:", opts.s, !!opts.s, opts.s == true)
  var output = process.stdout
  if (opts.sql || opts.schema) {			//Got some form of -s switch
    let schema = new Schema({db, init: initSql})

    if (opts.sql) {					//Show debug output
      output.write(schema.sql())

    } else if (opts.schema) {  				//Output file specified
      if (opts.schema != '-')
        output = Fs.createWriteStream(Path.normalize(opts.schema))
      output.write(JSON.stringify(schema.get(), null, 1))
    }
  }
  output.on('finish', () => {
    dbc.disconnect()				//Disconnect async connection
    process.exit(0);				//Die nicely (and reset the tty)
  })
  output.end()
})	//connect

#!/usr/bin/env node
//Command line interface for managing a schema in wyseman, implemented in node.js
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- Why does tty blank out when node process dies in the middle (node bug?)
//- 
const DbClient = require('../lib/dbclient')
const DbSync = require('../lib/dbsync')
const Parser = require('../lib/parser')
const Schema = require('../lib/schema')
const Migrate = require('../lib/migrate')
const History = require('../lib/history')
const Path = require('path')
const Fs = require('fs')
const Pg = require('pg-native')
const Env = process.env
const ConFile = Path.resolve('.', 'Wyseman.conf')
var config = {}
if (Fs.existsSync(ConFile)) config = require(ConFile)		//;console.log("config:", config)
const SchemaDir = config.dir || Path.resolve('.')

var opts = require('yargs')
  .alias('?', 'help')	.default('help', false, 'Show help message')	//{STDERR.puts opts; exit}
  .alias('n', 'dbname')	.default('dbname',	config.dbname || Env.WYSEMAN_DB,			'Specify the database name explicitly (rather than defaulting to the username)')
  .alias('h', 'host')	.default('host',	config.host || Env.WYSEMAN_HOST || 'localhost','Specify the database host name explicitly (rather than defaulting to the local system)')
  .alias('P', 'port')	.default('port',	config.port || Env.WYSEMAN_PORT || 5432,	'Specify the database port explicitly (rather than defaulting to 5432)')
  .alias('u', 'user')	.default('user',	config.user || Env.WYSEMAN_USER || 'admin',	'Specify the database user name explicitly (rather than defaulting to the username)')
  .alias('b', 'branch')	.default('branch',	'',		'Include the specified object and all others that depend on it')
  .alias('S', 'schema')	.default('schema',	null,		'Create a schema file with the specified filename')
  .alias('g', 'migrate').default('migrate',	null,		'Enter a schema migration command')
  .alias('R', 'release').default('release',	'last',		'Specify the release number of the schema file to generate')
  .alias('C', 'commit')	.boolean('commit').default('commit',	false,	'Commit official schema release in the default directory')
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
    , hist = new History(db, SchemaDir, config.module)	//Manages past schema ojects
    , mig = new Migrate(db, SchemaDir)			//Migration handler
    , parse = new Parser(db)				//Schema parser
    , output = process.stdout
    , schema, modified

  if (opts.list) {
    let deplist = db.x("select depth,object,deps from wm.objects_v_depth order by depth,deps")
    console.log("Objects:", JSON.stringify(deplist, null, 2))
  }

  if (opts.g) {					//Process new schema migration commands
    ;[].concat(opts.g).forEach(g => mig.process(g))
  }

//console.log('Files:', sourceFiles)
  for (let file of sourceFiles) {		//parse source files
    let sql = parse.parse(file)			//Accumulate sql commands for later
    initSql += sql
  }

//console.log('prune:', opts.prune, 'post:', opts.post)
  if (opts.post) parse.check(opts.prune)	//And do post-cleanup

    //Instantiate specified, or default objects in the database, with optional pre-drop
//console.log('Make:', opts.make, 'Drop:', opts.drop)
  if (opts.post && opts.make) {
    let modules = parse.module()
      , modDirs = Object.values(modules)
    mig.updateDB(modDirs, opts.commit)		//Process any delta files

    let branchVal = (opts.branch == '') ? null : "'{" + opts.branch.trim().split(' ').join(',') + "}'"
      , res = db.one(`select wm.make(${branchVal},${opts.drop},true);`)	//Make specified objects
    modified = res.make
//console.log("make:", res)
    if (parseInt(modified) > 0) {
      db.x("select wm.init_dictionary();")	//Re-initialize dictionary
    }
  }		//make

  if (initSql != '') {
    console.error("Running Initialization SQL")
    db.x(initSql)
  }

  if (opts.commit || opts.sql || opts.schema)	//If we will need a schema object
    schema = new Schema({db, init: initSql, release:opts.release, history:hist})
  
  if (modified || opts.commit)
    hist.promote(opts.commit ? schema : null)
  if (opts.commit) mig.clear()
  
//console.log("s:", opts.s, !!opts.s, opts.s == true)
  if (opts.sql) {				//Show debug output
    output.write(schema.sql())

  } else if (opts.schema) {	  		//Output file specified
    if (opts.schema != '-')
      output = Fs.createWriteStream(Path.normalize(opts.schema))
    output.write(JSON.stringify(schema.get(), null, 1))
  }
  output.on('finish', () => {
    dbc.disconnect()				//Disconnect async connection
    process.exit(0);				//Die nicely (and reset the tty)
  })
  output.end()
})	//connect

//Build test database schema; Run first
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
// TODO
//- Enable logging in wyseman (not stdout) so we can watch it during test runs
//- 
const assert = require("assert");
const Fs = require('fs')
const Path = require('path')
const Child = require('child_process')
const { TestDB, DBHost, DBPort, DBAdmin, Log, DbClient, SchemaDir, SchemaFile, timeLong } = require('./settings')
var log = Log('test-schema')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true, log, host: DBHost, port: DBPort}
var release = '1b'
var sqlSchema = SchemaFile(release, '.sql')
var jsonSchema = SchemaFile(release)
var interTest = {}

describe("Schema: Build DB schema files", function() {
  this.timeout(timeLong)
  var db

  before('Delete old history/migration files', function(done) {
    Fs.rm(Path.join(SchemaDir, 'Wyseman.hist'), {force:true}, () => {})
    Fs.rm(Path.join(SchemaDir, 'Wyseman.delta'), {force:true}, done)
  })

  before('Delete sample database if it exists', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} -h ${DBHost} -p ${DBPort} ${TestDB}`, (err, out) => done())
  })

  before('Build schema database', function(done) {
    Child.exec("wyseman", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  before('Connect to schema database', function(done) {
    db = new DbClient(dbConfig, ()=>{}, ()=>{
      log.debug("Connected to DB");
      done()
    })
  })

  it('should have 9 wyseman tables built', function(done) {
    let sql = "select * from pg_tables where schemaname = 'wm'"
    db.query(sql, null, (e, res) => {if (e) done(e)
log.debug("Tables:", res.rows)
      assert.equal(res.rows.length, 9)
      done()
    })
  })

  it('should build objects', function(done) {
    Child.exec("wyseman objects test1.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('check for number of wyselib tables built', function(done) {
    let sql = "select * from pg_tables where schemaname = 'base'"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 17)
      done()
    })
  })

  it('should build text descriptions', function(done) {
    Child.exec("wyseman text test1.wmt", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('should have 4 wyseman column text descriptions', function(done) {
    let sql = "select * from wm.column_text where ct_sch = 'wmtest'"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 4)
      done()
    })
  })

  it('should build defaults', function(done) {
    Child.exec("wyseman defs test1.wmd", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('should have 4 wyseman column defaults', function(done) {
    let sql = "select * from wm.column_def where obj = 'wmtest.items'"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 4)
      done()
    })
  })

  it('should initialize data', function(done) {
    Child.exec("wyseman init test1.wmi", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('should have 7 rows in wmtest.items', function(done) {
    let sql = "select * from wmtest.items"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 7)
      done()
    })
  })

  it('schema release should be 1', function(done) {
    let sql = "select count(*), wm.next() from wm.releases"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.count, 1)
      assert.equal(row.next, 1)
      done()
    })
  })

  it('should build an SQL schema file', function(done) {
    Child.exec("wyseman init test1.wmi -s", {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let begin = o.slice(0, 12)
log.debug("schema:", begin)
      assert.equal(begin, '--Bootstrap:')
      Fs.writeFileSync(sqlSchema, o)
      done()
    })
  })

  it('should build a JSON schema file with expected objects', function(done) {
    Child.exec("wyseman init test1.wmi -S " + jsonSchema, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(jsonSchema).toString()
        , sch = JSON.parse(content)
      assert.ok(sch.publish != null)
log.debug("Schema objects:", sch.objects.length)
      assert.equal(sch.objects.length, 199)
      done()
    })
  })

  after('Disconnect from test database', function(done) {
    db.disconnect()
    done()
  })

  after('Delete sample database', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} -h ${DBHost} -p ${DBPort} ${TestDB}`, (err, so) => {
      if (err) done(err)
      done()
    })
  })
})

describe("Schema: Build DB with canned SQL schema", function() {
  var db

  it('Connect to and create database from sql schema', function(done) {
    let config = Object.assign(dbConfig, {schema: sqlSchema})
    db = new DbClient(config, (chan, data)=>{}, ()=>{
      log.debug("Connected to schema DB"); 
      done()
    })
  })

  it('wm.objects exists but with no items', function(done) {
    let sql = "select count(*), wm.next() from wm.objects"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.count, 0)
      assert.equal(row.next, 1)
      done()
    })
  })

  it('counting rows in wm.column_data', function(done) {
    let sql = "select count(*) from wm.column_data where cdt_sch in ('wm','wylib') and field >= 0"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert(row.count > 0)			;log.debug('cd:', row.count)
      interTest.rowCount = row.count
      done()
    })
  })

  it('comparing rows in wm.column_lang', function(done) {
    let sql = "select count(*) from wm.column_lang where sch in ('wm','wylib') and language = 'eng'"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.count, interTest.rowCount)
      done()
    })
  })
/* */
  after('Disconnect from test database', function(done) {
    db.disconnect()
    done()
  })

})

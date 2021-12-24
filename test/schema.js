//Build test database schema
//TODO:
//- Can delete DB and build again from flat files with history properly created
//- Can create schema files for any release?
//- 
const assert = require("assert");
const { TestDB, DBAdmin } = require('./settings')
const Fs = require('fs')
const Path = require('path')
const Log = require(require.resolve('wyclif/lib/log.js'))
const DbClient = require("../lib/dbclient.js")
const Child = require('child_process')
const SchemaDir = Path.resolve(Path.join(__dirname, 'schema'))
var log = Log('test-schema')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true}
const SqlSchema = Path.join(SchemaDir, 'schema.sql')
const JsonSchema = Path.join(SchemaDir, 'schema.json')
const ExpectItems = 175

describe("Build DB schema", function() {
  var db

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
    Child.exec("wyseman objects test.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('should have 13 wyselib tables built', function(done) {
    let sql = "select * from pg_tables where schemaname = 'base'"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 13)
      done()
    })
  })

  it('should build text descriptions', function(done) {
    Child.exec("wyseman text test.wmt", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('should have 4 wyseman column text descriptions', function(done) {
    let sql = "select * from wm.column_text where ct_sch = 'wyseman'"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 4)
      done()
    })
  })

  it('should build defaults', function(done) {
    Child.exec("wyseman defs test.wmd", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('should have 4 wyseman column defaults', function(done) {
    let sql = "select * from wm.column_def where obj = 'wyseman.items'"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 4)
      done()
    })
  })

  it('should initialize data', function(done) {
    Child.exec("wyseman init test.wmi", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('should have 7 rows in wyseman.items', function(done) {
    let sql = "select * from wyseman.items"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 7)
      done()
    })
  })

  it('should build an SQL schema file', function(done) {
    Child.exec("wyseman init test.wmi -s", {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let begin = o.slice(0, 12)
log.debug("schema:", begin)
      assert.equal(begin, '--Bootstrap:')
      Fs.writeFileSync(SqlSchema, o)
      done()
    })
  })

  it('should build a JSON schema file with objects', function(done) {
    Child.exec("wyseman init test.wmi -S " + JsonSchema, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(JsonSchema).toString()
        , sch = JSON.parse(content)
      assert.ok(sch.publish)
log.debug("Schema objects:", sch.objects.length)
      assert.equal(sch.objects.length, ExpectItems)
      done()
    })
  })

  it('schema version should be 1', function(done) {
    let sql = "select count(*), wm.next() from wm.releases"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.count, 1)
      assert.equal(row.next, 1)
      done()
    })
  })

  after('Disconnect from test database', function(done) {
    db.disconnect()
    done()
  })

  after('Delete sample database', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, (err, so) => {
      if (err) done(err)
      done()
    })
  })
});

describe("Build DB with canned SQL schema", function() {
  var db

  it('Connect to and create database from sql schema', function(done) {
    let config = Object.assign(dbConfig, {schema: SqlSchema})
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

  after('Disconnect from test database', function(done) {
    db.disconnect()
    done()
  })

  after('Delete sample database', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, (err, so) => {
      if (err) done(err)
      done()
    })
  })
});

describe("Build/modify DB with canned JSON schema", function() {
  var db

  it('Connect to and create database from JSON schema', function(done) {
    let config = Object.assign(dbConfig, {schema: JsonSchema})
    db = new DbClient(config, (chan, data)=>{}, ()=>{
      log.debug("Connected to schema DB"); 
      done()
    })
  })

  it('wm.objects exists and has items', function(done) {
    let sql = "select count(*), wm.next() from wm.objects"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
log.debug("Schema objects:", row.count)
      assert.equal(row.count, ExpectItems)
      assert.equal(row.next, 1)
      done()
    })
  })

  it('have valid Wyseman.hist file', function() {
    let content = Fs.readFileSync(Path.join(SchemaDir, 'Wyseman.hist')).toString()
      , hist = JSON.parse(content)
log.debug("History object:", hist.releases, hist.history)
    assert.equal(typeof hist, 'object')
    assert.equal(hist.module, 'wyseman')
    assert.equal(hist.releases.length, 1)
    assert.equal(hist.history.length, 0)
  })

  it('no migrations in Wyseman.delta file', function(done) {
    Fs.readFile(Path.join(SchemaDir, 'Wyseman.delta'), (err, dat) => {
      if (err) {			//No delta file
        assert.equal(err.code, 'ENOENT')
      } else {				//Or an empty one
        let deltas = JSON.parse(dat)
        assert.equal(Object.keys(deltas).length, 0)
      }
      done()
    })
  })

  it('can commit release 1', function(done) {
    Child.exec("wyseman -C", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('correct next release value', function(done) {
    db.query("select wm.next()", null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.next, 2)
      done()
    })
  })

  it('enter delta rename command', function(done) {
    let delta = '"wyseman.items rename comment descr"'
    Child.exec("wyseman -g " + delta, {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('have valid Wyseman.delta file now', function() {
    let content = Fs.readFileSync(Path.join(SchemaDir, 'Wyseman.delta')).toString()
      , deltas = JSON.parse(content)
      , darr = deltas['wyseman.items']
log.debug("Delta object:", darr)
    assert.equal(typeof darr, 'object')
    assert.equal(darr.length, 1)
    assert.equal(darr[0].oper, 'rename')
  })

  it('build items table with new column name', function(done) {
    Child.exec("wyseman objects test1.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('can commit release 2', function(done) {
    Child.exec("wyseman -C", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('enter delta drop command', function(done) {
    let delta = '"wyseman.items drop descr"'
    Child.exec("wyseman -g " + delta, {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('build items table after dropped column', function(done) {
    Child.exec("wyseman objects test2.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('can commit release 3', function(done) {
    Child.exec("wyseman -C", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('have empty Wyseman.delta file now', function() {
    let content = Fs.readFileSync(Path.join(SchemaDir, 'Wyseman.delta')).toString()
      , deltas = JSON.parse(content)
    assert.equal(Object.keys(deltas), 0)
  })

  it('build items table after added column w/ no delta', function(done) {
    Child.exec("wyseman objects test3.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('can commit release 4', function(done) {
    Child.exec("wyseman -C", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('correct delta and next release value', function(done) {
    let sql = "select delta, wm.next() from wm.objects_v where obj_nam = 'wyseman.items' and release = 4"
    db.query("select wm.next()", null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.next, 5)
log.debug("delta:", row.delta, typeof row.delta)
      assert.ok(!row.delta)
      done()
    })
  })

  after('Disconnect from test database', function() {
    db.disconnect()
  })

  after('Delete history, delta files', function() {
    Fs.rmSync(Path.join(SchemaDir, 'Wyseman.delta'))
    Fs.rmSync(Path.join(SchemaDir, 'Wyseman.hist'))
  })

  after('Delete sample database', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, (err, so) => {
      if (err) done(err)
      done()
    })
  })

});

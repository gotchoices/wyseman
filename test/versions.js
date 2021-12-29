//Build test database schema
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
const assert = require("assert");
const Fs = require('fs')
const Path = require('path')
const Child = require('child_process')
const { TestDB, DBAdmin, Log, DbClient, SchemaDir, SchemaFile, WmItems } = require('./settings')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true}
var log = Log('test-schema')

describe("Build/modify DB with canned JSON schema", function() {
  var db

  it('Connect to and create database from JSON schema', function(done) {
    let config = Object.assign(dbConfig, {schema: SchemaFile('1b')})
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
      assert.equal(row.count, WmItems)
      assert.equal(row.next, 1)
      done()
    })
  })

  it('have valid Wyseman.hist file', function() {
    let content = Fs.readFileSync(Path.join(SchemaDir, 'Wyseman.hist')).toString()
      , hist = JSON.parse(content)
log.debug("History object:", hist.releases, hist.past)
    assert.equal(typeof hist, 'object')
    assert.equal(hist.module, 'wyseman')
    assert.equal(hist.releases.length, 1)
    assert.equal(hist.past.length, 0)
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

  it('can build a JSON official release schema file', function(done) {
    let sFile = SchemaFile(1)
    Child.exec("wyseman -R 1 -S " + sFile, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(sFile).toString()
        , sch = JSON.parse(content)
log.debug("Schema:", sch.past.length)
      assert.ok(sch.publish)
      assert.equal(sch.release, 1)
      assert.equal(sch.releases.length, 1)
      assert.equal(sch.past.length, 0)		//no historical objects yet
      done()
    })
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

  it('can build release 2 schema file', function(done) {
    let sFile = SchemaFile(2)
    Child.exec("wyseman -R 2 -S " + sFile, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(sFile).toString()
        , sch = JSON.parse(content)
log.debug("Schema:", sch.past.length)
      assert.ok(sch.publish)
      assert.equal(sch.release, 2)
      assert.equal(sch.releases.length, 2)
      assert.equal(sch.past.length, 1)		//one historical objects yet
      done()
    })
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
  
  it('can build release 3 schema file', function(done) {
    let sFile = SchemaFile(3)
    Child.exec("wyseman -R 3 -S " + sFile, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(sFile).toString()
        , sch = JSON.parse(content)
log.debug("Schema:", sch.past.length)
      assert.ok(sch.publish)
      assert.equal(sch.release, 3)
      assert.equal(sch.releases.length, 3)
      assert.equal(sch.past.length, 2)		//one historical objects yet
      done()
    })
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

  it('can build release 4 schema file', function(done) {
    let sFile = SchemaFile(4)
    Child.exec("wyseman -R 4 -S " + sFile, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(sFile).toString()
        , sch = JSON.parse(content)
log.debug("Schema:", sch.past.length)
      assert.ok(sch.publish)
      assert.equal(sch.release, 4)
      assert.equal(sch.releases.length, 4)
      assert.equal(sch.past.length, 3)		//one historical objects yet
      done()
    })
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

//  after('Delete history, delta files', function() {
//    Fs.rmSync(Path.join(SchemaDir, 'Wyseman.delta'))
//    Fs.rmSync(Path.join(SchemaDir, 'Wyseman.hist'))
//  })
/*
  after('Delete sample database', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, (err, so) => {
      if (err) done(err)
      done()
    })
  })
*/
});

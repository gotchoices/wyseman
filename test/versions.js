//Build test database schema; run after schema.js
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
const assert = require("assert");
const Fs = require('fs')
const Path = require('path')
const Child = require('child_process')
const { TestDB, DBAdmin, Log, DbClient, SchemaDir, SchemaFile } = require('./settings')
var log = Log('test-schema')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true, log}

describe("Versions: Build/modify DB with canned JSON schema", function() {
  var db

  before('Delete sample database', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, done)
  })

  it('Connect to and create database from JSON schema', function(done) {
    let config = Object.assign(dbConfig, {schema: SchemaFile('1b')})
    db = new DbClient(config, (chan, data)=>{}, ()=>{
      log.debug("Connected to schema DB"); 
      done()
    })
  })

  it('can build development objects', function(done) {
    let files = ['run_time.wms','develop.wms','run_time.wmt','develop.wmt'].map(f => 
      Path.join(__dirname, '../lib', f)
    )
log.debug('cmd:', `wyseman ${files}`)
    Child.exec(`wyseman ${files.join(' ')}`, {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('wm.objects exists and has items', function(done) {
    let sql = "select count(*), wm.next() from wm.objects"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
log.debug("Schema objects:", row.count)
      assert.equal(row.count, 204)
      assert.equal(row.next, 1)
      done()
    })
  })

  it('have valid Wyseman.hist file', function() {
    let content = Fs.readFileSync(Path.join(SchemaDir, 'Wyseman.hist')).toString()
      , hist = JSON.parse(content)
log.debug("History object:", hist.releases, hist.prev)
    assert.equal(typeof hist, 'object')
    assert.equal(hist.module, 'wmtest')
    assert.equal(hist.releases.length, 1)
    assert.equal(hist.prev.length, 0)
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
    Child.exec("wyseman init test1.wmi -C", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('can build a JSON official release schema file', function(done) {
    let sFile = SchemaFile(1)
    Child.exec("wyseman -R last -S " + sFile, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(sFile).toString()
        , sch = JSON.parse(content)
log.debug("Schema:", sch.prev.length)
      assert.ok(sch.publish)
      assert.equal(sch.release, 1)
      assert.equal(sch.releases.length, 1)
      assert.equal(sch.prev.length, 0)		//no historical objects yet
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
    let delta = '"wmtest.items rename comment to descr"'
    Child.exec("wyseman -g " + delta, {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('have valid Wyseman.delta file now', function() {
    let content = Fs.readFileSync(Path.join(SchemaDir, 'Wyseman.delta')).toString()
      , deltas = JSON.parse(content)
      , darr = deltas['wmtest.items']
log.debug("Delta object:", darr)
    assert.equal(typeof darr, 'object')
    assert.equal(darr.length, 1)
    assert.equal(darr[0], 'rename comment to descr')
  })

  it('build items table with new column name', function(done) {
    Child.exec("wyseman objects test2.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })
/* */
  after('Disconnect from test database', function() {
    db.disconnect()
  })

})

describe("Versions: Recover/rebuild DB with existing deltas", function() {
  var db

  before('Delete sample database', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, done)
  })

  it('Connect to and create database from schema-1', function(done) {
    let config = Object.assign(dbConfig, {schema: SchemaFile('1')})
    db = new DbClient(config, (chan, data)=>{}, done)
  })

  it('rebuild items table with new column name', function(done) {
    Child.exec("wyseman objects test2.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('can commit release 2', function(done) {
    Child.exec("wyseman init test2.wmi -C", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('can build release 2 schema file', function(done) {
    let sFile = SchemaFile(2)
    Child.exec("wyseman -R 2 -S " + sFile, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(sFile).toString()
        , sch = JSON.parse(content)
log.debug("Schema:", sch.prev.length)
      assert.ok(sch.publish)
      assert.equal(sch.release, 2)
      assert.equal(sch.releases.length, 2)
      assert.equal(sch.prev.length, 1)
      done()
    })
  })

  it('enter delta drop command', function(done) {
    let delta = '"wmtest.items drop descr"'
    Child.exec("wyseman -g " + delta, {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('build items table after dropped column', function(done) {
    Child.exec("wyseman objects test3.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('can commit release 3', function(done) {
    Child.exec("wyseman init test3.wmi -C", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })
  
  it('can build release 3 schema file', function(done) {
    let sFile = SchemaFile(3)
    Child.exec("wyseman -R last -S " + sFile, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(sFile).toString()
        , sch = JSON.parse(content)
log.debug("Schema:", sch.prev.length)
      assert.ok(sch.publish)
      assert.equal(sch.release, 3)
      assert.equal(sch.releases.length, 3)
      assert.equal(sch.prev.length, 2)
      done()
    })
  })

  it('have empty Wyseman.delta file now', function() {
    let content = Fs.readFileSync(Path.join(SchemaDir, 'Wyseman.delta')).toString()
      , deltas = JSON.parse(content)
    assert.equal(Object.keys(deltas), 0)
  })

  it('build items table after added column w/ no delta', function(done) {
    Child.exec("wyseman objects test4.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('can commit release 4', function(done) {
    Child.exec("wyseman init test3.wmi -C", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('can build release 4 schema file with explicit number', function(done) {
    let sFile = SchemaFile(4)
    Child.exec("wyseman -R 4 -S " + sFile, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(sFile).toString()
        , sch = JSON.parse(content)
log.debug("Schema:", sch.prev.length)
      assert.ok(sch.publish)
      assert.equal(sch.release, 4)
      assert.equal(sch.releases.length, 4)
      assert.equal(sch.prev.length, 3)
      done()
    })
  })

  it('correct delta and next release value', function(done) {
    let sql = "select delta, wm.next() from wm.objects_v where obj_nam = 'wmtest.items' and release = 4"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.next, 5)
log.debug("delta:", row.delta, typeof row.delta)
      assert.ok(!!row.delta)
      assert.equal(row.delta.length, 0)
      done()
    })
  })

  it('check Wyseman.hist release and archive info', function() {
    let content = Fs.readFileSync(Path.join(SchemaDir, 'Wyseman.hist')).toString()
      , hist = JSON.parse(content)
log.debug("History object:", hist.releases, hist.prev)
    assert.equal(hist.releases.length, 5)
    assert.equal(hist.prev.length, 3)
    assert.equal(hist.arch.length, 4)
//log.debug("  arch:", hist.arch[0])
    assert.ok(hist.arch[0].boot.slice(0,4) == 'eJy9')
    assert.ok(hist.arch[0].init.slice(0,4) == 'eJyV')
    assert.ok(hist.arch[0].dict.slice(0,4) == 'eJzN')
    assert.ok(hist.arch[1].boot == null)		//Eliminated redundant archival info
    assert.ok(hist.arch[2].boot == null)
    assert.ok(hist.arch[2].init.slice(0,4) == 'eJyV')
    assert.ok(hist.arch[3].boot == null)
    assert.ok(hist.arch[3].init == null)
    assert.ok(hist.arch[3].dict.slice(0,4) == 'eJzN')
  })

  it('can build schema file for older release 2', function(done) {
    let sFile = SchemaFile('2b')
    Child.exec("wyseman -R 2 -S " + sFile, {cwd: SchemaDir}, (e,o) => {if (e) done(e)
      let content = Fs.readFileSync(sFile).toString()
        , sch = JSON.parse(content)
log.debug("Schema:", sch.prev.length)
      assert.ok(sch.publish)
      assert.equal(sch.release, 2)
      assert.equal(sch.releases.length, 2)
      assert.equal(sch.prev.length, 1)
      done()
    })
  })

  it('later-created schema 2b file matches original release 2 file', function(done) {
    let oFile = SchemaFile('2')
      , rFile = SchemaFile('2b')
    Child.exec(`diff ${oFile} ${rFile}`, {cwd: SchemaDir}, (error,output) => {
//log.debug("Diff:", e, 'O:', o)
      assert.ok(error == null)
      assert.equal(output, '')
      done()
    })
  })
/* */
  after('Delete working schema file', function() {
    Fs.rmSync(SchemaFile('2b'))
  })

  after('Disconnect from test database', function() {
    db.disconnect()
  })

})

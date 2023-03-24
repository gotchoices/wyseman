//Check dropping objects out of a schema; run after versions.js
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
const assert = require("assert");
const Fs = require('fs')
const Path = require('path')
const Child = require('child_process')
const { TestDB, DBAdmin, Log, DbClient, SchemaDir, SchemaFile } = require('./settings')
var log = Log('test-orphan')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true, schema: SchemaFile('4'), log}

describe("Orphan: Modify DB schema", function() {
  var db

  before('Delete sample database if it exists', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, (err, out) => done())
  })

  it('Connect to and create database from JSON schema', function(done) {
    db = new DbClient(dbConfig, (chan, data)=>{}, ()=>{
      log.debug("Connected to schema DB"); 
      done()
    })
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
/*
  it('can disable pruning', function(done) {
    Child.exec("wyseman objects testo.wms --no-prune", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('obsolete table remains', function(done) {
    db.query("select count(*) from wmtest.items", null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
log.debug("Items count:", row)
      assert.equal(row.count, 7)
      done()
    })
  })

  it('can prune obsolete object', function(done) {
    Child.exec("wyseman objects testo.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('obsolete table gets deleted', function(done) {
    db.query("select count(*) from wmtest.items", null, (e, res) => {
      assert.ok(e != null)
log.debug("Error info:", e)
      assert.equal(e.name, 'error')
      assert.equal(e.code, '42P01')
      done()
    })
  })
/* */
  after('Disconnect from test database', function() {
    db.disconnect()
  })

});

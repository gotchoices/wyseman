//Check upgrading a database from one release to the next
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
const assert = require("assert");
const Fs = require('fs')
const Path = require('path')
const Child = require('child_process')
const { TestDB, DBAdmin, Log, DbClient, SchemaDir, Module, SchemaFile } = require('./settings')
var log = Log('test-migrate')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true, log}

describe("Migrate: Update DB schemas", function() {
  var db

  before('Delete sample database if it exists', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, (err, out) => done())
  })

  it('connects to and create database from schema-2', function(done) {
    dbConfig.schema = SchemaFile(2)
    db = new DbClient(dbConfig, (chan, data)=>{}, ()=>{
      let schema = db.schema || {}
        , { module, release } = schema
log.debug("Connected to schema DB:", module, release); 
      done()
    })
  })
  
  it('finds correct DB release number', function(done) {
    db.query("select wm.last(), wm.next()", null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.last, 2)
      assert.equal(row.next, 2)
      done()
    })
  })

  it('correct delta and next release value', function(done) {
    let sql = "select delta, wm.next() from wm.objects_v where obj_nam = 'wmtest.items' and release = 2"
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
log.debug("delta:", row.delta, typeof row.delta)
      assert.equal(row.next, 2)
      assert.ok(!!row.delta)
      assert.equal(row.delta[0], 'rename comment to descr')
      done()
    })
  })

  it('disconnects from test database', function() {
    db.disconnect()
  })

  it('reconnects to update with the later schema-4', function(done) {
    let config = Object.assign({}, dbConfig, {schema:SchemaFile(4), update: true})
    db = new DbClient(config, (chan, data)=>{}, done)
  })

  it('finds correct DB release number', function(done) {
    db.query("select wm.last(), wm.next()", null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.last, 4)
      assert.equal(row.next, 4)
      done()
    })
  })

  after('Disconnect from test database', function() {
    db.disconnect()
  })
});

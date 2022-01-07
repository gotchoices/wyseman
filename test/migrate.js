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

const any2any = function(fromRel, toRel) {
  var db

  before('Delete sample database if it exists', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, (err, out) => done())
  })

  it('connects to and create database from schema ' + fromRel, function(done) {
    dbConfig.schema = SchemaFile(fromRel)
    db = new DbClient(dbConfig, (chan, data)=>{}, done)
  })
  
  it('finds correct DB release number', function(done) {
    db.query("select wm.last(), wm.next()", null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.last, fromRel)
      assert.equal(row.next, fromRel)
      done()
    })
  })

  it('correct delta and next release value', function(done) {
    let sql = "select delta, wm.next() from wm.objects_v where obj_nam = 'wmtest.items' and release = " + fromRel
    db.query(sql, null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
log.debug("delta:", row.delta, typeof row.delta)
      assert.equal(row.next, fromRel)
      assert.ok(!!row.delta)
      if (fromRel == 2) assert.equal(row.delta[0], 'rename comment to descr')
      if (fromRel == 3) assert.equal(row.delta[0], 'drop descr')
      done()
    })
  })

  it('disconnects from test database', function() {
    db.disconnect()
  })

  it('reconnects to update with the later schema ' + toRel, function(done) {
    let config = Object.assign({}, dbConfig, {schema:SchemaFile(toRel), update: true})
    db = new DbClient(config, (chan, data)=>{}, done)
  })

  it('finds correct updated DB release number', function(done) {
    db.query("select wm.last(), wm.next()", null, (e, res) => {if (e) done(e)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]
      assert.equal(row.last, toRel)
      assert.equal(row.next, toRel)
      done()
    })
  })

  after('Disconnect from test database', function() {
    db.disconnect()
  })
}

//For individual testing:
//let from = 2, to = 4
//describe(`Migrate: Test update from ${from} to ${to}`, function() {any2any(from, to)})

//Bulk test:
describe("Migrate: Test every update path", function() {
  let first = 1, last = 4

  before('Disconnect from test database', function() {
    let content = Fs.readFileSync(Path.join(SchemaDir, 'Wyseman.hist')).toString()
      , hist = JSON.parse(content)
log.debug('History:', hist.releases)
    if (hist && hist.releases) last = hist.releases.length -1
  })

  for (let from = first; from <= last - 1; from++) {
    for (let to = from + 1; to <= last; to++) {
log.debug(`Migrate: ${from} --> ${to}`)
      describe(`Migrate: Test update from ${from} to ${to}`, function() {
        any2any(from, to)
      })
    }
  }
})

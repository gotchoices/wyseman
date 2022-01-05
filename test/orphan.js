//Check dropping objects out of a schema
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
const assert = require("assert");
const Fs = require('fs')
const Path = require('path')
const Child = require('child_process')
const { TestDB, DBAdmin, Log, DbClient, SchemaDir, SchemaFile } = require('./settings')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true, schema: SchemaFile('4')}
var log = Log('test-orphan')

describe("Modify DB schema", function() {
  var db

  it('Connect to and create database from JSON schema', function(done) {
    db = new DbClient(dbConfig, (chan, data)=>{}, ()=>{
      log.debug("Connected to schema DB"); 
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
    assert.ok(hist.arch[0].boot.slice(0,4) == 'eJzN')
    assert.ok(hist.arch[0].init.slice(0,4) == 'eJyV')
    assert.ok(hist.arch[0].dict.slice(0,4) == 'eJzN')
    assert.ok(hist.arch[1].boot == null)		//Eliminates redundant archival info
    assert.ok(hist.arch[2].boot == null)
    assert.ok(hist.arch[3].boot == null)
    assert.ok(hist.arch[3].init == null)
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

  it('can disable pruning', function(done) {
    Child.exec("wyseman objects test4.wms --no-prune", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
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
    Child.exec("wyseman objects test4.wms", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('obsolete table gets deleted', function(done) {
    db.query("select count(*) from wmtest.items", null, (e, res) => {
      assert.ok(e != null)
      assert.equal(e.name, 'error')
      assert.equal(e.code, '42P01')
      done()
    })
  })

  after('Disconnect from test database', function() {
    db.disconnect()
  })
/*
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
*/
});

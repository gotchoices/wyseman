//Build test database and check it
//TODO:
//- 

const assert = require("assert");
const { DatabaseName, DBAdmin } = require('../settings')
const Log = require(require.resolve('wyclif/lib/log.js'))
var log = Log('test-checkdb')
var fs = require('fs')
var dbClient = require("../../lib/dbclient.js")
const dbConfig = {
  database: DatabaseName,
  user: DBAdmin,
  listen: "DummyChannel",		//Cause immediate connection to DB, rather than deferred
  schema: __dirname + "/../schema.sql"
}

describe("Build DB and check it", function() {
  var db

  before('Connect to (or create) test database', function(done) {
    db = new dbClient(dbConfig, (chan, data)=>{
      log.debug("Async message:", chan, data); 
    }, ()=>{
      log.debug("Connected"); 
      done()
    })
  })

  it('Check for undocumented tables', function(done) {
    let sql = "select sch,tab from wm.table_lang where language = 'en' and help isnull and sch = 'wm' order by 1,2"
    db.query(sql, null, (err, res) => {
      if (err) done(err)
      log.debug("Tables:", res.rows)
      assert.equal(res.rows.length, 0)
      done()
    })
  })

  it('Check for undocumented columns', function(done) {
    let sql = "select sch,tab,col from wm.column_lang where language = 'en' and help isnull and sch = 'wm' order by 1,2"
log.debug("SQL:", sql)
    db.query(sql, null, (err, res) => {
      if (err) done(err)
      log.debug("Columns:", res.rows.length, res.rows)
      assert.equal(res.rows.length, 0)
      if (res.rows.length == 0) done()
    })
  })

  after('Disconnect from test database', function(done) {
    log.debug("After:")
    db.disconnect()
    done()
  })
});

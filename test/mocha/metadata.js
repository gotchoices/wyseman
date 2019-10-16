//Check table styles in data dictionary
//TODO:
//- 

const assert = require("assert");
const { DatabaseName, DBAdmin } = require('../settings')
var fs = require('fs')
var log = new (require('../logger'))('metadata')
var dbClient = require("../../lib/dbclient.js")

const dbConfig = {
  database: DatabaseName,
  user: DBAdmin,
  listen: "DummyChannel",		//Cause immediate connection to DB, rather than deferred
  schema: __dirname + "/../schema.sql"
}

describe("Check JSON structures in data dictionary", function() {
  var db

  before('Connect to test database', function(done) {
    db = new dbClient(dbConfig, (chan, data)=>{
      log.debug("Async message:", chan, data); 
    }, ()=>{
      log.debug("Connected"); 
      done()
    })
  })

  it('Check JSON in table_style reports', function(done) {
    let sql = "select sw_value from wm.table_style where sw_name = 'reports'"
    db.query(sql, null, (err, res) => {
      if (err) done(err)
      log.debug("Rows:", res.rows.length)
      res.rows.forEach(row=>{
        var value = JSON.parse(row.sw_value)
        log.debug(" value:", value)
        assert.equal(typeof value, 'object')
      })
      done()
    })
  })

  after('Disconnect from test database', function(done) {
    log.debug("After:")
    db.disconnect()
    done()
  })
});

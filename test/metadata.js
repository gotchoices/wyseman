//Check table styles in data dictionary
//TODO:
//- 

const Path = require('path')
const assert = require("assert");
const { TestDB, DBAdmin, SchemaDir } = require('./settings')
const Log = require(require.resolve('wyclif/lib/log.js'))
var log = Log('test-metadata')
var fs = require('fs')
var DbClient = require("../lib/dbclient.js")
const JsonSchema = Path.join(SchemaDir, 'schema.json')

const dbConfig = {
  database: TestDB,
  user: DBAdmin,
  connect: true,
}

describe("Check JSON structures in data dictionary", function() {
  var db

  before('Connect to test database', function(done) {
    db = new DbClient(dbConfig, (chan, data)=>{
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

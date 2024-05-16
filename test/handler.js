//Check JSON to SQL translations
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- Implement many more tests
//
const assert = require("assert");
const Path = require('path')
const { TestDB, DBAdmin, Log, DbClient, SchemaDir, SchemaFile, WmItems } = require('./settings')
var log = Log('test-handler')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true, log}
const Handler = require('../lib/handler')

describe("Check JSON to SQL functions", function() {
  var db, hand
  const resultObj = function() {
    this.query = null
    this.parms = []
    this.error = null
  }

//  before('Connect to test database', function(done) {
//    db = new DbClient(dbConfig, (chan, data)=>{
//      log.debug("Async message:", chan, data); 
//    }, ()=>{
//      log.debug("Connected"); 
//      done()
//    })
//  })

  before('Instantiate handler', function(done) {
    hand = new Handler({db, log})
    done()
  })

  it('Where clause, simplified 3 elements', function(done) {
    let logic = ['myfield = 7']
      , res = new resultObj()
      , where = hand.buildWhere(logic, res)		//;log.debug('w:', where, 'res:', JSON.stringify(res))
    assert.equal(where, 'myfield = $1')
    assert.equal(res.parms[0], 7)
    done()
  })

  it('Where clause, simplified 2 elements', function(done) {
    let logic = ['boolField true']
      , res = new resultObj()
      , where = hand.buildWhere(logic, res)		//;log.debug('w:', where, 'res:', JSON.stringify(res))
    assert.equal(where, '"boolField"')
    done()
  })

//  after('Disconnect from test database', function(done) {
//    log.debug("After:")
//    db.disconnect()
//    done()
//  })
})

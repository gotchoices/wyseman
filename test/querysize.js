//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
// TODO
//- 
const assert = require("assert");
const { TestDB, DBHost, DBPort, DBAdmin, Log, DbClient, SchemaDir, SchemaFile } = require('./settings')
var log = Log('test-querysize')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true, log, host: DBHost, port: DBPort}
var interTest = {}

describe("Test postgres handling of large queries", function() {
  this.timeout(10000)
  var db

  const genSql = (size) => {
    const data = 'a'.repeat(size)
    return `INSERT INTO test_table (data) VALUES ('${data}');`
  }

  const doInsert = async (size) => {
    const sql = genSql(size)
    const startTime = Date.now()
    await db.query(sql)
    const endTime = Date.now()
    return endTime - startTime
  }

  before('Connect to database', function(done) {
    db = new DbClient(dbConfig, ()=>{}, ()=>{
      log.debug("Connected to DB");
      done()
    })
  })

  it('Create table for test', async function() {
    await db.query(`drop table if exists test_table;`);
    await db.query(`
      create table test_table (
        id serial primary key,
        data text
      )
    `)
  })

  ;[10000, 100000, 500000, 1000000, 2000000, 5000000, 10000000, 50000000, 100000000 ].forEach(size => {
    it(`Query with ${size} bytes`, async function() {
      const timeTaken = await doInsert(size)
      assert.equal(typeof timeTaken, 'number')
    })
  })

/* */
  after('Disconnect from test database', function(done) {
    db.disconnect()
    done()
  })
})

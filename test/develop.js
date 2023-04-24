//Build SQL file that can create development DB objects for use by other modules
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
const Fs = require('fs')
const Path = require('path')
const Child = require('child_process')
const assert = require("assert");
const { TestDB, DBAdmin, Log, DbClient, SchemaDir } = require('./settings')
var log = Log('test-develop')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true, log}

describe("Make create SQL script for development objects", function() {
  var db

  before('Delete test database if it exists', function(done) {
    Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, (err, out) => done())
  })

  before('Build database schema', function(done) {
    Child.exec("wyseman", {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  before('Connect to test database', function(done) {
    db = new DbClient(dbConfig, (chan, data)=>{
      log.debug("Async message:", chan, data); 
    }, ()=>{
      log.debug("Connected"); 
      done()
    })
  })

  it('Make temporary copy of non-development database objects', function(done) {
    let sql = `select object
      into wm.objects_tmp
      from wm.objects_v_depth where release = wm.next() and module = 'wyseman'
    `
    db.query(sql, null, (err, res) => {
      if (err) done(err)
log.debug("rows:", res.rows)
      done()
    })
  })

  it('Build development objects', function(done) {
    let files = ['run_time.wms','develop.wms','run_time.wmt','develop.wmt'].map(f => 
      Path.join(__dirname, '../lib', f)
    )
log.debug('cmd:', `wyseman ${files}`)
    Child.exec(`wyseman ${files.join(' ')}`, {cwd: SchemaDir}, (e,o) => {if (e) done(e); done()})
  })

  it('Create SQL for development objects only', function(done) {
    let sql = `with drops as (select drp_sql as sql from wm.objects_v_depth
      where object not in (select object from wm.objects_tmp)
      and release = wm.next() and module = 'wyseman' order by depth desc),
    creates as (select crt_sql as sql from wm.objects_v_depth
      where object not in (select object from wm.objects_tmp)
      and release = wm.next() and module = 'wyseman' order by depth)
    select sql from drops union all select sql from creates;`
    db.query(sql, null, (err, res) => {
      if (err) done(err)
      let sqlFile = Path.join(__dirname, '../lib/develop.sql')
        , sqlData = res.rows.map(el => el.sql).join('\n') + '\n'
//log.debug("Sqls:", res.rows[0])
      Fs.writeFileSync(sqlFile, sqlData)
      done()
    })
  })
/* */
  after('Disconnect from test database', function(done) {
    log.debug("After:")
    db.disconnect()
    done()
  })
});
after('Delete sample database', function(done) {
  Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, done)
})

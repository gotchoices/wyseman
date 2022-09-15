//Check server/client authentication/connection; Run only after schema.js
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- 
const Path = require('path')
const Child = require('child_process')
const Fs = require('fs')
const Ws = require('ws')
const Https = require('https')
const Fetch = require('node-fetch')
const Wyseman = require('../lib/wyseman.js')
const ClientAPI = require('../lib/client_ws.js')
const Message = require('../lib/client_msg.js')
const { Credentials, SpaServer } = require('wyclif')
const wsPort = 54329
const assert = require("assert");
const webcrypto = require('crypto').webcrypto
const { TestDB, DBAdmin, Log, DbClient, SchemaDir, SchemaFile } = require('./settings')
const dbConfig = {database: TestDB, user: DBAdmin, connect: true, schema: SchemaFile('1b')}
const UserAgent = "Wyseman Websocket Test Client"
const user = 'admin'
const httpPort = 8002
const pkiLocal = Path.join(__dirname,'pki/local')
var interTest = {}
var log = Log('test-client')

var Suite1 = function({address, proto, htProto, credentials, localCA}) {
  var db, wm, ss

  before('Connect to (or create) test database', function(done) {
    db = new DbClient(dbConfig, (chan, data)=>{
      log.debug("Async message:", chan, data); 
    }, ()=>{
      log.debug("Connected"); 
      done()
    })
  })

  it('Launch SPA server', function(done) {
    ss = new SpaServer({spaPort:httpPort, credentials}, log)
    setTimeout(() => {
      done()
    }, 250)
  })

  it('Launch Wyseman server', function(done) {
    let dConf = {database: TestDB, log}
      , sockConf = {log, websock: {port: wsPort, credentials}}

    wm = new Wyseman(dConf, sockConf, dbConfig)
    
    let sql = "select base.parmset('wyseman','port',$1::int)"
    db.query(sql, [wsPort], (err, res) => {
      if (err) done(err)			//log.debug("Records:", res.rows)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]			//;log.debug("Row;", row)
      assert.equal(row.parmset, wsPort)		//Worked to set default connection port
      done()
    })
  })

  it('Generate connection ticket', function(done) {
    let sql = "select token, expires, host, port from base.ticket_login(base.user_id($1))"
    db.query(sql, [user], (err, res) => {
      if (err) done(err)			//log.debug("Records:", res.rows)
      assert.equal(res.rows.length, 1)
      let row = res.rows[0]			;log.debug("Row;", row)
      assert.ok(row.token)
      assert.ok(row.expires)
      assert.equal(row.host, 'localhost')
      assert.equal(row.port, wsPort)
      interTest.ticket = row
      done()
    })
  })

  let launchClient = function(creds, done) {
    let headers = {"user-agent": UserAgent, cookie: Math.random()}
      , user = 'admin'
      , { host, port } = creds
      , fetchOptions = {
        headers,
        agent: localCA ? new Https.Agent({ca:localCA}) : null
      }
      , config = {				//Resource for client connection API
          webcrypto, httpPort,
          listen:	['wylib'],
          debug:	log.debug,
          fetch:	(uri) => {
            return Fetch(uri, fetchOptions)
          },
          saveKey:	jKey => {		//Call this when a key generated
            interTest.savedKey = jKey		;log.debug("Save connection key:", jKey)
          }
        }
      , origin = `${htProto}://${creds.host}:${httpPort}`
      , wsOptions = {origin, headers, ca:localCA}
      , ws
      , localStore = {get: () => {}, set: () => {}}
      , msg = new Message(localStore, log.debug)
      , api = new ClientAPI(config)
      , dc = 2, _done = () => {if (!--dc) done()}       //dc _done's to be done

    api.uri(creds).then(wsURI => {			//log.debug("wsURI:", wsURI)
      ws = new Ws(wsURI, wsOptions)			//Open websocket to backend
      ws.on('close', () => msg.onClose())
      ws.on('open', () => {				//log.debug("Websocket open")
        msg.onOpen(address, m=> {			//log.debug("Sender:", m)
          ws.send(m)		
        })
        _done()
      })
      ws.on('error', err => {				log.error("Connection failed:", err.message)
        msg.onClose()
        done(err)
      })
      ws.on('message', m => {				//log.debug("Message:", m)
        msg.onMessage(m)				
      })
    }).catch(err => {
      done(err)
    })
    msg.request('ID-test', 'tuple', {
      view: 'base.ent_v',
      fields: 'username',
      where: {id: 'r1'}
    }, (dat) => {
log.debug("Req res:", dat)
      assert.equal(dat.username, user)
      ws.close()
      _done()
    })
  }		// launchClient

  it('Connect using ticket', function(done) {
    let creds = Object.assign({user, proto}, interTest.ticket)
    launchClient(creds, done)
  })

  it('Connect using key', function(done) {
    let creds = Object.assign({proto}, interTest.savedKey)
    launchClient(creds, done)
  })

/* */
  after('Disconnect from test database', function(done) {
    wm.close()					//;log.debug("Disconnect:")
    db.disconnect()
    ss.close()
    done()
  })
}

describe("Test client/server connection/API", function() {

  before("Build test SSL certificates", function(done) {
    let dc = 2, _done = () => {if (!--dc) done()}       //dc _done's to be done
      , caFile = Path.join(pkiLocal, 'spa-ca.crt')
    Child.exec("npx wyclif-cert localhost", {cwd: __dirname}, (e,o) => {
      if (e) done(e)
      Fs.readFile(caFile, (err, dat) => {	//Grab CA file contents
        if (err) done(err)
        interTest.localCA = dat
        done()
      })
      Fs.stat(Path.join(pkiLocal,'spa-localhost.crt'), (er, st) => {
        if (er) done(er)
        else _done()
      })
    })
  })

  it("Call client/server API tests", function() {
    let address = 'localhost.localdomain'
      , spaKey = Path.join(pkiLocal, 'spa-localhost.key')
      , spaCert = Path.join(pkiLocal,'spa-localhost.crt')
      , credentials = Credentials(spaKey, spaCert, null, log)
      , config1 = {
          proto: 'ws',
          htProto: 'http',
          address,
        }
      , config2 = {
          proto: 'wss',
          htProto: 'http',
          address,
          credentials,
          localCA: interTest.localCA,
        }

    describe("Unencrypted", function() {Suite1(config1)})
    describe("Using SSL/Certificate", function() {Suite1(config2)})
  })
  
  after('Delete test certificate files', function() {
    Fs.rmSync(pkiLocal, {recursive: true, force: true})
  })

})

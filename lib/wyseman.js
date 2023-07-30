//Manage the connection between a User Interface and the backend database
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- Allow connection via noise protocol
//- ? Restructure code as explained in: https://github.com/websockets/ws/issues/377#issuecomment-462152231

const	DbClient	= require('./dbclient.js')		//PostgreSQL
const	Handler		= require('./handler.js')		//JSON..SQL
const	Ws		= require('ws')				//Web sockets
const	Https		= require('https')
const	Http		= require('http')
const	Url		= require('url')
const	Subtle		= require('crypto')?.webcrypto?.subtle
const { KeyConfig, SignConfig } = require('./crypto.js')
const	Net		= require('net')
const	LangCache	= require('./lang_cache')
const	MetaCache	= require('./meta_cache')

module.exports = class Wyseman {

  constructor(dbConf, sockConf, adminConf) {
    let { websock, sock, actions, dispatch, expApp } = sockConf
      , { credentials } = websock
      , wsport = parseInt(websock.port)
      , aConf = Object.assign({listen: ['wyseman']}, adminConf)				//Listen for updates to data dictionary

    this.server = credentials ? Https.createServer(credentials) : Http.createServer()	//websocket rides on this server
    this.log = dbConf.log ?? sockConf.log ?? adminConf.log ?? require('./log')		//Try to find a logger
    this.adminDB = new DbClient(aConf, (ch, msg) => {					//Open Admin connection to the DB
      LangCache.clear()			//;this.log.debug("Admin DB async:", ch, msg)
      MetaCache.refetch()
    })
    this.maxDelta = websock.delta ?? 60000
    this.uiPort = websock.uiPort ?? (wsport - 1)
    if (!Subtle) {
      this.log.error("Can't find webcrypt.subtle library")
      return
    }

//For future noise-protocol connection:
//    if (sock)
//      Net.createServer(sock => this.sockConnect(sock)).listen(sock)

    if (wsport) {
      this.wss = new Ws.Server({		//Initiate a new websocket server
        server: this.server, 
        clientTracking: true,
        verifyClient: (info, cb) => {
          try {this.verifyClient(info, cb)} catch(e) {
            this.log.error("Verifying client:", e)
          }
        }
      })
      if (!this.wss) return

this.log.info("Wyseman listening on websocket:", wsport)
      this.server.listen(wsport)
      this.wss.on('connection', (ws, req) => {		//When connection from view client is open
        let payload = req.WysemanPayload
          , { user, listen, origin } = payload
          , config = Object.assign({}, dbConf, {user, listen})	//user,listen was passed to us from verifyClient
this.log.verbose("WS Connected; User:", config.user, config, ws)
        if (!config.user) return				//Shouldn't be able to get here without a username
        let db = new DbClient(config, (channel, message, mine) => {
              let data = JSON.parse(message)
this.log.trace("Async notify from DB:", channel, data, mine)
              ws.send(JSON.stringify({action: 'notify', channel, data}), err => {
                if (err) this.log.error(err)
              })
            })
          , handler = new Handler({
            db, control: null, log:this.log,
            dispatch, dConfig: {db, expApp, actions, origin, log: this.log}
          })
this.log.trace("Wyseman connection conf:", "Client WS port:", wsport)

        ws.on('close', (code, reason) => {
          this.log.debug("Wyseman socket connection closed:", code, reason)
          db.disconnect()				//Free up this DB connection
        })

        ws.on('message', (imsg) => {			//When message received from client
          this.log.trace("Incoming Wyseman message:" + imsg + ";")
          let packet = JSON.parse(imsg)
  
          handler.handle(packet, (omsg) => {		//Handle/control an incoming packet
            let jmsg = JSON.stringify(omsg)
//this.log.trace('Sending back:', JSON.stringify(omsg, null, 2))
            ws.send(jmsg, err => {			//Send a reply back to the client
              if (err) this.log.error(err)
            })
          })
        })
this.log.debug("Connected clients: ", this.wss.clients.size)
      })		//wss.on connection
    }			//if (wsport)
  }			//constructor

//Close this server instance
// -----------------------------------------------------------------------------
  close() {
this.log.trace("Closing wyseman: ", this.wss.clients.size)
    this.wss.close()
    this.server.close()
    this.adminDB.disconnect()
  }

//Validate a user who is presenting a one-time connection token
// -----------------------------------------------------------------------------
  validateToken(user, token, pub, listen, payload, cb) {
this.log.debug("Request to validate:", user, "tok:", token, "pub:", pub)
    this.adminDB.query('select base.token_valid($1,$2,$3) as valid', [user, token, pub], (err, res) => {
      if (err) this.log.error("Error validating user:", user, token, err)
      let valid = (!err && res && res.rows && res.rows.length >= 1) ? res.rows[0].valid : false
      if (valid) Object.assign(payload, {user,listen})		//Tell later db connect our username and db listen options
this.log.debug("  valid result:", valid)
      cb(valid)
    })
  }

//Validate a user who has an existing key
// -----------------------------------------------------------------------------
  validateSignature(user, sign, message, listen, payload, cb) {
this.log.debug("Validate:", user, sign, message)
    this.adminDB.query('select conn_pub from base.ent_v where username = $1', [user], (err, res) => {
      if (err) this.log.error("Error getting user connection key:", user, err)
      let pubKey = (!err && res?.rows?.length >= 1) ? res.rows[0].conn_pub : null

this.log.trace("  public key:", pubKey, typeof pubKey)
      if (!pubKey || !sign) cb(false)
      Subtle.importKey('jwk', pubKey, KeyConfig, true, ['verify']).then(pub => {	//JWK to raw
        let rawSig = Buffer.from(sign, 'base64')		//Decode the users's signed message
          , rawMsg = Buffer.from(message)
        return Subtle.verify(SignConfig, pub, rawSig, rawMsg)
      }).then(valid => {
        if (valid)			//Tell later db connect our username and db listen options
          Object.assign(payload, {user,listen})
this.log.debug("  verify:", valid)
        cb(valid)
      }).catch(err => {
this.log.debug("Error validating signature:", err.message)
      })
    })
  }

//Validate a user who is trying to connect
// -----------------------------------------------------------------------------
  verifyClient(info, cb) {
this.log.debug("verifyClient:", info.req.headers)
    let { origin, req, secure } = info
      , query = Url.parse(req.url, true).query
      , { user, db, sign, date, token, pub } = query
      , listen = db ? JSON.parse(Buffer.from(db,'base64').toString()) : null
      , orgUrl = Url.parse(origin ?? req.headers.host)
      , payload = req.WysemanPayload = {	//Custom Wyseman data to pass back to connection
        origin: `${orgUrl.protocol}//${orgUrl.hostname}:${this.uiPort}`
      }

this.log.trace("Checking client:", origin, "cb:", !!cb, "q:", query, "s:", secure, "IP:", req.connection.remoteAddress, "pub:", pub)
    if (user && token && pub) {			//User connecting with a token
      let pubJSON = Buffer.from(pub,'base64').toString()
      this.validateToken(user, token, pubJSON, listen, payload, (valid)=>{
        cb(valid, 403, 'Invalid Login')		//Tell websocket whether or not to connect
      })
    } else if (user && sign && date) {		//User has a signature
      let message = JSON.stringify({ip: req.connection.remoteAddress, cookie: req.headers.cookie, userAgent: req.headers['user-agent'], date})
        , now = new Date()
        , msgDate = new Date(date)
this.log.debug("Check dates:", now, msgDate, this.maxDelta, "Time delta:", now - msgDate)
      if (this.maxDelta && Math.abs(now - msgDate) > this.maxDelta)
        cb(false, 400, 'Invalid Date Stamp')
      else this.validateSignature(user, sign, message, listen, payload, (valid)=>{
        cb(valid, 403, 'Invalid Login')		//Tell websocket whether or not to connect
      })

    } else if (user && !secure) {
      Object.assign(payload, {user,listen})	//Tell later db connect our username and db listen options
      cb(true)					//On an insecure/debug web connection

    } else
      cb(false, 401, 'No login credentials')	//tell websocket not to connect
  }

//Service an incoming connection on a TCP socket
// -----------------------------------------------------------------------------
//  sockConnect(ss) {
//this.log.debug("Wyseman socket connection")
//    ss.on('end', () => {
//this.log.debug("Wyseman socket disconnect")
//    })
//    ss.on('error', err => {
//this.log.debug("Wyseman socket error:", err)
//    })
//    ss.on('data', data => {
//      let msg = data.toString().trim()
//this.log.debug("Wyseman socket data:", msg)
//    })
//  }
  
}	//class Wyseman

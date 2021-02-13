#!/usr/bin/env node
//A module to connect a node.js client to a MyCHIPs server via websocket
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
// TODO:
//X- Make into a Wyseman library call
//X- How to abstract db=
//- Implement encryption/wrapping of the stored key (compatible with Wylib version of client)
//- 
const { Log } = require('wyclif')
const Crypto = require('crypto')
const Https = require('https')
const Fetch = require('node-fetch')		//Fetch data from web server
const Ws = require('ws')			//Websockets
const { TextEncoder } = require('util')
const defKeyLength = 2048
const UserAgent = "Wyseman Websocket Client API"

module.exports = class {
  constructor(conf) {
    this.ca = conf.ca
    this.dbInfo = conf.dbInfo
    this.httpPort = conf.httpPort
    this.keyLength = conf.keyLength || defKeyLength
    this.log = conf.log || Log('Wyseman-client')
    this.ws = null
  }
  
  connect(credential, openCB) {
    let { host, port, user, token, key } = credential	//Grab properties from token or connecton key object
      , authString
      , myKey
    
    if (token) {
      let keyPair = Crypto.generateKeyPairSync('rsa',{		//We will build a brand new keypair for future use
        modulusLength: this.keyLength,
        publicKeyEncoding: {type: 'spki', format: 'der'},
//Fixme:  privateKeyEncoding: {type: 'pkcs8', format: 'der', cipher: 'aes-256-cbc', passphrase: ???}
        privateKeyEncoding: {type: 'pkcs8', format: 'der'}
      })
this.log.trace("Generated key:", user, keyPair.privateKey.toString('hex'))
      if (this.keyCB) this.keyCB(
        {login: {host, port, user, key:keyPair.privateKey.toString('hex')}}
      )
      authString = 'token=' + token + '&pub=' + keyPair.publicKey.toString('hex')
    } else if (key) {
      let keyData = Buffer.from(key, 'hex')
      myKey = Crypto.createPrivateKey({key:keyData, format: 'der', type: 'pkcs8'})
    } else {
//      throw "Must specify a token or a key"
    }

    let origin = `https://${host}:${this.httpPort}`		//Websocket runs within an http origin
      , clientUri = origin + '/clientinfo'			//Will grab some data here to encrypt for connection handshake
      , headers = {"user-agent": UserAgent, cookie: Math.random()}
      , fetchOptions = {headers}				//Used in fetch of that data
      , wsOptions = {origin,headers}				//Used when opening websocket
  
    if (this.ca) {
      let agent = new Https.Agent({ca:this.ca})
      fetchOptions.agent = agent				//So fetch will recognize our site
      wsOptions.ca = this.ca					//So websocket will too
    }
this.log.debug("Fetching client info from:", clientUri)

    Fetch(clientUri, fetchOptions)				//Do an http fetch of metadata about our 'browser'
      .then(res => res.json())
      .then(info => {
this.log.debug("Client info:", info)

        let db = Buffer.from(JSON.stringify(this.dbInfo)).toString('hex')
this.log.debug("DB:", db)
        if (myKey) {						//If we already have a connection key
          let { ip, cookie, userAgent, date } = info		//Fodder for what we will digitally sign
            , message = JSON.stringify({ip, cookie, userAgent, date})	//Message object has to be built in exactly this order
            , signer = Crypto.createSign('SHA256')
            , enc = new TextEncoder
this.log.debug("message:", message)				// Crypto.getHashes()
//this.log.trace("myKey:", myKey.export({type: 'pkcs8', format: 'pem'}))
          signer.update(enc.encode(message))
          signer.end()
          let sign = signer.sign({key: myKey, padding: Crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 128}, 'hex')
          authString = 'sign=' + sign + '&date=' + date
        }

        let query = `user=${user}&db=${db}&${authString}`
          , url = `wss://${host}:${port}/?${query}`
this.log.debug("Ws URL:", url)
        this.ws = new Ws(url, wsOptions)
        this.ws.on('open', () => openCB(this.ws))
      }).catch(err => {
        this.log.error("Fetch:", err.stack)
      })
  }		//connect
  
  on(event, handler) {
this.log.debug("Setting handler:", event)
    if (event == 'key') {
      this.keyCB = handler
//    } else if (event == 'error' || event == 'message') {
//      this.ws.on(event, handler)
    } else {
      error('Unknown event:', event)
    }
  }
}		//class Client

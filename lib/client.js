#!/usr/bin/env node
//A module to connect a node.js client to a MyCHIPs server via websocket
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
// TODO:
//X- Implement encryption/wrapping of the stored key (compatible with Wylib version of client)
//- 
const { Log } = require('wyclif')
const Encrypt = require('wylib/src/encrypt')
const Https = require('https')
const Fetch = require('node-fetch')		//Fetch via http
const Ws = require('ws')			//Websocket library
const { TextEncoder } = require('util')
const defKeyLength = 2048
const UserAgent = "Wyseman Websocket Client API"
const Subtle = require('crypto').webcrypto.subtle
const KeyConfig = {
  name: 'RSA-PSS',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1,0,1]),
  hash: 'SHA-256'
}
const SignConfig = {		//For signing with RSA-PSS
  name: 'RSA-PSS',
  saltLength: 128
}
var encrypt = new Encrypt(require('crypto').webcrypto)

module.exports = class {
  constructor(conf) {
    this.ca = conf.ca				//Certificate Authority file
    this.dbInfo = conf.dbInfo			//Custom DB listen codes
    this.httpPort = conf.httpPort		//Where clientinfo query goes
    this.keyLength = conf.keyLength || defKeyLength	//client's private key length
    this.log = conf.log || Log('Wyseman-client')
    this.ws = null					//No websocket open yet
  }
  
  text2json(text) {					//Parse text to a JSON object
      let json = {}
      if (text) try {json = JSON.parse(text)} catch(e) {
        this.log.error("Parsing ticket JSON: ", text)
      }
      return json
    }

  async connect(credential, openCB) {			//Initiate an authenticate websocket connection, as a specified user
    let host, port, user, token, key

    if (credential.s && credential.i && credential.d) {	//credentials are encrypted
      let password = this.passwordCB ? this.passwordCB() : null
this.log.debug("Pre-decrypt:", credential)
      encrypt.decrypt(password, JSON.stringify(credential)).then(d=>{
        let plainObj = this.text2json(d)
this.log.debug("Post-decrypt:", plainObj)
        if (!('s' in plainObj))				//Call recursively with decrpyted credentials
          this.connect(plainObj, openCB)
      }).catch(e => this.log.error("Decrypting credentials: ", e.message))
      return
    } else if ('login' in credential) {
      ({ host, port, user, token, key } = credential.login)
    } else if ('host' in credential) {
      ({ host, port, user, token, key } = credential)	//Grab properties from token or connecton key object
    } else {
      this.log.error("Can't find required information in credential: ", credential)
    }
    
    let origin = `https://${host}:${this.httpPort}`		//Websocket runs within an http origin
      , headers = {"user-agent": UserAgent, cookie: Math.random()}
      , wsOptions = {origin, headers}				//Used when opening websocket

      ,  openWebSocket = (auth) => {			//Initiate websocket connection
      let dbHex = Buffer.from(JSON.stringify(this.dbInfo)).toString('base64url')	//Make hex string of database listen codes
        , query = `user=${user}&db=${dbHex}&${auth}`	//Build arguments for our URI
        , url = `wss://${host}:${port}/?${query}`	//and then the full URI
this.log.debug("Ws URL:", url)
      if (this.ca) wsOptions.ca = this.ca
      this.ws = new Ws(url, wsOptions)			//Launch connection
      this.ws.on('open', () => openCB(this.ws))		//Invoke caller code when it opens
      this.ws.on('error', err => {
        if (!this.errCB) throw(err)
        this.errCB(err, this.ws)
      })
    }

    if (token) {				//The caller has a connection token
      let keyPair = await Subtle.generateKey(KeyConfig, true, ['sign','verify'])
      let exPriv = await Subtle.exportKey('jwk', keyPair.privateKey)
this.log.trace("Generated key:", user, keyPair.privateKey)
      if (this.keyCB) {				//Let the caller store the new key
        let password = this.passwordCB ? this.passwordCB() : null
          , saveKey = {login: {host, port, user, key:exPriv}}
        if (password) {				//Encrypt key with a password?
          encrypt.encrypt(password, JSON.stringify(saveKey)).then(d=>this.keyCB(this.text2json(d)))
        } else {
          this.keyCB(saveKey)
        }
      }

      let exPub = await Subtle.exportKey('jwk', keyPair.publicKey)
        , authString = 'token=' + token + '&pub=' + Buffer.from(JSON.stringify(exPub)).toString('base64url')
this.log.trace("Public:", exPub)
      openWebSocket(authString)
      return
    }

this.log.trace("key:", key)
    if (!key) {this.log.error("Connection requested without token or key!"); return}
    				
    let myKey = await Subtle.importKey('jwk', key, KeyConfig, true, ['sign'])	//The caller already has a connection key
      , clientUri = origin + '/clientinfo'			//Will grab some data here to encrypt for connection handshake
      , fetchOptions = {headers}				//Used in fetch of that data
this.log.trace("myKey:", myKey)

    if (this.ca) {						//Custom Certificate Authority provided
      let agent = new Https.Agent({ca:this.ca})
      fetchOptions.agent = agent				//So fetch will recognize our site
    }
this.log.debug("Fetching client info from:", clientUri)

    Fetch(clientUri, fetchOptions)				//Do an http fetch of metadata about our 'browser'
      .then(res => res.json())
      .then(info => {
this.log.debug("Client info:", info)

        let { ip, cookie, userAgent, date } = info		//Fodder for what we will digitally sign
          , message = JSON.stringify({ip, cookie, userAgent, date})	//Message object has to be built in exactly this order
          , enc = new TextEncoder
this.log.debug("message:", message)

        Subtle.sign(SignConfig, myKey, enc.encode(message)).then(sign =>{
this.log.debug("sign:", sign)
          let authString = 'sign=' + Buffer.from(sign).toString('base64url') + '&date=' + date
          openWebSocket(authString)
        })
      }).catch(err => {
        this.log.error("Fetch:", err.stack)
      })
  }		//connect
  
  on(event, handler) {						//Configure a callback
this.log.trace("Setting handler:", event)
    switch (event) {
      case 'key':						//When a new key is generated
        this.keyCB = handler
        break
      case 'error':
        this.errCB = handler
        break
      case 'password':
        this.passwordCB = handler
        break
      default:
        error('Unknown event:', event)
    }
  }
}		//class Client

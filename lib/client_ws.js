//Communicate with the wyseman backend by way of a websocket
//Use this or the noise protocol module in conjunction with the client message module
//Copyright WyattERP.org: See LICENSE in the root of this package
// -----------------------------------------------------------------------------
// TODO:
//- Split from client_api
//- Still works in regression test?
//- 
const B64u = require('b64u-lite').toBase64Url
const { TextEncoder } = require('web-encoding')
const defKeyLength = 2048
const UserAgent = "Wyseman Websocket Client API"
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

module.exports = class {
  constructor(resource) {
    this.res		= resource		//Services available in calling environment
    this.httpPort	= resource.httpPort	//Optionally specify where to query for clientinfo
    this.webcrypto	= this.res.webcrypto
    this.subtle		= this.webcrypto ? this.webcrypto.subtle : null
  }		//constructor

  resource(res, ...args) {
    if (this.res[res]) return this.res[res](...args)
  }

  debug(...msgs) {this.resource('debug', ...msgs)}

  uri(credentials, cb) {			//Attempt to connect to backend server
this.debug('Make uri:', credentials)
    const work = (res, rej) => {
      let { proto, host, port } = credentials
        , address = (proto || 'wss') + ':/' + host + ':' + port
        , query = (creds) => {			//Build the URL query
            let qList = []
            ;['user','db','token','pub','sign','date'].forEach(k => {
              if (k in creds) qList.push(k + '=' + creds[k])
            })
            return qList.join('&')
          }

      this.credCheck(credentials)			//Check for token/key info
      .then(() => this.keyCheck(credentials))		//Make sure we have a good key
      .then(() => this.signCheck(credentials))		//Create login signature
      .then(() => {
//this.debug("CR:", credentials)
        res(address + '/?' + query(credentials))	//Build connection websocket URL
      }).catch(err => {
        rej(err)
      })
    }		//work
    return cb ? work(cb.bind(null, undefined), cb) : new Promise(work)	//Use callback or promise
  }
  
  credCheck(creds, cb) {			//Check for, and possibly generate connection keys
    const work = (res, rej) => {
this.debug("Credentials check", creds)
      if (this.res.listen) {			//Pass db config info to connect query
        creds.db = B64u(JSON.stringify(this.res.listen))
      }
      if (creds.key) {				//We already have a private key
        res()
      } else {					//Need to generate one
this.debug("Generating keypair:", creds)
        this.subtle.generateKey(KeyConfig, true, ['sign','verify']).then(keyPair => {
          creds.priv = keyPair.privateKey
          return this.subtle.exportKey('jwk', keyPair.publicKey)
        }).then(pubKey => {
          creds.pub = B64u(JSON.stringify(pubKey))	//Transmit base64 version of jwk
          return this.subtle.exportKey('jwk', creds.priv)
        }).then(privKey => {
          let {host, port, user} = creds
            , trimCreds = {host, port, user, key:privKey}
          creds.key = privKey
          return this.resource('saveKey', trimCreds)	//Let the caller store the new key
        }).then(e => {
//this.debug("  jwk:", Object.keys(pubKey), pubKey, JSON.stringify(pubKey))
          if (e) rej(e); else res()			//Credential now ready to connect with public key
        }).catch(err => {
this.debug("Error in credCheck:", err.message)
          rej(err.message)
        })
      }		//creds.key
    }		//work
    return cb ? work(cb.bind(null, undefined), cb) : new Promise(work)	//Use callback or promise
  }

  keyCheck(creds, cb) {			//Make sure we have a valid cryptoKey in credentials
    const work = (res, rej) => {
//this.debug("Key check")
      if (creds.priv) {			//No work to do here
        res()
      } else if (creds.key) {		//Key is still in json form
//this.debug("Key:", Object.keys(creds.key))
        this.subtle.importKey('jwk', creds.key, KeyConfig, true, ['sign']).then(priv => {
          creds.priv = priv
          res()
        }).catch(err => {
          rej(err)
        })
      }		//creds.priv
    }		//work
    return cb ? work(cb.bind(null, undefined), cb) : new Promise(work)	//Use callback or promise
  }		//keyCheck

  signCheck(creds, cb) {		//Add a current signature with the key
    const work = (res, rej) => {
this.debug("Sign check:", creds)
      if (creds.token) {
        res()			//Don't need to sign if our credential is a connection token
      } else {
        let proto = creds.proto == 'ws' ? 'http' : 'https'
          , httpPort = this.httpPort || (parseInt(creds.port) - 1)	// Default to port just below websocket
          , origin = `${proto}://${creds.host}:${httpPort}`
//this.debug("  fetch:", origin)
        this.resource('fetch', origin + '/clientinfo')
        .then(res => res.json())
        .then(info => {					//this.debug("  Info:", info, typeof info)
          let encoder = new TextEncoder()
            , { ip, cookie, userAgent, date } = info
            , message = JSON.stringify({ip, cookie, userAgent, date})	//Must rebuild in this same order in the backend!
this.debug("  Client data:", info, date, message)
          if (creds.proto == 'ws' || creds.token) {
            res()
          } else {
//this.debug("  Pre-sign:", creds.priv)
            this.subtle.sign(SignConfig, creds.priv, encoder.encode(message)).then((sign)=>{
//this.debug("  signed:", sign, typeof sign, date)
              creds.sign = B64u(sign)
              creds.date = date
              res()
            }).catch(err => {
//this.debug("Error in signCheck:", err.message)
              rej(err.message)
            })
          }	//ws/wss
        })	//fetch
      }		//creds.token
    }		//work
    return cb ? work(cb.bind(null, undefined), cb) : new Promise(work)	//Use callback or promise
  }		//signCheck

}	//Class

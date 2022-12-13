//Encryption routines
//Copyright WyattERP.org: See LICENSE in the root of this package
// -----------------------------------------------------------------------------

module.exports = class {
  constructor(cryptoLib, subtleLib, buffer) {
    this.crypto = cryptoLib
    this.subtle = cryptoLib.subtle || subtleLib
    this.buffer = buffer || require('buffer/').Buffer
  }

  deriveKey(password, salt) {
    salt = salt || this.crypto.getRandomValues(new Uint8Array(8))
    return this.subtle.importKey("raw", this.buffer.from(password), "PBKDF2", false, ["deriveKey"])
      .then(key => this.subtle.deriveKey({
        name: "PBKDF2", 
        salt, 
        iterations: 10000,
        hash: "SHA-256"
      }, key, {
        name: "AES-GCM",
        length: 256
      }, false, ["encrypt", "decrypt"])).then(key => [key, salt])
  }
  
  encrypt(password, plain) {		//Encrypt a string to a JSON-encoded string
    let iv = this.crypto.getRandomValues(new Uint8Array(12))
      , data = this.buffer.from(plain)
    return this.deriveKey(password).then(([key, salt]) =>
      this.subtle.encrypt({ name: "AES-GCM", iv }, key, data).then(ciphertext => (
           '{"s":"' + this.buffer.from(salt).toString('hex')
        + '","i":"' + this.buffer.from(iv).toString('hex')
        + '","d":"' + this.buffer.from(ciphertext).toString('base64')
        + '"}'
      )))
  }

  decrypt(password, encrypted) {	//Decrypt a JSON-encoded string to a string
    let { s, i, d } = JSON.parse(encrypted)
      , salt = this.buffer.from(s, 'hex')
      , iv = this.buffer.from(i, 'hex')
      , data = this.buffer.from(d, 'base64')
    return this.deriveKey(password, salt).then(([key]) => 
      this.subtle.decrypt({ name: "AES-GCM", iv }, key, data)).then(v => 
        this.buffer.from(new Uint8Array(v)).toString())
  }
}

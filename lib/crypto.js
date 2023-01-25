//Crypto algorithm parameters
//Copyright WyattERP.org: See LICENSE in the root of this package
// -----------------------------------------------------------------------------
const KeyConfig = {
  name: 'ECDSA',
  namedCurve: 'P-521'
}

const SignConfig = {
  name: 'ECDSA',
  hash: {name: 'SHA-384'}
}

//const KeyConfig = {
//  name: 'RSA-PSS',
//  modulusLength: 2048,
//  publicExponent: new Uint8Array([1,0,1]),
//  hash: 'SHA-256'
//}

//const SignConfig = {		//For signing with RSA-PSS
//  name: 'RSA-PSS',
//  saltLength: 128
//}

module.exports = {
  KeyConfig,
  SignConfig
}

//Basic logging if nothing else provided
//Copyright WyattERP: see: License in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- 
var logger = require('util').debuglog('db')

module.exports = {
  trace: (...msg) => logger(msg.join(' ')),
  debug: (...msg) => logger(msg.join(' ')),
  error: (...msg) => console.error(...msg)
}

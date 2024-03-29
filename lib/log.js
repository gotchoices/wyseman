//Basic logging if nothing else provided
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//Usage: export NODE_DEBUG=db		//for console debugging
//- 
var logger = require('util').debuglog('db')

module.exports = {
  trace: (...msg) => logger(msg.join(' ')),
  debug: (...msg) => logger(msg.join(' ')),
  verbose: (...msg) => logger(msg.join(' ')),
  error: (...msg) => console.error(...msg)
}

//Simple logging for our tests

module.exports = function(modname) {
  this.logger = require('util').debuglog(modname)
  
  this.trace = function(...msg) {
    this.logger(msg.join(' '))
  }
  this.debug = function(...msg) {
    this.logger(msg.join(' '))
  }
  this.error = function(...msg) {
    console.error(...msg)
  }
}

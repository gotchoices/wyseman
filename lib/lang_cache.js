//Maintain a cache of language data on various views to avoid duplicate queries
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- If cache data not present, generate a backend query to fetch it (how?)
//- Should we also cache metadata?

var	langCache	= {}
var	log = require('./log')		//Fixme: not using passed-in logging
var	requestCB

//Singleton instance watches language queries for all connections
module.exports = {
  request: function(cb) {		//Register a routine that can refresh view data
    requestCB = cb
  },
  
  checkLanguage: function(language) {	//Make sure there is at least an empty object for this language
    if (langCache[language] === undefined)
      langCache[language] = {}
    return langCache[language]
  },

  refresh: function(language, view, data) {	//Store this view's language data
    let lc = this.checkLanguage(language)
    lc[view] = data
//log.debug("LC Refresh:", language, view, data)
  },
  
  view: function(language, view) {		//Return data for this view
//log.debug("LC view:", language, view)
    let lc = this.checkLanguage(language)
    return lc[view]
  },

  checkView: function(language, view) {		//Make sure there is data for a view
//log.debug("LC checkView:", language, view)
    let lc = this.checkLanguage(language)
    if (lc[view] === undefined) {
      if (requestCB) {
        requestCB(language, view)
      }
    }
    return lc[view]
  },

  messages: function(language, view) {		//Return just messages for this view
    let lv = this.checkView(language, view)
    return lv?.messages ?? []
  },

  message: function(language, view, code) {	//Return a single message object for this view
//log.debug("LC message:", language, view, code)
    let lv = this.checkView(language, view)
      , m = lv?.messages?.find(el => (el.code == code))
    return m ?? {}
  }
}

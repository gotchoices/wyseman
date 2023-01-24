//Maintain a cache of language data on various views to avoid duplicate queries
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- If cache data not present, generate a backend query to fetch it (how?)
//- Should we also cache metadata?

var	langCache	= {}
var	log = require('./log')		//Fixme: not using passed-in logging

//Singleton instance watches language queries for all connections
module.exports = {
  checkLanguage: function(language) {	//Make sure there is at least an empty object for this language
    if (langCache[language] === undefined)
      langCache[language] = {}
    return langCache[language]
  },

  refresh: function(language, view, data) {	//Store this language data
    let lc = this.checkLanguage(language)
    lc[view] = data
//log.debug("LC Refresh:", view, data)
  },
  
  view: function(language, view) {		//Return all language data for this view
    let lc = this.checkLanguage(language)
//log.debug("LC view:", language, view)
    return lc[view]
  },

  messages: function(language, view) {		//Return just messages for this view
    let lc = this.checkLanguage(language)
    return lc[view]?.messages ?? []
  },

  message: function(language, view, code) {	//Return a single message object for this view
//log.debug("LC message:", language, view, code)
    let lc = this.checkLanguage(language)
      , m = lc[view]?.messages?.find(el => (el.code == code))
    return m ?? {}
  }
}

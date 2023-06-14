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

  view: function(language, view) {		//Return data for this view or undefined if not cached
//log.debug("LC view:", language, view)
    let lc = this.checkLanguage(language)
    return lc[view]
  },

  refresh: function(language, view, data) {	//Store this view's language data
    let lc = this.checkLanguage(language)
    lc[view] = data
//log.debug("LC Refresh:", language, view, data)
  },
  
  viewData: function(language, view, cb) {	//Return language data for a view
//log.debug("LC checkView:", language, view)
    let lc = this.checkLanguage(language)
      , finder = code => {				//Routine for returning a message object from its code
          let lv = lc[view]
            , message = lv?.messages?.find(el => (el.code == code))
          return message ?? {}
      }
    if (lc[view] === undefined && requestCB) {
      requestCB(language, view, () => cb(lc[view], finder))	//Call back with data when available
    } else {
      cb (lc[view], finder)
    }
  },

//  messages: function(language, view) {		//Return just messages for this view
//    let lv = this.checkView(language, view)
//    return lv?.messages ?? []
//  },

//  message: function(language, view, code) {	//Return a single message object for this view
//log.debug("LC message:", language, view, code)
//    let lv = this.checkView(language, view)
//      , m = lv?.messages?.find(el => (el.code == code))
//    return m ?? {}
//  }
}

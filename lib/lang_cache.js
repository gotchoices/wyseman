//Maintain a cache of language data on various views to avoid duplicate queries
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//X- If cache data not present, generate a backend query to fetch it (how?)
//X- Should we also cache metadata?
//X- Make init function: call clear, establish logging channel
//- Refactor reports to use lookup function like meta_cache

var	langCache	= {}
var	log = function() {}
var	requestCB

//Singleton instance watches language queries for all connections
module.exports = {
  request: function(cb, logger) {		//Register a routine that can refresh view data
    requestCB = cb
    log = logger
  },
  
  refetch: function() {				//Refetch all loaded languages/views from DB
//log.debug('LR:', Object.keys(langCache))
    if (requestCB)
      Object.keys(langCache).forEach(l => {
        Object.keys(langCache[l]).forEach(v => requestCB(l, v))
      })
  },
  
  clear: function() {
    langCache = {}
  },
  
  checkLanguage: function(language) {	//Make sure there is at least an empty object for this language
    if (langCache[language] === undefined)
      langCache[language] = {}
    return langCache[language]
  },

  view: function(language, view) {		//Return data for this view or undefined if not cached
    let lc = this.checkLanguage(language)	//;log.debug("LC view:", language, view)
    return lc[view]
  },

  refresh: function(language, view, data) {	//Store this view's language data
    let lc = this.checkLanguage(language)
      , col = {}
      , msg = {}
    data?.columns?.forEach(c => {		//;log.debug("LC c:", c)
      col[c.col] = c
    })
    data?.messages?.forEach(m => {		//;log.debug("LM m:", m)
      msg[m.code] = m
    })
    lc[view] = Object.assign({col, msg}, data)
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
}

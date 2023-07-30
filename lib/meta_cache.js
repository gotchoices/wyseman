//Maintain a cache of metadata on various views to avoid duplicate queries
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//X- If cache data not present, generate a backend query to fetch it (how?)
//X- Make init function: call clear, establish logging channel
//- Clear cache on update of data dictionary

var	metaCache	= {}		//Raw query cache
var	lookup		= {}		//Includes lookup table by column name
var	log = function() {}
var	requestCB

//Singleton instance watches metadata queries for all connections
module.exports = {
  request: function(cb, logger) {		//Register a routine that can refresh view data
    requestCB = cb
    log = logger
  },
  
  refetch: function() {				//Refetch all loaded views from DB
    if (requestCB)
      Object.keys(metaCache).forEach(v => requestCB())
  },
  
  clear: function() {
    metaCache = {}
  },
  
  view: function(view) {		//Return data for this view or undefined if not cached
    return metaCache[view]		//;log.debug("MC view:", view)
  },

  refresh: function(view, data) {	//Store this view's metadata
    let col = {}			//Make lookup table by column name
    metaCache[view] = data		//;log.debug("MC Refresh:", view, data)
    data.columns.forEach(c => {		//;log.debug("MC c:", c)
      col[c.col] = c
    })
    lookup[view] = Object.assign({col}, data)
  },
  
  lookup: function(view) {		//Return metadata for a view
    return lookup[view]
  },
  
  viewData: function(view, cb) {			//Return metadata for a view
    if (metaCache[view] === undefined && requestCB) {
      requestCB(view, () => cb(lookup[view]))		//Call back with data when available
    } else {
      cb (lookup[view])
    }
  },

}

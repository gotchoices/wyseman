//Client side module to track messages to/from the backend
//Also caches data dictionary and language information
//Copyright WyattERP.org: See LICENSE in the root of this package
// -----------------------------------------------------------------------------
//A UI element can generate a request for data from the backend containing:
//  id: A unique ID indicating the UI element or message ID
//  action: connect, select, insert, update, delete, action, meta, lang, etc.
//  cb: if a callback is given, we will store it until a response comes back tagged with the same id

module.exports = class {
  constructor(localStore, config) {
    this.localStore	= localStore		//Can set/get on device local storage
    this.debug 		= config?.debug || (() => {})
    this.language	= config?.language || 'eng'	//Current language
    
    this.sender		= null			//Routine to send data to backend
    this.address	= null			//To remember node:port when we are currently connected
    
    this.sendQue	= []			//Backlog of commands to send (in cases where channel is not yet available)
    this.handlers	= {}			//Callbacks waiting for responses from the backend
    this.langCache	= {}			//Store all language queries we have done
    this.metaCache	= {}			//Store all table meta-data we have done
    this.pending	= {meta: {}, lang:{}}	//Remember details of pending requests
    this.callbacks	= {}			//Callbacks waiting for meta/language changes
    this.listens	= {}			//Callbacks waiting for async messages
    this.localCache	= {}			//Temporary cache just for calls from localStorage
    
    this.langCache[this.language] = {}
    this.cache = {meta: this.metaCache, lang: this.langCache[this.language]}
  }		//constructor

  onClose() {					//Call if socket connection broken
    this.notify(this.address = null)
  }

  onOpen(address, sender) {			//Call when socket is open and ready to use
this.debug('Server open:', !!sender)
    this.sender = sender
    this.notify(this.address = address)		//Tell any listeners we're connected
    this.procQueue()				//Process any queued requests
  }

  onMessage(msg) {				//Call with packets from the server
//this.debug('Server message:', msg)
    let pkt; try {pkt = JSON.parse(msg)} catch(e) {	//Parse it to a JSON object
      this.debug("Parsing JSON from db: ", msg)
      return
    }
    let {id, view, action, data, error} = pkt

this.debug('Message from server: ', pkt, id, action, error)
    if (action == 'notify' && pkt.channel) {
      let chan = pkt.channel
      if (this.listens[chan]) Object.values(this.listens[chan]).forEach(cb => {
//this.debug('Notify group: ', chan, data)
        cb(data)				//Call any listeners
      })
    }	// notify

    if (!id || !view || !action) return		//Invalid packet

    if (data && (action == 'meta' || action == 'lang')) {	//Special handling for meta and language data
      this.procColumns(data)			//Reorganize columns array as object
      let index = action + '~' + view		//Where we will save in local storage
      if (action == 'lang') {
//this.debug(" opt.language:", id, this.handlers[id], this.handlers[id].lang.language)
        let language = this.handlers[id].lang.language || 'eng'
        index = 'lang_' + language + '~' + view	//Save each language separately
        this.procMessages(data)			//Reorganize messages array as object
        this.langCache[language][view] = data	//Cache language data for this view
      } else {					//action == meta
//this.debug(" meta data:", data)
        this.metaCache[view] = data			//Cache meta data
        this.linkLang(view)				//Can access language information from the view meta data
        if (data.styles && data.styles.subviews) data.styles.subviews.forEach((sv, ix)=>{	//We will be needing meta data for these sub-views too
//this.debug("  meta subview:", sv)
          let svName = (typeof sv == 'string') ? sv : sv.view
            , inCache = this.metaCache[svName]
          if (inCache) {
            data.styles.subviews.splice(ix, 1, {view:svName, lang:{title:inCache.title, help:inCache.help}})
          } else {
            this.request(view + '~' + ix, 'meta', sv, dat=>{
//this.debug("   got subview meta:", dat)
              data.styles.subviews.splice(ix, 1, {view:sv, lang:{title:dat.title, help:dat.help}})
            })
           }
        })
//Fixme: also request language for any subordinate views?
      }

//this.debug("To localStorage:", index)
      this.localStore.set(index, data)			//Save also to browser cache
      delete this.localCache[index]			//Free up this cache, not needed now
      this.pending[action][view] = false		//Mark pending as now complete
      setTimeout(() => {this.procQueue()}, 50)	//See if any other meta commands are queued up
    }	// meta || lang

    if (this.handlers[id] && this.handlers[id][action] && this.handlers[id][action].cb) {	//If we have a registered handler,
//this.debug("Calling handler:", id, action, "data:", data, "error:", error)
      if (error?.code?.match(/^![\w.]+:\w/)) {		//Is there a language tag that needs translation
        let [ errView, code ] = error.code.slice(1).split(':')
          , cache = this.cache.lang[errView]
//this.debug("Found error:", error, errView, code, cache)
        if (!cache) {						//If we don't already have it
          this.request('_wm_E_' + id, 'lang', {language: this.language, view: errView}, (d,e) => {
            let clv = this.cache.lang[errView]			//Get it and cache it
            if (clv.msg[code])		//No guaranty this language query worked (do we need to check for secondary errors?)
              error.lang = clv.msg[code]
//this.debug("Now have:", error, errView, code, clv)
            this.handlers[id][action].cb(data, error)		//Execute call back
          })
          return
        } else if (cache.msg[code]) {				//We have it cached
          error.lang = cache.msg[code]				//So just provide translation
        }
      }
      this.handlers[id][action].cb(data, error)	//call back with what language info we may or may not have, will call back again (above) when we have language data
    }			//handle message
  }			//message

  procQueue() {			//Try to send pending outbound messages waiting in the queue
//this.debug('Processing queue:')
    let p, i, len = this.sendQue.length		//Handle only what is queued when we first enter this function
    for (i = 0; i < len; i++) {			//Else we can go into a perpetual loop
      p = this.sendQue.shift()
//this.debug('  queue item:' + JSON.stringify(p) + " Len: ", this.sendQue.length)
      this.request(...p)
    }
  }

  procColumns(data) {				//Reindex columns array into column object
    if (!data) return
//this.debug('Store meta/lang:', data)
    if (!data.columns) data.columns = []
    if (!data.col) data.col = {}		//Make node of columns indexed by col
    data.columns.forEach((rec, idx) => {data.col[rec['col']] = data.columns[idx]})
  }

  procMessages(data) {				//Reindex messages array into message object
    if (!data) return
    if (!data.messages) data.messages = []
    if (!data.msg) data.msg = {}		//Make index of messages indexed by language tag
    let msg = data.msg
    if (!msg.help) msg.h = {}			//Also make objects of just helps
    if (!msg.title) msg.t = {}			//and just titles
    data.messages.forEach((rec, idx) => {
      let code = rec.code
//this.debug("Proc msg:", code, rec)
      msg[code] = data.messages[idx]
      msg.h[code] = rec.help
      msg.t[code] = rec.title
    })
  }

  linkLang(view) {				//Merge in table language data
    let lang = this.cache.lang[view]
      , meta = this.cache.meta[view]
    if (!lang || !meta) return			//No language data...
//this.debug("LinkLang\n  lang:", lang, "  meta:", meta)
    if (!meta.msg) meta.msg = {}
    if (lang.msg) Object.assign(meta.msg,lang.msg)
    if (lang.help) meta.help = lang.help
    if (lang.title) meta.title = lang.title
    Object.keys(meta.col).forEach((key) => {
      if (lang.col[key]) Object.assign(meta.col[key], lang.col[key])
    })
    if (meta.styles && meta.styles.actions) meta.styles.actions.forEach(act=>{
//this.debug(" lact:", act, act.render)
      act.lang = meta.msg[act.name]

      if (act.options) act.options.forEach((opt,x)=>{	//Link to language for action options
//this.debug(" lopt:", opt)
        let langTag = act.name + '.' + opt.tag		//Re-structure to look more like native table column data structure
          , newElem = {field: opt.tag, lang: lang.msg[langTag], type: opt.type, styles: opt}
        if (opt.values) {				//This option has predefined values
          let values = []
          opt.values.forEach(value => {			//Get their language info
            let valTag = langTag + '.' + value		//;this.debug( "lval:", value, lang.msg[valTag])
              , lm = lang.msg[valTag]
            values.push({value, title:lm?.title, help:lm?.help})
          })
          delete opt.values
          newElem.values = values			//Include value options with language info
        }
        delete opt.tag
        act.options[x] = newElem
//this.debug("  act:", act, x, act.name, newElem)
      })
    })
  }

  langDefs(langObj, defaults) {		//Create a default language object from defaults
    if (!langObj) langObj = {}
    if (!langObj.h) langObj.h = {}
    if (!langObj.t) langObj.t = {}
    Object.keys(defaults).forEach(key=>{
      langObj[key] = defaults[key]
      langObj.h[key] = defaults[key].help
      langObj.t[key] = defaults[key].title
    })
//this.debug('langDefs:', langObj)
    return langObj
  }

  request(id, action, opt, cb) {		//Ask to receive specified CRUD+ information back asynchronously
    if (typeof opt === 'string') {opt = {view: opt}}	//Shortcut: can supply view rather than full options object
this.debug("Request ID:", id, "Action:", action, "Opt", JSON.stringify(opt).slice(0,128), !!this.sender)
    let view = (opt ? opt.view : null)
    if (!this.sender) {					//If connection not yet open
      this.sendQue.push([id,action,opt,cb])		//Queue the request for later

      if (action != 'connect') {
        let data, idx = action + '~' + view		//Where saved in local storage
        if (this.localCache[idx]) {			//Did we already fetch this from local storage once?
//this.debug("From localCache:", idx, data)
          data = this.localCache[idx]
        } else {					//Use any historic value from browser for now
//this.debug("From localStorage?:", idx, data)
          let localVal = this.localStore.get(idx)
          if (localVal !== undefined) this.localCache[idx] = localVal
          data = this.localCache[idx]
        }
        if (data && cb) cb(data)			//Call back with cached (possibly obsolete) data
      }
      return						//Nothing else we can do until connection made
    }

this.debug("  processing: ", action, " View:", view)
    if (action == 'meta') {
      if (!this.cache.lang[view])		//Force language request before our meta data requested
        this.request('_wm_L_' + id, 'lang', {language: this.language, view})
    }

    if (action == 'meta' || action == 'lang') {
      if (this.cache[action][view]) {			//If we already have this data in the cache
//this.debug("  got data from cache:", action, view, this.cache[action][view])
        if (cb) cb(this.cache[action][view])		//Use it
        return
      } else if (this.pending[action][view]) {		//If there is already a pending meta request for this view
        this.sendQue.push([id, action, opt, cb])	//Queue the request for later, see if the first request succeeds
//this.debug("  queuing data request:", action, view)
        return
      }
//this.debug("  will send request: ", action, view)
      this.pending[action][view] = true			//Note a pending meta request for this view
      setTimeout(() => {this.pending[action][view] = false}, 5000)	//Can retry after 5 seconds and on next queue check
    }
      
    let hand = this.handlers
    if (!hand[id]) hand[id] = {}			//If no handlers for this id yet
    if (!hand[id][action]) hand[id][action] = {}	//If no handler for this id, action yet
    Object.assign(hand[id][action], opt, {cb})		//Remember the options from this request
    
    if (action == 'connect') {				//Don't actually send a packet for connection status requests
      if (cb) cb(this.address)				//Just update with our address, if anyone registered to get the callback
      return
    }
    if (action == 'action') {				//Give control layer current language
      if (opt.lang === undefined) opt.language = this.language
    }
    let msg = Object.assign({id, action}, opt)		//Construct message packet
this.debug("Write to backend:", "Data:" + JSON.stringify(msg).slice(0,128))

    if (this.sender) {
      let fields = opt.fields
      if (fields) Object.keys(fields).forEach(f => {	//check for any binary data in fields
        let fieldData = fields[f]
        if (ArrayBuffer.isView(fieldData)) {		//It is a binary array
this.debug("Binary field:", f)
          let binary = ''
            , bytes = new Uint8Array(fieldData)
            , length = bytes.length
          for (let i = 0; i < length; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          fields[f] = {
            _type_: 'binary',
            _data_: btoa(binary),
            _name_: fieldData.constructor?.name
          }
        }	//isView
      })	//forEach
      this.sender(JSON.stringify(msg))			//send it to the back end
    }
  }	//request

  notify(addr) {		//Tell any registered parties about our connection status
//this.debug("Notify: " + addr + " Hands: ", this.handlers)
    Object.keys(this.handlers).forEach( id => {
      let tc = this.handlers[id].connect
      if (tc && tc.cb) {
        tc.cb(addr)
        if (!tc.stay) delete this.handlers[id].connect
      }
    })
  }

  register(id, view, cb) {	//Register to receive a callback whenever view metadata updates
    if (!cb && this.callbacks[view] && this.callbacks[view][id]) {
      delete this.callbacks[view][id]
      return
    }
//this.debug("Register:", id, view)
    if (!this.callbacks[view]) this.callbacks[view] = {}
    this.callbacks[view][id] = cb
    this.request(id + '~' + view, 'meta', view, cb)
  }

  listen(id, chan, cb) {	//Register to receive a call whenever asynchronous DB notify events generated
    if (!cb && this.listens[chan] && this.listens[chan][id]) {
      delete this.listens[chan][id]
      return
    }
    if (!this.listens[chan]) this.listens[chan] = {}
//this.debug("Listening for:", id, chan)
    this.listens[chan][id] = cb
  }

  newLanguage(language) {		//Call here if our language preference changes
this.debug("Wyseman new language:", language)
    this.language = language
    if (!this.langCache[language]) this.langCache[language] = {}
    this.cache.lang = this.langCache[language]	//Point to stored data in the new language
  
    let view = 'wylib.data'
    this.request('_wyseman_' + view, 'lang', {language, view})
    
    Object.keys(this.cache.meta).forEach((view) => {	//Fetch all necessary text in new language
      this.request('_wyseman_' + view, 'lang', {language, view}, (data) => {
        this.linkLang(view)
//this.debug("  got new language for:", view, data)
        if (this.callbacks[view]) Object.keys(this.callbacks[view]).forEach(id => {
//this.debug("    CB:", view, id, this.metaCache[view])
          this.callbacks[view][id](this.metaCache[view])
        })
      })
    })
  }	//newLanguage

}	//Class

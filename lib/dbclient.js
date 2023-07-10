//Low level connection to PostgreSQL database
//Copyright WyattERP.org; See license in root of this package
//If the specified database doesn't exist, create it.
//If the bootstrap schema doesn't exist, create that too.
//Then, return an object that can process queries, creating and/or maintaining a client connection as needed
// -----------------------------------------------------------------------------
//TODO:
//- If schema initialization SQL fails, and we created the DB, should we then delete it?
//- If Postgres restarted, we lose our connection.  Is there a way to recover/reconnect?
//- 
const	DefaultDB		= 'template1'
const	Fs			= require('fs')		//Node filesystem module
const	{ Client, types }	= require('pg')		//PostgreSQL
const	Format			= require('pg-format')	//String formatting/escaping
const	Schema			= require('./schema')	//Handles json schema files
const	RetryTimeout		= 10000			//How long to wait for connection retry
var	initialize		= true			//Next user should try to init DB if necessary
var	connectQue		= []

types.setTypeParser(1082, d=>(d))			//Don't convert simple dates to JS date/time
types.setTypeParser(20, v=>(parseInt(v)))		//Convert int8 to Number; this breaks on numbers > 2^53!

module.exports = class dbClient {
  constructor(conf, notifyCB, connectCB) {
    this.log = conf.log || require('./log')
    if (!conf.schema) conf.update = false
    if (conf.update) conf.connect = true
    this.config = Object.assign({}, conf)		//Private copy for this instance
    delete this.config.log

    this.notifyCB = notifyCB
    this.connectCB = connectCB
    this.client = null
    this.queryQue = []					//Que of queries waiting for DB to connect
    this.connecting = false
this.log.debug('dbClient listen:', this.config.listen, typeof(this.config.listen))
    if (this.config.listen && !Array.isArray(this.config.listen)) this.config.listen = [this.config.listen]
    if (this.config.listen || this.config.connect) this.connect(() => {	//Connect now so we can listen
      let q; while (q = this.queryQue.shift()) this.query(...q)	//And process the queue
      if (this.connectCB) this.connectCB()
    })
  }

// -----------------------------------------------------------------------------
  disconnect() {					//Disconnect from the database (if connected)
    this.log.debug("DB client disconnect")
    if (this.client) this.client.end()
    this.client = null
  }
  
// -----------------------------------------------------------------------------
  newClient() {						//Get a fresh client for this connection
    this.client = new Client(this.config)
this.log.verbose("New DB client config:", this.config)
    if (this.config.listen && this.queryQue.length <= 0) {
      this.config.listen.forEach(listen=>{
        this.log.debug("Listening on DB channel:", listen);
        this.queryQue.push(["listen " + Format.ident(listen)])		//Register with the DB
      })
      if (this.notifyCB) this.client.on('notification', msg => {	//Handle callbacks: 3rd parameter tells if this notify was a result of one of my own queries (as opposed to someone else)
//        this.log.trace("DBclient notification:", msg);
        if (this.client) this.notifyCB(msg.channel, msg.payload, msg.processId == this.client.processID)
      })
    }
    this.client.on('error', err => {
      this.log.trace("Unexpected error from database:", err.message)
      this.disconnect()					//Is there a way to recover from this?
    })
  }
  
// -----------------------------------------------------------------------------
  connect(cb) {
    var fatal = (message) => {this.log.error("Fatal database error: " + message); return {message}}

    if (!this.client) this.newClient()

    this.connecting = true
    this.client.connect(err => {			//Make connection to DB for this client
      if (!err) {					//Success
        this.update(() => {				//Check for need to update
          cb()						//Call my callback
          this.connecting = false
          if (this.config.schema) while (connectQue.length > 0) {	//Master responsible for reconnecting any other clients
            let { context, cb } = connectQue.shift()
            context.connect(cb)
          }
        })
        return
      }
      
      this.log.debug("DB connection error:", err.message)		//Failed to connect
      let dbname = this.client.connectionParameters.database		//Remember DB we tried to connect to
      this.disconnect()
      if (!this.config.schema) {			//Caller is not the master (has no ability to build schema)
        this.log.debug("Queing connection")
        connectQue.push({context:this, cb})		//Wait for master to connect
        return
      }
      
      if (!/database .* does not exist/.test(err.message)) {		//Retry in a while
        if (!this.config.retry) this.config.retry = 0
this.log.debug("Retry", this.config.retry, "in:", RetryTimeout)
        this.config.retry++
        setTimeout(()=>{this.connect(cb)}, RetryTimeout)
        return
      }
      
      let tclient = new Client(Object.assign({}, this.config, {database: DefaultDB}))
      tclient.connect(err => {						//Try connecting to template DB
        if (err) {tclient.end(); fatal(err.message); return}
        this.log.debug("Will create DB with name:", dbname)
        
        tclient.query("create database \"" + dbname + "\"", err => {	//Try to create our database
          tclient.end()							//Done with temporary client
          if (err) {fatal("Creating database " + dbname + ": (" + err + ")"); return}
          this.log.debug("Initialize Schema:", this.config.schema)
          
          Fs.readFile(this.config.schema, 'utf8', (err, schemaData) => {
            if (err) {fatal("Can't open schema file: " + this.config.schema); return}
            this.log.trace("Have schema file data, will try connect again")
            
            this.newClient()					//Now try connecting again with a new client
            this.client.connect(err => {
              if (err) {fatal("Connecting to new DB: " + err.message); return}
              this.log.debug("Connected OK; Building schema")
              
              if (schemaData[0] == '{') try {			//Schema is in JSON format
                let schema = new Schema({from: JSON.parse(schemaData)})
//this.log.debug("JSON schema:", schema)
                schemaData = schema.loader()			//Build a self-loader file
              } catch (e) {
                fatal("Could not build schema loader: " + e.stack); return
              }

              this.t(schemaData, (err, res) => {		//Attempt to build our schema
                if (err) {fatal("In schema (" + this.config.schema + "): " + err.message); return}
                this.log.trace("New schema created")
                this.connecting = false
                cb()		//Success for this connection
                while (connectQue.length > 0) {			//Now connect any other clients waiting for schema to build
                  let { context, cb } = connectQue.shift()
                  context.connect(cb)
                }
              })		//query to build schema
            })			//new client.connect
          })			//readFile
        })			//create DB query
      })			//tclient connect
    })				//client.connect
  }				//connect()
    

// -------------------------------------------------------------------
  query(...args) {		// Attempt a DB query with callback.
    this.log.trace("Query:", this.config.user, args[0].substr(0,256), args[1])
    if (this.client && this.client._connected) {	//If connection ready, run the query
      return this.client.query(...args)
    } else {						// else queue the command for later
      this.queryQue.push(args)
      this.log.trace("  queueing query: ", this.queryQue.length)
      if (!this.connecting) this.connect(() => {			//Get this client connected
          let q; while (q = this.queryQue.shift()) this.query(...q)	//And process the queue
      })
    }
  }

// -------------------------------------------------------------------
  t(...args) {			// Wrap a callback query in a transaction
    args[0] = 'begin; ' + args[0] + '; commit;'
    this.query(...args)
  }

// -------------------------------------------------------------------
  async pquery(...args) {		// Query DB returning promise/rows
    this.log.trace("Exec:", this.config.user, args[0].substr(0,256), args[1])

    if (!this.client) {
      await new Promise(resolve => this.connect(resolve))
    } else if (this.client._connected) {
    } else {
      while (this.connecting) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    }
    
    let result = await this.client.query(...args)
//this.log.trace('F:', Object.keys(result), JSON.stringify(result))
    return result.rows
  }

// Check the running database and compare to our schema
// -----------------------------------------------------------------------------
  update(cb) {
    let fatal = (...msgs) => {this.log.error("Fatal error: ", ...msgs)}
    if (!this.config.update) {cb(); return}
    
this.log.debug('UpChk:', !!this.config.schema)
    if (this.config.schema) Fs.readFile(this.config.schema, 'utf8', (err, schemaData) => {
      if (err) {fatal("Can't open schema file:", this.config.schema); return}
      let schema; try {
        schema = new Schema({from: JSON.parse(schemaData)})
      } catch(e) {
        fatal("Error parsing schema file:", this.config.schema, '; ', e.message); return
      }
      this.client.query('select wm.last(), wm.next()', (err, res) => {
        if (err) {fatal("Failure querying database release:", err.message); return}
        let { last, next } = res.rows[0] || {}
        if (next != last) {fatal("Can't update a development database:", last, next); return}
this.log.debug(' Found schema release:', last, next, 'Current:', schema.release)
        let sql = schema.updater()

        this.t(sql, (err, res) => {			//Attempt to update our schema
          if (err) {fatal("In schema (" + this.config.schema + "):", err.message); return}
          this.log.trace("Schema updated to release:", schema.release)
          cb()		//Success, can proceed
        })		//query to update schema
      })		//query release
    })			//read schema file
  }

}	//class

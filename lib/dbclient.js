//Low level connection to PostgreSQL database
//Copyright WyattERP.org; See license in root of this package
//If the specified database doesn't exist, create it.
//If the bootstrap schema doesn't exist, create that too.
//Then, return an object that can process queries, creating and/or maintaining a client connection as needed
// -----------------------------------------------------------------------------
//TODO:
//X- Split low level code out from UI module
//- If schema initialization SQL fails, and we created the DB, should we then delete it?
//- 
const	DefaultDB		= 'template1'
const	Fs			= require('fs')		//Node filesystem module
const	{ Client, types }	= require('pg')		//PostgreSQL
const	Format			= require('pg-format')	//String formatting/escaping
var	initialize		= true			//Next user should try to init DB if necessary

types.setTypeParser(1082, d=>(d))			//Don't convert simple dates to JS date/time

module.exports = class dbClient {
  constructor(conf, notifyCB, connectCB) {
    this.log = conf.log || require('./log')
    delete conf.log
    this.config = conf
    this.notifyCB = notifyCB
    this.connectCB = connectCB
    this.client = null
    this.queryQue = []					//Que of queries waiting for DB to connect
    this.connecting = false

    if (conf.listen && !Array.isArray(conf.listen)) conf.listen = [conf.listen]
    if (conf.listen) this.connect(() => {		//Connect now so we can listen
      let q; while (q = this.queryQue.shift()) this.query(...q)	//And process the queue
      if (this.connectCB) this.connectCB()
    })
    this.log.trace("New database client:", conf.database)
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
    this.log.trace("New DB client config:", this.config)
    if (this.config.listen && this.queryQue.length <= 0) {
      this.config.listen.forEach(listen=>{
        this.log.debug("Listening on DB channel:", listen);
        this.queryQue.push(["listen " + Format.ident(listen)])		//Register with the DB
      })
      if (this.notifyCB) this.client.on('notification', msg => {	//Handle callbacks: 3rd parameter tells if this notify was a result of one of my own queries (as opposed to someone else)
//        this.log.trace("DB notification:", msg);
        if (this.client) this.notifyCB(msg.channel, msg.payload, msg.processId == this.client.processID)
      })
    }
  }
  
// -----------------------------------------------------------------------------
  connect(cb) {
    var fatal = (message) => {this.log.error("Fatal database error: " + message); return {message}}

    if (!this.client) this.newClient()

    this.connecting = true
    this.client.connect(err => {			//Make connection to DB for this client
      if (!err) {cb(); this.connecting = false; return}			//Success

      this.log.debug("DB connection error:", err.message)
      let dbname = this.client.connectionParameters.database		//DB we tried to connect to
      this.disconnect()
      if (!/database .* does not exist/.test(err.message)) {fatal(err.message); return}		//Abort on anything other than DB does not exist error
      if (!this.config.schema) {fatal('No schema found'); return}	//No schema found to create

      let tclient = new Client(Object.assign({}, this.config, {database: DefaultDB}))
      tclient.connect(err => {						//Try connecting to template DB
        if (err) {tclient.end(); fatal(err.message); return}
        this.log.debug("Will create DB with name:", dbname)
        
        tclient.query("create database \"" + dbname + "\"", err => {	//Try to create our database
          tclient.end()							//Done with temporary client
          if (err) {fatal("Creating database " + dbname + ": (" + err + ")"); return}
          this.log.debug("Initialize Schema:", this.config.schema)
          
          Fs.readFile(this.config.schema, 'utf8', (err, dat) => {
            if (err) {fatal("Can't open schema file: " + this.config.schema); return}
            this.log.trace("Have schema file data, will try connect again")
            
            this.newClient()						//Now try connecting again with a new client
            this.client.connect(err => {
              if (err) {fatal("Connecting to new DB: " + err.message); return}
              this.log.debug("Connected OK; Building schema")

              this.t(dat, (err, res) => {			//Attempt to build our schema
                if (err) {fatal("In schema (" + this.config.schema + "): " + err.message); return}
                this.log.trace("New schema created")
                this.connecting = false
                cb()		//Success
              })		//query to build schema
            })			//new client.connect
          })			//readFile
        })			//create DB query
      })			//tclient connect
    })				//client.connect
  }				//connect()
    

// -------------------------------------------------------------------
  query(...args) {				// Attempt a DB query.  If not yet connected, queue the request and attempt to connect
    this.log.trace("Query:", args[0].substr(0,256), args[1])
    if (this.client && this.client._connected) {	//If connection ready, run the query
      this.client.query(...args)
    } else {						// else save the command for later
      this.queryQue.push(args)
      this.log.trace("  queueing it: ", this.queryQue.length)
      if (!this.connecting) this.connect(() => {			//Get this client connected
          let q; while (q = this.queryQue.shift()) this.query(...q)	//And process the queue
      })
    }
  }				//query()

// -------------------------------------------------------------------
  t(...args) {					// Wrap a query in a transaction
    args[0] = 'begin; ' + args[0] + '; commit;'
    this.query(...args)
  }				//t()

}				//class dbClient

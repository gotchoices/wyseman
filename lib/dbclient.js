//Low level connection to PostgreSQL database
//If the specified database doesn't exist, create it.
//If the bootstrap schema doesn't exist, create that too.
//Then, return an object that can process queries, creating and/or maintaining a client connection as needed
//Copyright WyattERP: GNU GPL Ver 3; see: License in root of this package
// -----------------------------------------------------------------------------
//TODO:
//X- Split low level code out from UI module
//- If schema initialization SQL fails, and we created the DB, should we then delete it?
//- 
const	DefaultDB	= 'template1'
const	Fs		= require('fs')			//Node filesystem module
const	{ Client }	= require('pg')			//PostgreSQL
const	Format		= require('pg-format')		//String formatting/escaping
var	initialize	= true				//Next user should try to init DB if necessary

module.exports = class dbClient {
  constructor(conf, notifyCB, connectCB) {
    if (conf.logger) {
      this.log = conf.logger				//Use a passed-in logger
      delete conf.logger
    } else {
      let logger = require('util').debuglog('db')	//Or default to our own
      this.log = {
        trace: msg => logger(msg),
        debug: msg => logger(msg),
        error: msg => console.error(msg)
      }
    }
this.log.trace("Config:", conf)
    this.config = conf
    this.notifyCB = notifyCB
    this.client = null
    this.queryQue = []					//Que of queries waiting for DB to connect
    this.connecting = false
    if (this.config.listen) this.connect(() => {	//Connect now so we can listen
      let q; while (q = this.queryQue.shift()) this.query(...q)	//And process the queue
      if (connectCB) connectCB()
    })
  }

// -----------------------------------------------------------------------------
  disconnect() {					//Disconnect from the database (if connected)
    if (this.client) this.client.end()
    this.client = null
  }
  
// -----------------------------------------------------------------------------
  newClient(discon = true) {				//Get a fresh client for this connection
    if (discon) this.disconnect()
    this.log.trace("New DB client")
    this.client = new Client(this.config)
    if (this.config.listen) {
      this.log.trace("Listening on DB channel:", this.config.listen);
      this.queryQue.push(["listen " + Format.ident(this.config.listen)])
      if (this.notifyCB) this.client.on('notification', msg => {
        this.log.trace("DB notification:", msg);
        this.notifyCB(msg.channel, msg.payload)
      })
    }
  }
  
// -----------------------------------------------------------------------------
  connect(cb) {
    var fatal = (message) => {this.log.error("Fatal database error: " + message); return {message}}

    if (!this.client) this.newClient(false)

    this.connecting = true
    this.client.connect(err => {			//Make connection to DB for this client
      if (!err) {cb(); this.connecting = false; return}			//Success

    this.log.trace("DB connection error:", err.message);
      let dbname = this.client.connectionParameters.database		//DB we tried to connect to
      this.disconnect()
      if (!/database .* does not exist/.test(err.message)) {fatal(err.message); return}		//Abort on anything other than DB does not exist error
      if (!this.config.schema) {fatal('No schema found'); return}	//No schema found to create

      let tclient = new Client(Object.assign({}, this.config, {database: DefaultDB}))
      tclient.connect(err => {						//Try connecting to template DB
        if (err) {tclient.end(); fatal(err.message); return}
        this.log.trace("Will create DB with name: %s", dbname)
        
        tclient.query("create database \"" + dbname + "\"", err => {		//Try to create our database
          tclient.end()							//Done with temporary client
          if (err) {fatal("Creating database " + dbname + "(" + err + ")"); return}
          this.log.trace("Initialize Schema:%s", this.config.schema)
          
          Fs.readFile(this.config.schema, 'utf8', (err, dat) => {
            if (err) {fatal("Can't open schema file: " + this.config.schema); return}
            this.log.trace("Have schema file data, will try connect again")
            
            this.newClient()						//Now try connecting again with a new client
            this.client.connect(err => {
              if (err) {fatal("Connecting to new DB: " + err.message); return}
              this.log.trace("Connected OK; Building schema")

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
//this.log.debug("Query:", args[0])
    if (this.client && this.client._connected) {	//If connection ready, run the query
      this.client.query(...args)
    } else {						// else save the command for later
      this.queryQue.push(args)
//this.log.debug("  queueing it: ", this.queryQue.length)
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
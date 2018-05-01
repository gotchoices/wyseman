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
const	Fs		= require('fs')			//Node filesystem module
const	{ Client }	= require('pg')			//PostgreSQL
const	DefaultDB	= 'template1'
var	initialize	= true				//Next user should try to init DB if necessary

module.exports = class dbClient {
  constructor(conf) {
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
    this.config = conf
    this.client = null
    this.queryQue = []					//Que of queries waiting for DB to connect
    this.connecting = false
  }

  disconnect() {
    if (this.client) this.client.end()
    this.client = null
  }
  
// -----------------------------------------------------------------------------
  connect(cb) {
    var fatal = (message) => {this.log.error("Fatal database error: " + message); return {message}}

    if (!this.client) {this.client = new Client(this.config)}

    this.connecting = true
    this.client.connect(err => {			//Make connection to DB for this client
      if (!err) {cb(); this.connecting = false; return}			//Success

      this.log.trace("DB connection error:", err.message);
      let dbname = this.client.connectionParameters.database		//DB we tried to connect to
      this.client.end(); this.client = null				//Free up the old connection
      if (!/database .* does not exist/.test(err.message)) {fatal(err.message); return}		//Abort on anything other than DB does not exist error
      if (!this.config.schema) {fatal('No schema found'); return}	//No schema found to create

      let tclient = new Client(Object.assign({}, this.config, {database: DefaultDB}))
      tclient.connect(err => {						//Try connecting to template DB
        if (err) {tclient.end(); fatal(err.message); return}
        this.log.trace("Will create DB with name: %s", dbname)
        
        tclient.query("create database " + dbname, err => {		//Try to create our database
          tclient.end()							//Done with temporary client
          if (err) {fatal("Creating database " + dbname); return}
          this.log.trace("Initialize Schema:%s", this.config.schema)
          
          Fs.readFile(this.config.schema, 'utf8', (err, dat) => {
            if (err) {fatal("Can't open schema file: " + this.config.schema); return}
            this.log.trace("Have schema file data, will try connect again")
            
            this.client = new Client(this.config)
            this.client.connect(err => {
              if (err) {fatal("Connecting to new DB: " + err.message); return}
              this.log.trace("Connected OK; Building schema")

              this.query(dat, (err, res) => {		//Attempt to build our schema
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
    if (!this.client || !this.client._connected) {	//If connection not ready, save the command for later
      this.queryQue.push([...args])
//this.log.debug("  queueing it: ", this.queryQue.length)
      if (!this.connecting) this.connect(() => {			//Get this client connected
          let q; while (q = this.queryQue.shift()) this.query(...q)	//And process the queue
      })
    } else {
      this.client.query(...args)
    }
  }				//query

}				//class dbClient

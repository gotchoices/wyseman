//Open a synchronous connection to the database
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- 
const	Os		= require('os')
const	Client		= require('pg-native')		//PostgreSQL

module.exports = class {
  constructor(conf) {
    this.db = new Client()
    this.parms = `host=${conf.host||Os.hostname()} dbname=${conf.dbname} user=${conf.user} port=${conf.port}`
    this.db.connectSync(this.parms)
  }

// -----------------------------------------------------------------------------
  disconnect() {				//Disconnect from the database (if connected)
    this.db.end()
    this.db = null
  }
  
// -------------------------------------------------------------------
  x(sql, values) {			//Execute DB query
    return this.db.querySync(sql, values)
  }
  
// -------------------------------------------------------------------
  t(sql) {				// Wrap a query in a transaction
    return this.x('begin; ' + sql + '; commit;')
  }

// -------------------------------------------------------------------
  one(sql, values) {			//Execute DB query expecting a single row
    let rows = this.x(sql, values)
    return rows && rows.length > 0 ? rows[0] : null
  }
  
}	//class

//Manage one or more connections to a wyseman PostgreSQL database
//If the specified database doesn't exist, create it.
//If the bootstrap schema doesn't exist, create that too.
//Copyright WyattERP: GNU GPL Ver 3; see: License in root of this package
// -----------------------------------------------------------------------------
//TODO:
//X- Create and connect to database just-in-time
//X- Get rid of lodash (use Object.assign?)
//X- Query errors get relayed back to view properly
//X- Streamline code in handler
//X- Errors, like no fields in insert, should return error packet to frontend, not just log
//- 
//- Query to return meta-data for table joins
//- How to handle module-specific control functions?
//- Return query promise in case no callback given
//- If schema initialization SQL fails, and we created the DB, should we then delete it?
//- 

var	fs		= require('fs');	//Node filesystem module
var	pg		= require('pg');	//PostgreSQL
var	format		= require('pg-format');	//String formatting/escaping
const	Opers		= ['=', '!=', '<', '<=', '>', '>=', '~', 'in']

module.exports = class Wyseman {
  constructor(conf, clientPort, userControl) {
    if (conf.logger) {
      this.log = conf.logger			//Use a passed-in logger
    } else {
        let logger = require('util').debuglog('wyseman')	//Or default to our own
        this.log = {
          trace: function (msg) {logger(msg)},
          debug: function (msg) {logger(msg)},
          error: function (msg) {console.error(msg)}
        }
    }
    delete conf.logger
    this.log.debug("In Wyseman constructor conf:", JSON.stringify(conf), " Client port:", clientPort)
    
    this.config = conf;					//Save configuration until we actually init
//    this.language = conf.lang || 'en';		//Fixme: default to english

    this.userControl = userControl			//Handler for custom actions
    var wss = new (require('ws')).Server({		//Initiate a new websocket connection
      port: clientPort, clientTracking: true
    })

    wss.on('error', (err) => {				//When connection from view is open
      this.log.error(err.message)
    })

    wss.on('connection', (ws) => {			//When connection from view is open
      ws.on('close', (code, reason) => {
        this.log.debug("Wyseman socket connection closed:", code, reason)
        if (wss.clients.size <= 0 && this.client)
          this.client.end()				//Free up this DB connection
      })

      ws.on('message', (imsg) => {			//When message received from client
//        this.log.debug("Incoming Wyseman message:" + imsg + ";")
        let packet = JSON.parse(imsg)

        this.handler(packet, (omsg) => {		//Handle/control an incoming packet
          let jmsg = JSON.stringify(omsg)
//this.log.trace('Sending back:', JSON.stringify(omsg, null, 2))
          ws.send(jmsg)					//Send a reply back to the client
        })
      })

this.log.trace('C:')
      this.queryQue = []				//Que of queries waiting for DB to connect
      this.client = new pg.Client(this.config)		//Make connection to DB for this client
//      this.log.trace("DB Client:%s", JSON.stringify(this.client));
  
      this.client.connect(err => {			//Make connection to DB for this client
        let fatal = (msg) => {this.log.error("Fatal database error: " + msg)}
        let flushQue = () => {
          let q; while (q = this.queryQue.shift()) this.query(...q)
        }

        if (!err) {flushQue(); return}
        this.log.trace("DB connection handler, err:", err.message);
        let dbname = this.client.connectionParameters.database	//DB we tried to connect to
        this.client.end()					//Free up the old connection
        if (!/database .* does not exist/.test(err.message)) {fatal(err.message); return}	//Report anything other than DB does not exist error
        if (!this.config.schema) {fatal('No schema found'); return}	//No schema found to create

        let tclient = new pg.Client(Object.assign({}, this.config, {database: 'template1'}))
        tclient.connect(err => {				//Try connecting to template DB
          if (err) {fatal(err.message); tclient.end(); return}
this.log.debug("Will create DB with name: %s", dbname)
          tclient.query("create database " + dbname, err => {		//Try to create our database
            tclient.end()						//Done with temporary client
            if (err) {fatal("Creating database " + dbname); return}
this.log.debug("Initialize Schema:%s", this.config.schema)
            fs.readFile(this.config.schema, 'utf8', (err, dat) => {
              if (err) {fatal("Can't open schema file: " + this.config.schema); return}
this.log.debug("Have schema file data, will try connect again")
              this.client = new pg.Client(this.config)
              this.client.connect(err => {
                if (err) {fatal("Connecting to new DB: " + err.message); return}
this.log.debug("Connected OK; Building schema")
                this.client.query(dat, (err, res) => {		//Attempt to build our schema
                  if (err) {fatal("In schema (" + this.config.schema + "): " + err.message); return}
this.log.debug("New schema created")
                  flushQue()
                })		//query to build schema
              })		//new client.connect
            })			//readFile
          })			//create DB query
        })			//tclient connect
      })			//client.connect
this.log.debug("Connected clients: ", wss.clients.size)
    })
  }
  
// Log an error and generate an error object
// -------------------------------------------------------------------
  error(message, err = 'unknown') {
    let ret = { message }, prefix = '!wylib.data.'
    this.log.trace("Query error " + ret.message)
    if (typeof err == 'string') {
      if (err && err.split('.').length == 1) ret.code = prefix + err
    } else if (typeof err == 'object') {
      if (err.constraint && err.constraint.match(/^!/)) {
        ret.code = err.constraint
      } else if (err.code) {
        ret.code = prefix + err.code
      } else {
        ret.code = prefix + unknown
      }
      if (err.message) ret.message += (': ' + err.message)
      if (err.detail) ret.detail = err.detail
    }
    return ret
  }

// Attempt a DB query.  If not yet connected, queue the request
// -------------------------------------------------------------------
  query(...args) {
this.log.debug("Query:", args[0])
    if (!this.client._connected) {		//If connection not ready, save the command for later
      this.queryQue.push([...args])
//this.log.debug("  queueing it: ", this.queryQue.length)
      return
    }

    let [ qstring, parms, tuples, msg, cb ] = args
    if (!qstring) return			//Ignore null queries (result of an error in query builder)
    
    this.client.query(qstring, parms, (err, res) => {		//Run the user's query
//this.log.debug(" qstring:", qstring, "parms:", parms)
      if (err) {
        msg.error = this.error("from database", err)
      } else if (!res) {
        msg.error = this.error("no result")
      } else if (tuples && res.rowCount != tuples) {
        msg.error = this.error("unexpected rows: " + res.rowCount + ' != ' + tuples, "badTuples")
      }
      if (res && res.rows) {
        if (tuples == 1) msg.data = res.rows[0]
        else if (tuples == null || tuples > 0) msg.data = res.rows
        else if (tuples == 0) msg.data = null
      }
      if (cb) cb(msg)
    })
  }

// Handle an incoming packet from the view client
// -------------------------------------------------------------------
  handler(msg, sender) {
     this.log.trace("Wyseman packet handler, msg:" + JSON.stringify(msg))

     let {id, view, action} = msg
     if (!view) return
     if (action == 'lang') {
       action = 'tuple'; 
       Object.assign(msg, {fields: ['title','help','columns','messages'], table: 'wm.table_lang', where: {obj: view, language: msg.language || 'en'}})
     } else if (msg.action == 'meta') {
       action = 'tuple'
       Object.assign(msg, {fields: ['obj','pkey','cols','columns'], table: 'wm.table_meta', where: {obj: view}})
//this.log.debug(" Tuple:", view, this.config.interface)
       if (this.config.interface && this.config.interface[view]) msg.ui = this.config.interface[view]
     }

     let {table, fields, where, order} = msg
this.log.debug(" From msg:", table, view)
     let [sch, tab] = (table || view).split('.')
     if (!tab) {tab = sch; sch = 'public'}
     table = format.ident(sch) + '.' + format.ident(tab)
     
     let tuples = 1, result = {query: null, parms: [], error: null}
     switch (action) {
       case 'tuple':
         this.buildSelect(result, {fields, table, where});	break;
       case 'select':
         this.buildSelect(result, {fields, table, where, order})
         tuples = null;						break;
       case 'update':
         this.buildUpdate(result, fields, table, where);	break;
       case 'insert':
         this.buildInsert(result, fields, table);		break;
       case 'delete':
         this.buildDelete(result, table, where)
         tuples = 0;						break;
       default:
       if (this.userControl && this.userControl(msg, sender)) return
       result.error = this.error('unknown action: ' + action, 'badAction')
     }
     if (result.error) sender({error: result.error, id, view, action})
     else this.query(result.query, result.parms, tuples, msg, sender)
  }

// -----------------------------------------------------------------------------
  buildSelect(res, spec) {
    let { fields, table, where, order} = spec
//console.log("buildSelect", fields, table, where, order)
    let wh = '', ord = '',
        whereText = this.buildWhere(where, res), 
        ordText = this.buildOrder(order, res)
    if (where && whereText) wh = ' where ' + whereText
    if (order && ordText) ord = ' order by ' + ordText
    res.query = format('select %s from %s%s%s;', fields ? format.ident(fields) : '*', table, wh, ord)
this.log.trace("buildSelect:", res.query, "\n  parms:", res.parms)
  }

// -----------------------------------------------------------------------------
  buildInsert(res, fields, table, where) {
    let i = res.parms.length + 1			//Starting parameter number
    let flist = []
    let plist = []
    Object.keys(fields).forEach(fld => {
      flist.push(format("%I", fld))
      plist.push(format("$%s", i++))
      res.parms.push(fields[fld])
    })
    if (flist.length <= 0) {
      res.error = this.error("empty insert", 'badInsert'); return null
    }

    res.query = format('insert into %s (%s) values (%s) returning *;', table, flist.join(', '), plist.join(', '))
this.log.trace("buildInsert:", res.query, "\n  parms:", res.parms)
  }

// -----------------------------------------------------------------------------
  buildUpdate(res, fields, table, where) {
    let wh = this.buildWhere(where, res),
        i = res.parms.length + 1			//Starting parameter number
    if (!where || !wh || res.parms.length <= 0) {
      res.error = this.error("empty where clause", 'badWhere'); return
    }
    let flist = []
    Object.keys(fields).forEach(fld => {
      flist.push(format("%I = $%s", fld, i++))
      res.parms.push(fields[fld])
    })
    if (flist.length <= 0) {
      res.error = this.error("empty update", badUpdate); return null
    }
    res.query = format('update %s set %s where %s returning *;', table, flist.join(', '), wh)
this.log.trace("buildUpdate:", res.query, "\n  parms:", res.parms)
  }

// -----------------------------------------------------------------------------
  buildDelete(res, table, where) {
    let wh = this.buildWhere(where, res),
        i = res.parms.length + 1			//Starting parameter number
    if (!where || !wh || res.parms.length <= 0) {
      res.error = this.error("unbounded delete", 'badDelete'); return null
    }
    res.query = format('delete from %s where %s;', table, wh)
//this.log.trace("buildDelete:", query, "\n  parms:", res.parms)
  }

// Create a where clause from a JSON structure
// -----------------------------------------------------------------------------
  buildWhere(logic, res) {
//this.log.trace("Logic:", logic, typeof logic)
    if (!logic) return null
    let i = res.parms.length + 1			//Starting parameter number
    if ('items' in logic) {				//Logic list syntax
      if (!('and' in logic)) logic.and = true		//Default to 'and' combiner
      let clauses = []; logic.items.forEach((item) => {
        clauses.push(this.buildWhere(item, res))
      })
      return clauses.join(logic.and ? ' and ' : ' or ')
    } else if ('left' in logic) {			//Logic clause syntax
      let oper = logic.oper || '='
      if (!Opers.includes(oper)) {
        res.error = this.error("invalid operator: " + oper, 'badOperator'); return null
      }
      res.parms.push(logic.entry || logic.right || '')
      return format("%I %s $%s", logic.left, oper, i++)
    } else if (typeof logic == 'object') {		//Compact form, each key is an = clause, anded together
      let clauses = [];
      Object.keys(logic).forEach((key) => {
        clauses.push(format("%I = $%s", key, i++))
        res.parms.push(logic[key])
      })
      return clauses.join(' and ')
    }
    res.error = this.error("mangled logic: " + logic, 'badLogic')
    return null
  }

// Create a field ordering clause from a JSON structure
// -----------------------------------------------------------------------------
  buildOrder(order, res) {
//this.log.trace("Order:", order)
    if (!order || typeof order != 'object') return null
    let ords = [];
    order.forEach(el => {
      ords.push(format("%I %s", el.field || el.column || el.columnId, (el.asc || el.sortAsc) ? 'asc' : 'desc'))
    })
    return ords.length > 0 ? ords.join(', ') : null
  }

}	//class Wyseman

// -----------------------------------------------------------------------------
//  def tables_ref(tab, refme=false)	//Return tables that are referenced (pointed to) by the specified table
//    #Port_me				//If refme true, return tables that reference the specified table
//  end

// -----------------------------------------------------------------------------
//  def columns_fk(tab, ftab)		//Return the fk columns in a table and the pk columns they point to in a foreign table
//    #Port_me
//  end

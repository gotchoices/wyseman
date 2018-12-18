//Manage the connection between a User Interface and the backend database
//Copyright WyattERP: GNU GPL Ver 3; see: License in root of this package
// -----------------------------------------------------------------------------
//TODO:
//X- Works with dbclient
//- Should any of the %s's in pg-format really be %L's?
//- Allow to specify 'returning' fields to insert, update overriding default *
//- Handle warnings from the database, in addition to errors? (like if row count = 0)
//- Query to return meta-data for table joins
//- How to handle module-specific control functions?
//- Return query promise in case no callback given?
//- 

var	dbClient	= require('./dbclient.js')		//PostgreSQL
const	Format		= require('pg-format')			//String formatting/escaping
const	Opers		= ['=', '!=', '<', '<=', '>', '>=', '~', 'diff', 'in', 'null', 'true']

module.exports = class Wyseman {
  constructor(conf, clientPort, userControl) {
    this.ws = null					//No web socket connection yet
    this.db = new dbClient(this.config = conf, (channel, message, mine) => {
      let data = JSON.parse(message)
      this.log.trace("Async notify from DB:", channel, data, mine)
//      if (this.ws && !mine) {				//Ignore notices I caused
          this.ws.send(JSON.stringify({action: 'notify', channel, data}), err => {
          if (err) this.log.error(err)
        })
//      }
    })
    this.log = conf.logger || this.db.log
    this.log.trace("In Wyseman constructor conf:", JSON.stringify(conf), " Client port:", clientPort)
    
    this.userControl = userControl			//Handler for custom actions
    var wss = new (require('ws')).Server({		//Initiate a new websocket connection
      port: clientPort, clientTracking: true
    })

    wss.on('connection', (ws) => {			//When connection from view is open
      this.ws = ws					//Note our connection (for asynch traffic)
      ws.on('close', (code, reason) => {
        this.log.debug("Wyseman socket connection closed:", code, reason)
        this.ws = null
        if (wss.clients.size <= 0 && this.db)
          this.db.disconnect()				//Free up this DB connection
      })

      ws.on('message', (imsg) => {			//When message received from client
//        this.log.debug("Incoming Wyseman message:" + imsg + ";")
        let packet = JSON.parse(imsg)

        this.handler(packet, (omsg) => {		//Handle/control an incoming packet
          let jmsg = JSON.stringify(omsg)
//this.log.trace('Sending back:', JSON.stringify(omsg, null, 2))
          ws.send(jmsg, err => {			//Send a reply back to the client
            if (err) this.log.error(err)
          })
        })
      })

this.log.debug("Connected clients: ", wss.clients.size)
    })			//wss.on connection
  }			//constructor
  
// Log an error and generate an error object
// -------------------------------------------------------------------
  error(message, err = 'unknown') {
    let ret = { message }, prefix = '!wylib.data.'
    this.log.trace("Query error " + ret.message + ": " + err)
    if (typeof err == 'string') {
      if (err && err.split('.').length == 1) ret.code = prefix + err
    } else if (typeof err == 'object') {
      if (err.constraint && err.constraint.match(/^!/)) {
        ret.code = err.constraint
      } else if (err.code) {
        ret.code = prefix + err.code
      } else {
        ret.code = prefix + 'unknown'
      }
      if (err.message) ret.message += (': ' + err.message)
      if (err.detail) ret.detail = err.detail
    }
    return ret
  }

// Attempt a DB query, processing any errors
// -------------------------------------------------------------------
  query(qstring, parms, tuples, msg, cb) {
    if (!qstring) return			//Ignore null queries (result of an error in query builder)
    
    this.db.query(qstring, parms, (err, res) => {		//Run the user's query
this.log.debug(" query:", qstring, "parms:", parms, "tuples:", tuples, "Err:", err)
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

     let {table, params, fields, where, order} = msg, argtypes
this.log.debug(" From msg, table:", table, " view:", view, "order: ", order)
     let [sch, tab] = (table || view).split('.')		//Split into schema and table
     if (!tab) {tab = sch; sch = 'public'}			//Default to public if no schema specified
     ;([tab, argtypes] = tab.split(/[\(\)]/))			//In case table is specified as a function
this.log.trace("  tab:", tab, " argtypes:", argtypes)
     table = Format.ident(sch) + '.' + Format.ident(tab)
     if (argtypes) argtypes = argtypes.split(',')

     let tuples = 1, result = {query: null, parms: [], error: null}
     switch (action) {
       case 'tuple':
         this.buildSelect(result, {fields, table, argtypes, params, where});	break;
       case 'select':
         this.buildSelect(result, {fields, table, argtypes, params, where, order})
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
     if (result.error)
       sender({error: result.error, id, view, action})
     else
       this.query(result.query, result.parms, tuples, msg, sender)
  }

// -----------------------------------------------------------------------------
  buildSelect(res, spec) {
    let { fields, table, argtypes, params, where, order} = spec
this.log.trace("BuildSelect", fields, table, params, where, order)
    let wh = '', ord = ''
      , whereText = this.buildWhere(where, res)
      , ordText = this.buildOrder(order, res)
    if (where && whereText) wh = ' where ' + whereText
    if (order && ordText) ord = ' order by ' + ordText
    if (params) {					//If selecting from a function
      let i = res.parms.length + 1, plist = []
      params.forEach(param => {				//Form parameter list
        plist.push(Format("$%s%s", i++, argtypes && argtypes.length > 0 ? '::'+argtypes.shift() : ''))
        res.parms.push(param)
      })
      table = table + "(" + plist.join(',') + ")"	//And attach the parameter list to the end of the table to make the function call
    }
    if (fields && fields != "*") fields = Format.ident(fields)
    res.query = Format('select %s%s%s%s;', fields ? fields + ' from ' : '', table, wh, ord)
this.log.trace("buildSelect:", res.query, "parms:", res.parms)
  }

// -----------------------------------------------------------------------------
  buildInsert(res, fields, table) {
    let i = res.parms.length + 1			//Starting parameter number
    let flist = []
    let plist = []
    Object.keys(fields).forEach(fld => {
      if (fld === null || fld === undefined) {res.error = this.error("invalid null or undefined field", 'badFieldName'); return null}
      flist.push(Format("%I", fld))
      plist.push(Format("$%s", i++))
      res.parms.push(fields[fld])
    })
    if (flist.length <= 0) {
      res.error = this.error("empty insert", 'badInsert'); return null
    }

    res.query = Format('insert into %s (%s) values (%s) returning *;', table, flist.join(', '), plist.join(', '))
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
      if (fld === null || fld === undefined) {res.error = this.error("invalid null or undefined field", 'badFieldName'); return null}
      flist.push(Format("%I = $%s", fld, i++))
      res.parms.push(fields[fld])
    })
    if (flist.length <= 0) {
      res.error = this.error("empty update", badUpdate); return null
    }
    res.query = Format('update %s set %s where %s returning *;', table, flist.join(', '), wh)
this.log.trace("buildUpdate:", res.query, "\n  parms:", res.parms)
  }

// -----------------------------------------------------------------------------
  buildDelete(res, table, where) {
    let wh = this.buildWhere(where, res)
    if (!where || !wh || res.parms.length <= 0) {
      res.error = this.error("unbounded delete", 'badDelete'); return null
    }
    res.query = Format('delete from %s where %s;', table, wh)
//this.log.trace("buildDelete:", query, "\n  parms:", res.parms)
  }

// Create a where clause from a JSON structure
// -----------------------------------------------------------------------------
  buildWhere(logic, res) {
//this.log.trace("Logic:", logic, typeof logic)
    if (!logic) return null
    let i = res.parms.length + 1			//Starting parameter number

    if (Array.isArray(logic)) {				//Compact form, each element is: field <oper> value, anded together
      let clauses = [];
      logic.forEach(log => {
        let [ left, oper, right ] = Array.isArray(log) ? log : log.split(' ')
//this.log.trace("Left:", left, "Oper:", oper, "Right:", right)
        if (left === null || left === undefined) {res.error = this.error("invalid null or undefined left hand side", 'badLeftSide'); return null}
        if (!Opers.includes(oper)) {res.error = this.error("invalid operator: " + oper, 'badOperator'); return null}
        clauses.push(Format("%I %s $%s", left, oper, i++))
        res.parms.push(right)
      })
      return clauses.join(' and ')

    } else if ('items' in logic) {			//Logic list syntax
      if (!('and' in logic)) logic.and = true		//Default to 'and' combiner
      let clauses = []; logic.items.forEach((item) => {
        let clause = this.buildWhere(item, res)
        if (clause) clauses.push(clause)
      })
      return clauses.join(logic.and ? ' and ' : ' or ')

    } else if ('left' in logic) {			//Logic clause syntax
      if (logic.oper == 'nop') return null
      let oper = logic.oper || '='
      if (logic.left === null || logic.left === undefined) {res.error = this.error("invalid null or undefined field", 'badFieldName'); return null}
      if (!Opers.includes(oper)) {res.error = this.error("invalid operator: " + oper, 'badOperator'); return null}
      if (logic.oper == 'diff') logic.oper = 'is distinct from'
      if (logic.oper == 'null') {
        return Format("%s(%I is null)", logic.not ? 'not ' : '', logic.left)
      } else if (logic.oper == 'true') {
        return Format("%s%I", logic.not ? 'not ' : '', logic.left)
      } else if (logic.oper == 'in') {
        if (logic.entry) {
          return Format("%s(%I in (%L))", logic.not ? 'not ' : '', logic.left, logic.entry.split(','))
        } else if (logic.right) {
          return Format("%s(%I = any(%I))", logic.not ? 'not ' : '', logic.left, logic.right)
        } else {
          res.error = this.error("invalid or null right side", 'badRight'); return null
        }
      } else {
        res.parms.push(logic.entry || logic.right || '')
        return Format("%s(%I %s $%s)", logic.not ? 'not ' : '', logic.left, oper, i++)
      }

    } else if (typeof logic == 'object') {		//Compact form, each key is an = clause, anded together
      let clauses = [];
      Object.keys(logic).forEach((key) => {
        clauses.push(Format("%I = $%s", key, i++))
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
this.log.trace("Order:", order, typeof order)
    if (!order) return null
    if (!Array.isArray(order)) order = [order]
    let ords = [];
    order.forEach(el => {
      if (typeof el == 'object') {
        let col = el.field || el.column || el.columnId
        if (col === null || col === undefined) {res.error = this.error("invalid null or undefined field", 'badFieldName'); return null}
        ords.push(Format("%I %s", el.field || el.column || el.columnId, (el.asc || el.sortAsc) ? 'asc' : 'desc'))
      } else if (typeof el == 'number') {
        ords.push(Format("%s", el))
      } else if (typeof el == 'string') {
        ords.push(Format("%I", el))
      }
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

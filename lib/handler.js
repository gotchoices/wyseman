//Translate JSON action objects to SQL and execute them in the backend DB
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//X- Split this off from wyseman.js
//- Old:
//- Should any of the %s's in pg-format really be %L's?
//- Allow to specify 'returning' fields to insert, update overriding default *
//- Handle warnings from the database, in addition to errors? (like if row count = 0)
//- Return query promise in case no callback given?

const	Format		= require('pg-format')			//String formatting/escaping
const	Opers		= ['=', '!=', '<', '<=', '>', '>=', '~', 'diff', 'in', 'isnull', 'notnull', 'true']
const	LangCache	= require('./lang_cache')
const	MetaCache	= require('./meta_cache')

module.exports = class Handler {
  constructor({db, control, actions, dispatch, dConfig, log}) {
    this.db = db
    this.control = control
    this.dispatch = dispatch
    this.dConfig = dConfig
    this.log = log || require('./log')

    LangCache.request((language, view, cb) => {		//If a report needs language data
//this.log.debug('Lang cache view request:', language, view)
      this.handle({id:'interLang', action: 'lang', language, view}, cb)
    }, this.log)
    MetaCache.request((view, cb) => {			//If a report needs metadata
//this.log.debug('Meta cache view request:', view)
      this.handle({id:'interMeta', action: 'meta', view}, cb)
    }, this.log)
  }
  
// Log an error and generate an error object
// -------------------------------------------------------------------
  error(msg, err = 'unknown') {
    let prefix = '!wm.lang:'
      , e = (err && typeof err == 'string') ? {code: prefix + err} : err
      , message = e.message ? msg + '; ' + e.message : msg
      , detail = err.detail
      , pgCode = err.code
      , code = e.constraint?.match(/^![\w.]+:\w/) ? e.constraint : (e.code ?? prefix + pgCode)
//this.log.debug('Error formatter:', pgCode, code, e.constraint)
    return {message, detail, code, pgCode}
  }

// Handle an incoming packet from the view client
// -------------------------------------------------------------------
  handle(msg, sender, recursive = false) {
this.log.trace("Wyseman packet handler, msg:", JSON.stringify(msg))

    let {id, view, action} = msg
    if (!view) return
    if (action == 'lang') {
      let language = msg.language || 'eng'
        , lc = LangCache.view(language, view)
      if (lc && sender) {		//Return cached language data if we have it
         msg.data = lc			//;this.log.debug('LV:', view, msg.language, lc)
         sender(msg)
         return
      }
      action = 'tuple'; 
      Object.assign(msg, {fields: ['title','help','columns','messages'], table: 'wm.table_lang', where: {obj: view, language}})

    } else if (action == 'meta') {
      let mc = MetaCache.view(view)
      if (mc && sender) {		//Return cached metadata if we have it
         msg.data = mc			//;this.log.debug('MV:', view, mc)
         sender(msg)
         return
      }
      action = 'tuple'
      Object.assign(msg, {fields: ['obj','pkey','cols','columns','styles','fkeys'], table: 'wm.table_meta', where: {obj: view}})

    } else if (!recursive && !MetaCache.lookup(view)) {		//No metadata for this view yet
      return MetaCache.viewData(view, () => {			//fetch it
        this.handle(msg, sender, true)				//and then process normally
      })
    }

    let {table, params, fields, where, order, limit} = msg, argtypes
//this.log.debug(" From msg, table:", table, " view:", view, "order: ", order)
    let [sch, tab] = (table || view).split('.')		//Split into schema and table
    if (!tab) {tab = sch; sch = 'public'}			//Default to public if no schema specified
    ;([tab, argtypes] = tab.split(/[\(\)]/))			//In case table is specified as a function
this.log.trace("  tab:", tab, " argtypes:", argtypes)
    table = Format.ident(sch) + '.' + Format.ident(tab)
    if (argtypes) argtypes = argtypes.split(',')
    
    if (fields) Object.keys(fields).forEach(k => {		//Check/parse any binary fields
      let field = fields[k]
      if (typeof field == 'object' && field?._type_ == 'binary' && field._data_) {
        fields[k] = Buffer.from(field?._data_, 'base64')
this.log.debug("Binary field:", k, field._name_, fields[k].toString('hex').slice(0,10))
      }
    })

    let tuples = 1, result = {query: null, parms: [], error: null}
    try { switch (action) {
      case 'tuple':
        this.buildSelect(result, {fields, table, argtypes, params, where});	break;
      case 'select':
        this.buildSelect(result, {fields, table, argtypes, params, where, order, limit})
        tuples = null;						break;
      case 'update':
        this.buildUpdate(result, fields, table, where);		break;
      case 'insert':
        this.buildInsert(result, fields, table);		break;
      case 'delete':
        this.buildDelete(result, table, where)
        tuples = 0;						break;
      default:
        if (!this.control && this.dispatch) 			//If some other action was specified
          this.control = new this.dispatch(this.dConfig)	//Start a controller just in time
        if (this.control && this.control.handle && this.control.handle(msg, sender)) return	//And try to handle this packet
        result.error = this.error('Unhandled: ' + action, 'badAction')		//Requested action not recognized
    }} catch(e) {
      result.error = this.error('parsing: ' + e.message, 'badMessage')
      this.log.error(e.message, e.stack)
    }
    if (result.error) {
      sender({error: result.error, id, view, action})
      return
    }
    let { query, parms } = result

    if (!query) return			//Ignore null queries (result of an error in query builder)
    
    this.db.query(query, parms, (err, res) => {		//Run the user's query
this.log.trace(" query:", query, "parms:", parms, "tuples:", tuples, "Err:", err)
      if (err) {
        msg.error = this.error("from database", err)
      } else if (!res) {
        msg.error = this.error("no result", "noResult")
      } else if (tuples && res.rowCount != tuples) {
        msg.error = this.error("unexpected rows: " + res.rowCount + ' != ' + tuples, "badTuples")
      }
      if (res && res.rows) {
        if (tuples == 1) {
          msg.data = res.rows[0]
          if (msg.action == 'lang' && table == 'wm.table_lang') {	//this.log.debug('LR:', msg.action, view, msg.language, msg.data)
            LangCache.refresh(msg.language, view, msg.data)
          } else if (msg.action == 'meta' && table == 'wm.table_meta') {	//this.log.debug('MR:', msg.action, view, msg.data)
            MetaCache.refresh(view, msg.data)
          }
        } else if (tuples == null || tuples > 0)
          msg.data = res.rows
        else if (tuples == 0)
          msg.data = null
      }
      if (sender) sender(msg)
    })
  }

// -----------------------------------------------------------------------------
  buildSelect(res, spec) {
    let { fields, table, argtypes, params, where, order, limit} = spec
this.log.trace("BuildSelect", fields, table, argtypes, params, where, order, limit)
    let wh = '', ord = '', lim = ''
      , whereText = this.buildWhere(where, res)
      , ordText = this.buildOrder(order, res)
    if (where && whereText) wh = ' where ' + whereText
    if (order && ordText) ord = ' order by ' + ordText
    if (limit && limit !== null && limit !== undefined) lim = ' limit ' + parseInt(limit)
    if (params) {					//If selecting from a function
      let i = res.parms.length + 1, plist = []
      params.forEach(param => {				//Form parameter list
        plist.push(Format("$%s%s", i++, argtypes && argtypes.length > 0 ? '::'+argtypes.shift() : ''))
        res.parms.push(param)
      })
      table = table + "(" + plist.join(',') + ")"	//And attach the parameter list to the end of the table to make the function call
    }
    if (fields && fields != "*") fields = Format.ident(fields)
    res.query = Format('select %s%s%s%s%s;', fields ? fields + ' from ' : '', table, wh, ord, lim)
this.log.trace("buildSelect:", res.query, "parms:", res.parms)
  }

// -----------------------------------------------------------------------------
  buildInsert(res, fields, table) {
    let i = res.parms.length + 1			//Starting parameter number
      , flist = []
      , plist = []
      , mc = MetaCache.lookup(table)			//;this.log.debug('Bi:', mc)
    Object.keys(fields).forEach(fld => {		//this.log.debug("bI:", i, fld, ":", typeof fields[fld])
      let type = mc?.col[fld]?.type			//;this.log.debug("Bi c type:", type)
      if (fld === null || fld === undefined) {res.error = this.error("invalid null or undefined field", 'badFieldName'); return null}
      flist.push(Format("%I", fld))
      plist.push(Format("$%s", i++))

      let fVal = (type == 'jsonb' || type == 'json')	//If we don't stringify, node-pg
        ? JSON.stringify(fields[fld]) 			//formats json arrays as PG arrays
        : fields[fld]
      res.parms.push(fVal)
    })
    if (flist.length <= 0) {
      res.error = this.error("empty insert", 'badInsert'); return null
    }

    res.query = Format('insert into %s (%s) values (%s) returning *;', table, flist.join(', '), plist.join(', '))
this.log.trace("buildInsert:", res.query, "\n  parms:", res.parms)
  }

// -----------------------------------------------------------------------------
  buildUpdate(res, fields, table, where) {
    let wh = this.buildWhere(where, res)
      , i = res.parms.length + 1			//Starting parameter number
      , mc = MetaCache.lookup(table)			//;this.log.debug('Bu:', mc)
    if (!where || !wh || res.parms.length <= 0) {
      res.error = this.error("empty where clause", 'badWhere'); return
    }
    let flist = []
    Object.keys(fields).forEach(fld => {
      let type = mc?.col[fld]?.type			//;this.log.debug("Bu c type:", type)
      if (fld === null || fld === undefined) {res.error = this.error("invalid null or undefined field", 'badFieldName'); return null}
      flist.push(Format("%I = $%s", fld, i++))

      let fVal = (type == 'jsonb' || type == 'json')	//If we don't stringify, node-pg
        ? JSON.stringify(fields[fld]) 			//formats json arrays as PG arrays
        : fields[fld]
      res.parms.push(fVal)
    })
    if (flist.length <= 0) {
      res.error = this.error("empty update", "badUpdate"); return null
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
//this.log.trace("bW Logic:", logic, typeof logic)
    if (!logic) return null
    let i = res.parms.length + 1			//Starting parameter number

    if (Array.isArray(logic)) {				//Compact form, each element is: field <oper> value, anded together
      let clauses = [];
      logic.forEach(log => {
        let [ left, oper, right ] = Array.isArray(log) ? log : log.split(' ')
//this.log.debug("Left:", left, "Oper:", oper, "Right:", right)
        if (left === null || left === undefined) {res.error = this.error("invalid null or undefined left hand side", 'badLeft'); return null}
        if (!Opers.includes(oper)) {res.error = this.error("invalid operator: " + oper, 'badOperator'); return null}
        if (oper == 'diff') oper = 'is distinct from'
        if (oper == 'isnull' || oper == 'notnull')
          clauses.push(Format("%I %s", left, oper))
        else if (oper == 'true')
          clauses.push(Format("%I", left))
        else {
          clauses.push(Format("%I %s $%s", left, oper, i++))
          res.parms.push(right)
        }
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
//this.log.debug("Left:", logic.left)
      if (logic.oper == 'nop') return null
      let oper = logic.oper || '='
      if (logic.left === null || logic.left === undefined) {res.error = this.error("invalid null or undefined field", 'badFieldName'); return null}
      if (!Opers.includes(oper)) {res.error = this.error("invalid operator: " + oper, 'badOperator'); return null}
      if (logic.oper == 'diff') logic.oper = 'is distinct from'
      if (logic.oper == 'isnull' || logic.oper == 'notnull') {
        return Format("%s(%I %s)", logic.not ? 'not ' : '', logic.left, logic.oper)

      } else if (logic.oper == 'true') {		//LHS only
        return Format("%s%I", logic.not ? 'not ' : '', logic.left)

      } else if (logic.oper == 'in') {			//LHS in array or set
        if (logic.entry) {				//RHS is explicit
          let right = logic.entry
            , notter = logic.not ? 'not ' : ''
          if (Array.isArray(right))			//Map array sub-elements to strings
            right = right.map(el=>(Array.isArray(el) ? el.join('~') : el))
          if (typeof right == 'string') right = right.split(/[ ,]+/)	//Comma separated list
          if (Array.isArray(logic.left)) {		//Matching multiple fields against array sub-elements
            let left = logic.left.map(el=>(Format("%I", el))).join("||'~'||")	//Map LHS to tilde joined string
            return Format("%s(%s in (%L))", notter, left, right)
          }
          return Format("%s(%I in (%L))", notter, logic.left, right)

        } else if (logic.right) {			//RHS is a DB field
          return Format("%s(%I = any(%I))", logic.not ? 'not ' : '', logic.left, logic.right)
        } else {
          res.error = this.error("invalid or null right side", 'badRight'); return null
        }

      } else {
        res.parms.push(logic.entry ?? logic.right ?? '')	//;this.log.trace('R:', res.parms)
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

}	//class Handler

//Wyseman schema file parser; A wrapper around the TCL core parser
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- 
const Path = require('path')
const Fs = require('fs')
const Child = require('child_process')
const Format = require('pg-format')
const Tcl = require('tcl').Tcl

module.exports = class {
  constructor(db) {
    this.db = db
    this.tcl = new Tcl()
    this.dirName = null
    this.modDirs = {}

    this.tcl.proc("hand_object",(...a) => this.pObject(...a))
    this.tcl.proc("hand_priv",	(...a) => this.pPriv(...a))
    this.tcl.proc("hand_query",	(...a) => this.pQuery(...a))
    this.tcl.proc("hand_cnat",	(...a) => this.pCnat(...a))
    this.tcl.proc("hand_pkey",	(...a) => this.pPkey(...a))

    this.tcl.source(Path.join(__dirname, 'wylib.tcl'))
    this.tcl.source(Path.join(__dirname, 'wmparse.tcl'))

    if (!this.db.one("select * from pg_tables where schemaname = 'wm' and tablename = 'objects'")) {
      let boot = Fs.readFileSync(Path.join(__dirname, 'bootstrap.sql'))
//console.log("Building bootstrap:")
      this.db.x(boot)
    }

//console.log("Check runtime:")
    if (!this.db.one("select obj_nam from wm.objects where obj_typ = 'table' and obj_nam = 'wm.table_text'")) {
      this.parse(Path.join(__dirname, 'run_time.wms'))
      this.db.x("select case when wm.check_drafts(true) then wm.check_deps() end;")	//Check versions/dependencies
      this.db.x("select wm.make(null, false, true);")		//And build it
      this.parse(Path.join(__dirname, 'run_time.wmt'))	//Read text descriptions
      this.parse(Path.join(__dirname, 'run_time.wmd'))	//Read display switches
    }
      this.db.x('delete from wm.objects where obj_ver <= 0;')	//Remove any failed working entries
  }		//Constructor
    
  module(module, dir) {			//Remember/return directories we found modules in
//console.log("Module dirs:", this.modDirs, module, dir)
    if (module == null)
      return this.modDirs
    if (dir == null)
      return this.modDirs[module]

    if (module in this.modDirs) {		//We've already seen this module
      let old = this.modDirs[module]
      if (dir.split(Path.sep).length < old.split(Path.sep).length)
        this.modDirs[module] = dir		//Record shortest path to module
    } else {
      this.modDirs[module] = dir
    }
  }
    
  parse(file) {
//console.log('file:', file, "ext:", Path.extname(file), 'res:', Path.resolve(file))
    let fullName = Path.resolve(file)
    this.dirName = Path.dirname(fullName)		//Pass around the side to sql generator
    
    if (Path.extname(file) == '.wmi') {
      let sql = Child.execFileSync(fullName).toString()
//console.log('sql:', sql)
      return sql
    }
    try {
      let res = this.tcl.$("wmparse::parse " + file)
    } catch(e) {
      console.error('Tcl parse error: ', e.message)
      return null
    }
    return ''
  }
  
  check(prune = true) {
    this.db.x(`select case when wm.check_drafts(${prune}) then wm.check_deps() end;`)	//Check versions/dependencies
  }
  
  pObject(...args) {
    let [name, obj, mod, deps, create, drop] = args
      , depList = "'{}'"
    if (deps)
      depList = `'{${deps.split(' ').map(s => Format.ident(s)).join(',')}}'`
    let sql = Format(`insert into wm.objects (obj_typ, obj_nam, deps, module, crt_sql, drp_sql) values (%L, %L, %s, %L, %L, %L);`, obj, name, depList, mod, create, drop)
//console.log('sql:', sql)
    this.db.x(sql)
    this.module(mod, this.dirName)
  }

  pPriv(...args) {
    let [name, obj, lev, group, give] = args
    let sql = Format('select wm.grant(%L, %L, %L, %s, %L);', obj, name, group, parseInt(lev), give)
    this.db.x(sql)
  }
  
  pQuery(...args) {
    let [name, sql] = args
    this.db.x(sql)
  }
  
  pCnat(...args) {
    let [name, obj, col, nat, ncol] = args
    let sql = Format(`update wm.objects set col_data = array_append(col_data,'nat,${[col,nat,ncol].join(',')}') where obj_typ = %L and obj_nam = %L and obj_ver = 0;`, obj, name)
    this.db.x(sql)
  }

  pPkey(...args) {
    let [name, obj, cols]  = args
    let sql = Format(`update wm.objects set col_data = array_prepend('pri,${cols.split(' ').join(',')}',col_data) where obj_typ = %L and obj_nam = %L and obj_ver = 0;`, obj, name)
    this.db.x(sql)
  }
  
  destroy() {
    this.tcl.cmdSync("wmparse::cleanup")
  }
  
}	//class

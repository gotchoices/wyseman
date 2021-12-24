//Manage data migration commands
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- 
const Fs = require('fs')
const Path = require('path')
const Format = require('pg-format')
const Splitargs = require('splitargs')
const DeltaFile = "Wyseman.delta"

module.exports = class {
  constructor(db, mainDir) {
    this.db = db
    this.mainDir = mainDir		//Primary module in this folder
  }

// Load a delta file from the specified folder
// -----------------------------------------------------------------------------
  loadFile(dir = '.') {
    let fileName = Path.join(dir, DeltaFile)
//console.log("Load:", fileName)
    if (Fs.existsSync(fileName)) {
      let deltaData = Fs.readFileSync(fileName).toString()
      return deltaData ? JSON.parse(deltaData) : {}
    }
    return {}
  }

// Write changes to a delta file in the specified folder
// -----------------------------------------------------------------------------
  saveFile(delta, dir = '.') {
    let fileName = Path.join(dir, DeltaFile)
      , fileText = JSON.stringify(delta, null, 2)
    Fs.writeFileSync(fileName, fileText)
  }
  
// Write deltas to the database
// -----------------------------------------------------------------------------
  pushDB(delta) {
//console.log("PushDB:", delta)
    let sql = ''
    for (let obj of Object.keys(delta)) {	//Push only deltas not already applied
      let objLit = Format.literal(obj)

      let q = `select delta from wm.objects_v_max where obj_typ = 'table' and obj_nam = ${objLit}`
      let r = this.db.x(q)
//console.log("Push obj:", obj, 'Q:', q, 'R:', r)

      let oldDel = this.db.one(`select delta from wm.objects_v_max where obj_typ = 'table' and obj_nam = ${objLit}`).delta || []
//console.log(" push:", obj, delta[obj], "\n  old:", oldDel)
      for (let el of delta[obj]) {		//Check is this element already in the DB?
        if (!oldDel.reduce((sofar, oel) => {	//Check properties for equality
          if (sofar === true || sofar === false) return sofar
          if (oel.dirty) return false		//Mark existing dirty as dirty
          if (el.oper == oel.oper && el.col == oel.col && el.spec == oel.spec) return true
        }, null)) {				//Mark new migrations so the will get applied
          el.dirty = true
        }
      }
      let delLit = Format.literal(JSON.stringify(delta[obj]))
      sql += `update wm.objects_v_max set delta = ${delLit} where obj_typ = 'table' and obj_nam = ${objLit};\n`
    }
    let res = this.db.x(sql)
//console.log("push:", sql, res)
    if (!res) throw "Error writing migration deltas to the database"
  }
  
// Read deltas from the database
// -----------------------------------------------------------------------------
//  pullDB() {
//    let sql = 'select jsonb_object_agg(obj_nam, delta) as delta from wm.objects_v_next where not delta isnull;'
//      , res = this.db.one(sql)
//console.log("pullDB res:", res.delta)
//    return res.delta
//  }
  
// Process a delta command
// -----------------------------------------------------------------------------
  command(delta, command) {
    let [ obj, oper, col, spec ] = Splitargs(command)
      , cmd = {oper, col, spec}
      , dbObj = this.db.one('select obj_typ, obj_nam from wm.objects_v_next where obj_nam = $1', [obj])
//console.error("cmd:", obj, cmd)
    if (!dbObj) throw "Can't find object: " + obj + " specified in delta command"
    if (dbObj.obj_typ != 'table') throw "Migrations only supported for tables"

    if (!(obj in delta)) delta[obj] = []
    if (oper == 'pop') {
      delta[obj].pop()
    } else {
//      cmd.dirty = true	//DB responsible for this
      delta[obj].push(cmd)
    }
    return delta
  }

// Process a delta command
// -----------------------------------------------------------------------------
  process(command, dir = '.') {
    let delta = this.loadFile(dir)
    this.command(delta, command)
    this.saveFile(delta, dir)
  }

// Update the DB from one or more directories
// -----------------------------------------------------------------------------
  updateDB(dirs = ['.'], commit = false) {
    for (let dir of dirs) {
      let delta = this.loadFile(dir)
//console.log("dir:", dir, "delta:", delta)
      if (Object.keys(delta).length > 0) this.pushDB(delta)
      if (commit && dir != this.mainDir) {	//Can't commit with deltas in sub modules
        if (delta.length > 0)
          throw "Can't commit while sub-module in: " + dir + " has pending deltas"
      }
    }
  }

// Clear out all migration commands
// -----------------------------------------------------------------------------
  clear(dir = this.mainDir) {
    let delta = {}
    this.saveFile(delta, dir)
  }

// Update one or more delta files from the database
// -----------------------------------------------------------------------------
//  updateFiles(dirs = ['.']) {
//    let deltAll = this.pullDB()			//Pull all deltas from DB
//console.log("deltAll:", deltAll)
//    for (let dir of dirs) {
//      let delta = this.loadFile(dir)		//Grab delta file from each dir
//      for (let key of Object.keys(delta)) {
//        if (key in deltAll)			//Update values from DB
//          delta[key] = deltAll[key]
//console.log("key:", key, deltAll[key])
//      }
//console.log("delta:", dir, delta)
//      this.saveFile(delta, dir)			//And save as files
//    }
//  }
}	//class

//Manage data migration commands
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- 
const Fs = require('fs')
const Path = require('path')
const Format = require('pg-format')
const DeltaFile = "Wyseman.delta"

module.exports = class {
  constructor(db, mainDir = '.') {
    this.db = db
    this.mainDir = mainDir		//Primary module in this folder
  }

// Load a delta file from the specified folder
// -----------------------------------------------------------------------------
  loadFile(dir = this.mainDir) {
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
  saveFile(delta, dir = this.mainDir) {
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
      let row = this.db.one(Format('select delta as "oldDel", del_idx as "delIdx" from wm.objects_v_max where obj_typ = %L and obj_nam = %L', 'table', obj))
        , { oldDel, delIdx } = row || {}
//console.log(" push:", obj, delta[obj], "\n  old:", oldDel)
      if (!oldDel) throw "Can't find table: " + obj
      for (let el of delta[obj]) {		//Check is this element already in the DB?
        if (!oldDel.includes(el)) oldDel.push(el)
      }
      sql += Format("update wm.objects_v_max set delta = array[%L]::text[] where obj_typ = 'table' and obj_nam = %L;\n", oldDel, obj)
    }
    let res = this.db.x(sql)
//console.log("sql:", sql, res)
    if (!res) throw "Error writing migration deltas to the database"
  }
  
// Process a delta command
// -----------------------------------------------------------------------------
  command(delta, command) {
    let match = command.match(/^(?<obj>[\w.]+)\b\s*(?<cmd>.*)$/)	//Pull first token off
      , { obj, cmd } = match.groups
      , dbObj = this.db.one('select obj_typ, obj_nam from wm.objects_v_next where obj_nam = $1', [obj])
//console.error("Mig cmd:", command, 'O:', match)
    if (!dbObj) throw "Can't find object: " + obj + " specified in delta command"
    if (dbObj.obj_typ != 'table') throw "Migrations only supported for tables"

    if (!(obj in delta)) delta[obj] = []
    if (cmd == 'pop') {
      delta[obj].pop()
    } else {
      delta[obj].push(cmd)
    }
    return delta
  }

// Process a delta command
// -----------------------------------------------------------------------------
  process(command, dir = this.mainDir) {
    let delta = this.loadFile(dir)
    this.command(delta, command)
    this.saveFile(delta, dir)
  }

// Update the DB from one or more directories
// -----------------------------------------------------------------------------
  updateDB(dirs = [this.mainDir], commit = false) {
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

}	//class

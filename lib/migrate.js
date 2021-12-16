//Manage data migration commands
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- Command updates DB first
//- Then dump all deltas from DB view, back into Wyseman.delta
//- Mark new records as dirty:true
//- 
const Fs = require('fs')
const Path = require('path')
const Format = require('pg-format')
const Splitargs = require('splitargs')
const DeltaFile = "Wyseman.delta"

module.exports = class {
  constructor(db) {
    this.db = db
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
    let sql = ''
    for (let obj of Object.keys(delta)) {
//console.log("Push:", obj, delta[obj])
      let ol = Format.literal(obj)
      let dl = Format.literal(JSON.stringify(delta[obj]))
      sql += `update wm.objects_v_max set delta = ${dl} where obj_typ = 'table' and obj_nam = ${ol};\n`
    }
    let res = this.db.x(sql)
//console.log("push:", sql, res)
    if (!res) throw "Error writing migration deltas to the database"
  }
  
// Read deltas from the database
// -----------------------------------------------------------------------------
  pullDB() {
    let sql = 'select jsonb_object_agg(obj_nam, delta) as delta from wm.objects_v_max where not delta isnull;'
      , res = this.db.one(sql)
//console.log("pullDB res:", res.delta)
    return res.delta
  }
  
// Process a delta command
// -----------------------------------------------------------------------------
  command(delta, command) {
    let [ obj, oper, col, spec ] = Splitargs(command)
      , cmd = {oper, col, spec}
      , dbObj = this.db.one('select obj_typ, obj_nam from wm.objects_v where obj_nam = $1 and release = wm.release()', [obj])
//console.log("cmd:", obj, cmd)
    if (!dbObj) throw "Can't find object: " + obj + " specified in delta command"
    if (dbObj.obj_typ != 'table') throw "Migrations only supported for tables"

    if (!(obj in delta)) delta[obj] = []
    if (oper == 'pop') {
      delta[obj].pop()
    } else {
      cmd.dirty = true
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
  updateDB(dirs = ['.']) {
    for (let dir of dirs) {
      let delta = this.loadFile(dir)
//console.log("delta:", delta)
      this.pushDB(delta)
    }
  }

// Update one or more delta files from the database
// -----------------------------------------------------------------------------
  updateFiles(dirs = ['.']) {
    let deltAll = this.pullDB()			//Pull all deltas from DB
//console.log("deltAll:", deltAll)
    for (let dir of dirs) {
      let delta = this.loadFile(dir)		//Grab delta file from each dir
      for (let key of Object.keys(delta)) {
        if (key in deltAll)			//Update values from DB
          delta[key] = deltAll[key]
//console.log("key:", key, deltAll[key])
      }
//console.log("delta:", dir, delta)
      this.saveFile(delta, dir)			//And save as files
    }
  }
}	//class

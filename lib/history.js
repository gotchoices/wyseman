//Track older objects, not a part of the current release
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- Remove obsolete, commented code
//- 
const Fs = require('fs')
const Path = require('path')
const Format = require('pg-format')
const { EncodeSql } = require('./schema')
const HistoryFile = "Wyseman.hist"

module.exports = class {
  constructor(db, dir, module = 'unknown') {
    this.db = db
    this.dir = dir
    let dbHist = db.one('select wm.hist();').hist		//Fetch DB's idea of history
      , empty = (d) => (d.prev.length == 0 && d.releases.length <= 1)
      , compare = (d,f) => (d.prev.length < f.prev.length || d.releases.length != f.releases.length)
      , fileHist = this.loadFile()
//console.log('fileHist:', fileHist)
//console.log('dbHist:', dbHist)

    this.hist = fileHist
    this.module = module
    if (!fileHist || empty(fileHist)) {	//File history empty or just created
      dbHist.module = dbHist.module || module
      if (!('arch' in dbHist)) dbHist.arch = []
      dbHist.prev = EncodeSql(dbHist.prev)
      this.hist = dbHist
      this.saveFile()			//Create one from what is in the DB

    } else if (empty(dbHist)) {		//No history in database
      this.pushDB()			//Create it to match our file version

    } else if (compare(dbHist, fileHist)) {
      throw "Database and file histories disagree, can't proceed!"
    }
  }

// Current loaded history object
// -----------------------------------------------------------------------------
  get() {
//console.log("Hist get:", this.hist)
    return this.hist
  }

// Load history file from the specified folder
// -----------------------------------------------------------------------------
  loadFile(dir = this.dir) {
    let fileName = Path.join(dir, HistoryFile)
//console.log("Hist load:", fileName)
    if (Fs.existsSync(fileName)) {
      let histData = Fs.readFileSync(fileName).toString()
      return histData ? JSON.parse(histData) : undefined
    }
    return undefined
  }

// Write changes to a delta file in the specified folder
// -----------------------------------------------------------------------------
  saveFile(history = this.hist, dir = this.dir) {
    let fileName = Path.join(dir, HistoryFile)
      , fileText = JSON.stringify(history, null, 2)
    Fs.writeFileSync(fileName, fileText)
  }
  
// Promote a minor or major (commit) release
// -----------------------------------------------------------------------------
  promote(archSch) {		//If committing, supply a schema object to pull archive items from
    let history = this.hist
      , releases = history.releases
      , length = releases.length || 1
      , end = length - 1
    if (!Number.isInteger(releases[end])) {	//Last element should be a beta number
      releases[end++] = 0
    }
//console.log("Promote:", end, !!archSch)
    if (archSch) {				//Doing a full commit
      let dbHist = this.db.one('select wm.commit();').commit	//Commit the database
        , newNext = dbHist.releases.length
        , relIdx = newNext - 2					//Index into 0-based archive array
        , {boot, init, dict} = archSch.get(true, false)		//Will archive these with release
        , arch = {boot, init, dict}		//Object to archive
//console.log(" commit:", relIdx, newNext)
      if (newNext != length + 1 || relIdx < 0)
        throw "Database reports release: " + newNext + " file: " + (end + 1)
      history.releases = dbHist.releases
      history.prev = dbHist.prev

      if (relIdx > 0) {			//If not first release, trim redundant items from archive
        let prvIdx = relIdx - 1
        Object.keys(arch).forEach(k => {	//Check boot, init, dict properties
          let lastVal, x = prvIdx		//Find last non-null value for this property
          for (lastVal = history.arch[x][k]; !lastVal && x >= 0; x--)
            lastVal = history.arch[x][k]
//console.log("CMP:", k, history.arch[prvIdx][k] == arch[k])
          if (arch[k] == lastVal)		//If same as last non-null value
            arch[k] = null			//Don't store it again
        })
      }
      history.arch[relIdx] = arch
//console.log(" hist:", relIdx, JSON.stringify(history,null,2))
    } else {
      releases[end]++			//Or increment beta number
    }
//console.log("Promote:", history)
    this.saveFile()
  }

// Write historical objects to the database
// -----------------------------------------------------------------------------
  pushDB(history = this.hist) {
    let sql = ''
console.log("Hist push:", history)
    history.releases.forEach((el,ix) => {
      let cdate = Number.isInteger(el) ? 'null' : Format.literal(el)
      sql += `insert into wm.releases (release, committed) values (${ix+1}, ${cdate})
        on conflict on constraint releases_pkey do update set committed = ${cdate};\n`
    })
    history.prev.forEach((el,ix) => {
console.log(" el:", ix, el)
      sql += `--insert history update here;\n`
    })
console.log(" push:", sql)
    let res = this.db.x(sql)
    if (!res) throw "Error writing migration histories to the database"
  }
  
}	//class

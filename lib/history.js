//Track older objects, not a part of the current release
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- Remove obsolete, commented code
//- 
const Fs = require('fs')
const Path = require('path')
const Format = require('pg-format')
const HistoryFile = "Wyseman.hist"

module.exports = class {
  constructor(db, dir, module = 'unknown') {
    this.db = db
    this.dir = dir
    let dbHist = db.one('select wm.hist();').hist		//Fetch DB's idea of history
      , empty = (d) => (d.past.length == 0 && d.releases.length <= 1)
      , compare = (d,f) => (d.past.length < f.past.length || d.releases.length != f.releases.length)
      , fileHist = this.loadFile()
//console.log('fileHist:', fileHist)
//console.log('dbHist:', dbHist)

    this.hist = fileHist
    this.module = module
    if (!fileHist || empty(fileHist)) {	//File history empty or just created
      dbHist.module = dbHist.module || module
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
  
// Process a release command (get current, commit, etc.)
// -----------------------------------------------------------------------------
  promote(commit = false) {
    let history = this.hist
      , releases = history.releases
      , length = releases.length || 1
      , end = length - 1
    if (!Number.isInteger(releases[end])) {	//Last element should be a beta number
      releases[end++] = 0
    }
    if (commit) {			//Enter a date for working entry
      let dbHist = this.db.one('select wm.commit();').commit
        , newNext = dbHist.releases.length
//console.log("DB commit:", end, JSON.stringify(dbHist,null,2))
      if (newNext != length + 1)
        throw "Database reports release: " + newNext + " file: " + (end + 1)
      history.releases = dbHist.releases
      history.past = dbHist.past
    } else {
      releases[end]++			//Or increment beta number
    }
//console.log("Promote:", history)
    return history
  }

// Process a promote release command
// -----------------------------------------------------------------------------
  process(commit) {
    this.promote(commit)
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
    history.past.forEach((el,ix) => {
console.log(" el:", ix, el)
      sql += `--insert history update here;\n`
    })
console.log(" push:", sql)
    let res = this.db.x(sql)
    if (!res) throw "Error writing migration histories to the database"
  }
  
}	//class

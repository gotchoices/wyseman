//Track older objects, not a part of the current release
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
//- Build default history file
//- Fetch any old objects from DB --> file
//- Command to commit new version
//- Schema build draws version from this file
//- Remove "dir" arguments from regular calls (use default launch dir)
//- 
const Fs = require('fs')
const Path = require('path')
const Format = require('pg-format')
const HistoryFile = "Wyseman.hist"
//const HistQuery = `select null as module,
//  (select jsonb_agg(coalesce(to_jsonb(r.committed::text), '0'::jsonb)) as releases
//    from (select * from wm.releases order by 1) r),
//  (select to_jsonb(coalesce(array_agg(o), '{}')) as history from
//    (select obj_nam,obj_ver,release,min_rel,max_rel
//      from wm.objects_v where max_rel < wm.next() order by 1,2) o)`

module.exports = class {
  constructor(db, dir, module = 'unknown') {
    this.db = db
    this.dir = dir
    this.module = module
    let dbHist = db.one('select wm.commit(false);').commit		//Fetch DB's idea of history
      , empty = (d) => (d.history.length == 0 && d.releases.length <= 1)
      , compare = (d,f) => (d.history.length < f.history || d.releases.length != f.releases.length)
      , fileHist = this.loadFile()

    if (!fileHist) this.saveFile(fileHist = {module, releases: [0], history: []})
//console.log('fileHist:', fileHist)
//console.log('dbHist:', dbHist)

    if (empty(fileHist)) {		//File history empty or just created
      dbHist.module = module
      this.saveFile(dbHist, dir)	//Create one from what is in the DB

    } else if (empty(dbHist)) {		//No history in database
      this.pushDB(fileHist)		//Create it to match our file version

    } else if (compare(dbHist, fileHist)) {
      throw "Database and file histories disagree, can't proceed!"
    }
  }

// Load a delta file from the specified folder
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
  saveFile(history, dir = this.dir) {
    let fileName = Path.join(dir, HistoryFile)
      , fileText = JSON.stringify(history, null, 2)
    Fs.writeFileSync(fileName, fileText)
  }
  
// Process a release command (get current, commit, etc.)
// -----------------------------------------------------------------------------
  promote(history, commit = false) {
    let releases = history.releases
      , length = releases.length || 1
      , end = length - 1
    if (!Number.isInteger(releases[end])) {	//Last element should be a beta number
      releases[end++] = 0
    }
    if (commit) {			//Enter a date for working entry
      let dbHist = this.db.one('select wm.commit(true);').commit
        , newNext = dbHist.releases.length
//console.log("DB commit:", end, JSON.stringify(dbHist,null,2))
      if (newNext != length + 1)
        throw "Database reports release: " + newNext + " file: " + (end + 1)
      history.releases = dbHist.releases
      history.history = dbHist.history
    } else {
      releases[end]++			//Or increment beta number
    }
//console.log("Promote:", history)
    return history
  }

// Process a promote release command
// -----------------------------------------------------------------------------
  process(commit) {
    let history = this.loadFile()
    this.promote(history, commit)
    this.saveFile(history)
  }

// Write historical objects to the database
// -----------------------------------------------------------------------------
  pushDB(history) {
    let sql = ''
console.log("Hist push:", history)
    history.releases.forEach((el,ix) => {
      let cdate = Number.isInteger(el) ? 'null' : Format.literal(el)
      sql += `insert into wm.releases (release, committed) values (${ix+1}, ${cdate})
        on conflict on constraint releases_pkey do update set committed = ${cdate};\n`
    })
    history.history.forEach((el,ix) => {
      sql += `--insert history update here;\n`
    })
console.log(" push:", sql)
    let res = this.db.x(sql)
    if (!res) throw "Error writing migration histories to the database"
  }
  
// Read historical objects from the database
// -----------------------------------------------------------------------------
//  pullDB() {
//    let sql = 'select jsonb_object_agg(obj_nam, history) as history from wm.objects_v_next where not history isnull;'
//      , res = this.db.one(sql)
//console.log("Hist pullDB res:", res.history)
//    return res.history
//  }
  
// Update the DB from one or more directories
// -----------------------------------------------------------------------------
//  updateDB(dirs) {
//console.log("Hist dirs:", dirs)
//    for (let mod of Object.keys(dirs)) {
//      let dir = dirs[mod]
//       , history = this.loadFile(dir, mod)
//console.log("Hist mod:", mod, dir, history)
//      this.pushDB(history)
//    }
//  }

// Update one or more history files from the database
// -----------------------------------------------------------------------------
//  updateFiles(dirs) {
//    let deltAll = this.pullDB()			//Pull all historys from DB
//console.log("deltAll:", deltAll)
//    for (let dir of dirs) {
//      let history = this.loadFile(dir)		//Grab history file from each dir
//      for (let key of Object.keys(history)) {
//        if (key in deltAll)				//Update values from DB
//          history[key] = deltAll[key]
//console.log("key:", key, deltAll[key])
//      }
//console.log("history:", dir, history)
//      this.saveFile(history, dir)			//And save as files
//    }
//  }
}	//class

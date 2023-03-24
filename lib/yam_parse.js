//Parse a metadata description file in yaml format (alternative to tcl .wmd)
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
//TODO:
const	Fs	= require('fs')
const	Yaml	= require('yaml')
const	Format	= require('pg-format')

var unabbrev = function(short, longs) {		//Turn an abbreviated string into one of a set of full strings
  let regex = new RegExp('^' + short)
    , match = longs.find(el=>(el.match(regex)))		///console.log("Unabbrev:", short, longs, match)
  return match || short
}

var formalize = function(obj, arguments) {	//Turn any array elements into object properties
  if (Array.isArray(obj)) {			//;console.log('Fm:', obj, obj.slice(-1))
    let retObj = typeof obj.slice(-1)[0] == 'object' ? obj.pop() : {}	//Last element is already formal (if an object)
      , idx = 0					//To iterate through shortcut values
      , oLen = obj.length
      , aLen = arguments.length
    obj.forEach(el => {
      if (idx < oLen && idx < aLen) {
        let key = arguments[idx++]		//;console.log('->', key, ':', el)
        retObj[key] = el
      }
    })
    return retObj
  }
  return obj
}

let normalize = function(obj, props) {
  for (var prop in obj) {
    let val = obj[prop]
      , key = unabbrev(prop, props)
    if (key != prop) {			//If key value needs to be expanded
      obj[key] = val			//;console.log(prop, '->', key)
      delete obj[prop]			//Replace it
    }
  }
}

var quote = function(val) {		//Quote json data suitable for postgresql
  let qVal = typeof val == 'string' ? `to_jsonb(${Format.literal(val)}::text)`
           : typeof val == 'object' ? Format.literal(JSON.stringify(val))
           : `to_jsonb(${val})`		//;console.log('k:', typeof val, val, qVal)
  return qVal
}

var isYaml = function(data) {		//Is this a YAML file
  let lines = data.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]				//;console.log('line:', line)
    if (line.match(/^---\s*$/))
      return true
    else if (!line.match(/^#/))
      return false
  }
  return false
}

var expandValue = function(val, props) {
  let formal = formalize(val, props)
  normalize(formal, props)
  return formal
}

module.exports = function(file, sqlCB) {
  let yData = Fs.readFileSync(file).toString()
    , jData
    , qArr = []

  if (!isYaml(yData))
    return false
  jData = Yaml.parse(yData)
  for (var view in jData) {			//console.log('v:', view)
    let [ sch, tab ] = view.split('.')
      , vVal = formalize(jData[view], ['focus', 'fields'])
    normalize(vVal, ['focus', 'fields', 'display', 'sort', 'subviews', 'actions'])
    qArr.push(`delete from wm.table_style where ts_sch = '${sch}' and ts_tab = '${tab}'`)
    qArr.push(`delete from wm.column_style where cs_sch = '${sch}' and cs_tab = '${tab}'`)

    vVal.fields?.forEach(el => {
      let colEl = formalize(el, ['column', 'input', 'size', 'subframe'])
      normalize(colEl, ['column','title','help','subframe','onvalue','offvalue','special','special','background','justify','initial','template','optional','state','write','depend','display','inside','input','sort','hint'])

      colEl.subframe = expandValue(colEl.subframe, ['x','y','xspan','yspan'])
      colEl.size = expandValue(colEl.size, ['x','y'])
      
      let col = colEl.column; delete colEl.column
      Object.keys(colEl).forEach(key => {
        let val = colEl[key]
          , qVal = quote(val)
        if (val !== undefined)
          qArr.push(`insert into wm.column_style (cs_sch,cs_tab,cs_col,sw_name,sw_value) values ('${sch}','${tab}','${col}','${key}',${qVal})`)
      })
    })
    delete vVal.fields			//;console.log('V:', view, JSON.stringify(vVal, null, 2))

    Object.keys(vVal).forEach(key => {
      let val = vVal[key]
        , inherit = (key != 'actions')
        , qVal = quote(val)			//;console.log('qVal:', key, qVal)
      qArr.push(`insert into wm.table_style (ts_sch,ts_tab,sw_name,sw_value,inherit) values ('${sch}','${tab}','${key}',${qVal}, ${inherit})`)
    })
    
    ;['display', 'sort'].forEach(sw => {	//Apply table styles to individual columns
      let cols = vVal[sw]
        , fldList = []
        , idxList = []
      if (cols) {
        cols.forEach(col => {
          let c = col
          if (/^!/.test(c)) {
            c = col.slice(1)
          } else {
            idxList.push(Format.literal(c = col))
          }
          fldList.push(Format.literal(c))
        })
        qArr.push(`insert into wm.column_style (cs_sch,cs_tab,cs_col,sw_name,sw_value)
          select cdt_sch,cdt_tab,cdt_col, '${sw}',
          to_jsonb(coalesce(array_position(Array[${idxList.join(',')}], cdt_col::text), 0))
          from wm.column_data where cdt_sch = '${sch}' and cdt_tab = '${tab}'
          and cdt_col in (${fldList.join(',')}) on conflict do nothing`)
      }		//If cols
    })		//forEach
  }					//console.log('Sql:', qArr.join(';\n'))
  if (qArr.length > 0) sqlCB(qArr.join(';\n') + ';')
  return true
}

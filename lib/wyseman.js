//Manage one or more connections to a wyseman PostgreSQL database
//If the specified database doesn't exist, create it.
//If the bootstrap schema doesn't exist, create that too.
//Copyright WyattERP: GNU GPL Ver 3; see: License in root of this package
// -----------------------------------------------------------------------------
//TODO:
//X- Create and connect to database just-in-time
//- If schema initialization SQL fails, and we created the DB, should we delete it?
//- Port ruby code to js
//- 
//- 

const	u	= require('util')
const	_	= require('lodash')
const	fs	= require('fs');			//Node filesystem module
var	pg	= require('pg').native;			//PostgreSQL

module.exports = class Wyseman {
  constructor(conf) {
    if (conf.logger) {
      this.log = conf.logger			//Use a passed-in logger
    } else {
        let logger = u.debuglog('wyseman')	//Or default to our own
        this.log = {
          trace: function (msg) {logger(msg)},
          debug: function (msg) {logger(msg)},
          error: function (msg) {console.error(msg)}
        }
    }
    this.log.debug("In constructor conf=%s", JSON.stringify(conf))
    
    this.config = conf;					//Save configuration until we actually init
    this.language = conf.lang || 'en';			//Default to english
    this.client = new pg.Client(this.config);		//Client connection to db
    
    this.log.trace("Client:%s", JSON.stringify(this.client));
  }
  
// Log debugging info
// -------------------------------------------------------------------
//  log(msg) {
//    this.debug = function() {msg => this(msg)}
//  }

// Execute a user query, invoking a callback with the results
// -------------------------------------------------------------------
  _query(sql,cb) {
    this.client.query(sql, (err, res) => {	//Run the user's query
      if (err) throw err;			//Report any errors
      cb(res);					//Or run the user's callback
    });
  }

// Make sure there is a connection to a valid database, before executing the user's query
// -------------------------------------------------------------------
  query(sql, cb) {
this.log.debug("In query, connected:%s", this.client._connected);
    if (this.client._connected) return this._query(sql,cb);	//If connected, just execute the query

    this.client.connect(err => {				//Otherwise, try to connect
this.log.debug("Connect:");
      if (!err) return this._query(sql,cb);			//If that worked, just execute the query
this.log.debug("  connect error: %s", err.message);
      if (!/does not exist/.test(err.message)) throw err;	//Report anything other than DB does not exist error
      
      let tclient = new pg.Client(_.assignIn({}, this.config, {database: 'template1'}))
      tclient.connect(err => {					//Try connecting to template db
        if (err) throw err
        let dbname = this.client.connectionParameters.database
this.log.debug("DB name: %s", dbname);
        tclient.query("create database " + dbname)		//And create our database
          .then(res => {
            if (!this.config.schema) return
this.log.debug("Initialize Schema:%s", this.config.schema)
            fs.readFile(this.config.schema, 'utf8', (err, dat) => {
              if (err) throw err
this.log.debug("Have file dat, will try connect again")
              this.client.connect(err => {
                if (err) throw err
this.log.debug("Connected OK")
                this.client.query(dat)
                  .catch(err => this.log.error("Error initializing schema (%s): %s", this.config.schema, err.message))
                  .then(this._query(sql,cb))			//Finally process the user's SQL
                })		//query builds schema
            })			//readFile
        }).then(() => tclient.end()).catch(err => this.log.error("Error creating database %s: %s", dbname, err.message))
      })			//tclient connect
    })				//client connect
this.log.debug("Query returning");
  }

# -----------------------------------------------------------------------------
  t(sql, cb)						#Exec query as atomic transaction
    this.query("begin;\n" + sql; "\ncommit;", cb)
  end

//# -----------------------------------------------------------------------------
//  def esc(str)					#Short-hand for escaping sql (not in JS API)
//      escape_string (str)
//  end

//# -----------------------------------------------------------------------------
//  def qid(str)					#Short-hand for quoting identifier (not in JS API)
//      quote_ident (str)
//  end

//# -----------------------------------------------------------------------------
//  def one(query)					#Get a single row as an array
//      exec(query).values[0]
//  end

//# -----------------------------------------------------------------------------
//  def quote(tab, col, val, errchk = false)		#Return a value with single quote, if 
//    return val if col == 'oid'
//    tp = (cdat = column(tab, col))['type']
//#printf("  cdat:%s\n", cdat)
//    return 'null' if val == '' && cdat['nonull'] == 't'
//    if %w{numeric int int4 int8 float float4 float8}.include?(tp)
//      val = val.gsub(/[$,]/,'')
//      if val == ''
//        raise "Illegal blank value for table:#{tab} column:#{col}" if errchk
//        return 'null'
//      end
//      return val
//    elsif tp[0] == '_'
//      return "'#{esc(val)}'"
//    end
//    return "'" + (escape_string (val)) + "'"
//  end
  
//# -----------------------------------------------------------------------------
//  def table_split(tab)				#Split schema, table into array
//    return tab.split('.') if tab.include?('.')
//    return ['public',tab]
//  end

//# -----------------------------------------------------------------------------
//  def style(tab, col=nil)		# Return table or column default styles
//    #Port_me
//  end

//# -----------------------------------------------------------------------------
//  def view_oid (tab)			# Return name of an oid column (typically _oid) for a view
//    #Port_me
//  end

//# -----------------------------------------------------------------------------
//  def error_text (tab, code)		# Return the text for a specified message
//    #Port_me
//  end

//# -----------------------------------------------------------------------------
//  def table(tab)			# Return table text and type
//    idx = tab
//#printf("table tab:%s\n", tab)
//    if !@table_data[idx]
//      s, t = table_split(tab)
//      res = self.x("select tab_kind,has_pkey,columns,pkey from wm.table_data where td_sch = '#{esc(s)}' and td_tab = '#{esc(t)}';")
//      if res.ntuples >= 1
//        @table_data[idx] = res[0]
//      end
//    end
//    raise "No meta-information found for table:#{tab} column:#{col}" if !@table_data[idx]
//#p @table_data[idx]
//    return @table_data[idx]
//  end

//# -----------------------------------------------------------------------------
//  def column(tab, col = nil)	# Return hash containing column text and type, or all columns
//    if col
//      idx = tab + ':' + col
//#printf("column tab:%s col:%s idx:%s\n", tab, col, idx)
//      if !@column_data[idx] then
//        s, t = table_split(tab)
//        self.x("select col,title,help,type,nonull from wm.column_pub where sch = '#{esc(s)}' and tab = '#{esc(t)}' and language = '#{@lang}';").each { |rec|
//          ix = tab + ':' + rec['col']
//          rec.delete('col')
//          @column_data[ix] = rec
//#printf("  cd[%s]=%s\n", ix, rec)
//        }
//      end
//    else			# Return table data
//      #Port_me
//    end
//    raise "No meta-information found for table:#{tab} column:#{col}" if !@column_data[idx]
//    return @column_data[idx]
//  end

//# -----------------------------------------------------------------------------
//  def column_values(tab, col, value=nil)	# Return allowable values for a column if they exist
//    #Port_me
//  end

//# -----------------------------------------------------------------------------
//  def tables_ref(tab, refme=false)	# Return tables that are referenced (pointed to) by the specified table
//    #Port_me				# If refme true, return tables that reference the specified table
//  end

//# -----------------------------------------------------------------------------
//  def columns_fk(tab, ftab)		# Return the fk columns in a table and the pk columns they point to in a foreign table
//    #Port_me
//  end

//# -----------------------------------------------------------------------------
//  def comp_list(fdata, tab, func='=')	#Generate a list of fields = val
//    conds = []
//    fdata.each_pair { |idx, val|
//      conds << self.qid(idx) + " #{func} " + self.quote(tab,idx,val)
//    }
//    conds
//  end

//# -----------------------------------------------------------------------------
//  def doSelect(fields, tab=nil, where=nil)	#Run a select from given parameters
//#printf("Select fields:%s tab:%s where:%s\n", fields, tab, where)
//    frtab = tab ? " from " + tab : ''
//    if where.is_a?(Hash)
//      where = comp_list(where,tab).join(' and ')
//    elsif where.is_a?(Array)
//      where = where.join(' and ')
//    elsif !where
//      where = ''
//    end
//    where = " where " + where if where != ''
//    query = 'select ' + fields + frtab + where + ';'
//#printf("Select query:%s\n", query)
//    self.x query
//  end

//# -----------------------------------------------------------------------------
//  def doInsert(tab, data)		#Insert a record contained in a hash
//#printf("Insert tab:%s data:%s\n", tab, data)
//    fields, values = [], []
//    data.each_pair { |idx, val|
//        fields << self.qid(idx)
//        values << self.quote(tab,idx,val)
//    }
//    sql = "insert into #{tab} (#{fields.join(',')}) values (#{values.join(',')}) returning *;"
//puts 'Test_me:' + sql
//   res = self.x(sql)
//   raise 'Error inserting #{sql}' if res.ntuples != 1
//   res[0]
//  end

//# -----------------------------------------------------------------------------
//  def doUpdate(tab, data, where)	#Update records as specified in a hash
//#printf("Update table:%s data:%s where:%s\n", tab, data, where)
//    setems = comp_list(data, tab)
//    return nil if setems.length <= 0
//    if where.is_a?(Hash)
//      where = comp_list(where,tab).join(' and ')
//    elsif where.is_a?(Array)
//      where = where.join(' and ')
//    end
//    raise 'Illegal where clause' if !where
//    where = "where " + where if where != ''
//    sql = "update #{tab} set #{setems.join(',')} #{where};"
//#puts 'Test_me:' + sql
//    self.x sql
//  end

//# -----------------------------------------------------------------------------
//  def doDelete(tab, where)	#Delete records from a table
//printf("Delete from table:%s where:%s\n", tab, where)
//    if where.is_a?(Hash)
//      conds = comp_list(where,tab).join(' and ')
//    elsif where.is_a?(Array)
//      where = where.join(' and ')
//    end
//    raise 'Illegal where clause' if !where or where == ''
//    where = "where " + where
//    sql = "delete from #{tab} #{where};"
//puts 'Test_me:' + sql
//#    self.x sql
//  end
}	//class Wyseman

#Open a connection to a database, to be managed by wyseman.
#If the specified database doesn't exist, create it.
#If the bootstrap schema doesn't exist, create that too.
#Copyright WyattERP: GNU GPL Ver 3; see: License in root of this package
# -----------------------------------------------------------------------------
#TODO:
#- Test doInsert
#- Remove deprecated quote function
#- 
require 'pg'
Opers		= ['=', '!=', '<', '<=', '>', '>=', '~', 'in']

module Wyseman
class DB < PG::Connection
  def initialize (opts = {})
    bootstrap = File.join(File.dirname(__FILE__), '..' , 'bootstrap.sql')
    schema = opts[:schema] || bootstrap			#Allow user-specified bootstrap file
    opts.delete(:schema)
    devel = opts[:devel]
    opts.delete(:devel)
    
#puts "Opts:#{opts} schema:#{schema}"
    begin
      super(opts)					#Initialize DB
    rescue PG::ConnectionBad				#If can't connect
      (tmpOpts = opts.dup)[:dbname] = 'template1'
      db = PG::Connection.new(tmpOpts)			#Connect to template db
      opts[:dbname] ||= db.exec("select current_user;").getvalue(0,0)	#Get my PG username if no username specified explicitly
#puts " opts:#{opts} tmpOpts:#{tmpOpts}"
      db.exec "create database " + quote_ident(opts[:dbname])	#Create my database
      db.close
      super(opts)					#And try reconnecting
    end

    set_notice_receiver { |res|				#Callback for DB async notices
      puts res.error_message().split("\n")[0];		#Strip out any CONTEXT: lines
    }
      
    begin
      release = one("select wm.release();")[0]		#If wyseman schema doesn't exist
    rescue PG::InvalidSchemaName			#create it from an app-specific schema setup
#puts "Schema file:#{schema}"
      t(File.open(schema,'r').read)
    end
    
    begin
      one("select max(release) from wm.releases;")	#If development schema doesn't exist
    rescue PG::UndefinedTable				#create it, if development switch specified
      t(File.open(bootstrap,'r').read)
    end if devel
    
    @column_data = {}					#cache of column information
    @table_data = {}					#and table information
  end

# -----------------------------------------------------------------------------
  def x(query, parms = nil)				#Short-hand for exec
      exec_params(query, parms)
  end

# -----------------------------------------------------------------------------
  def t(query)						#Exec query as atomic transaction
      transaction { |c| c.exec(query)}
  end

# -----------------------------------------------------------------------------
  def one(query, parms = nil)				#Get a single row as an array
      exec_params(query, parms).values[0]
  end

# -----------------------------------------------------------------------------
  def esc(str)						#Short-hand for escaping sql
      escape_string (str)
  end

# Depricated
# -----------------------------------------------------------------------------
  def qid(str)						#Short-hand for quoting identifier
      quote_ident (str)
  end

# Depricated
# Should use parameterized queries instead.  Only used for building schema file now in wyseman
# -----------------------------------------------------------------------------
  def quote(tab, col, val, errchk = false)		#Return a value with single quote, if 
    return val if col == 'oid'
#printf("tab:%s col:%s val:%s\n", tab, col, val)
    tp = (cdat = column(tab, col))['type']
#printf("  cdat:%s\n", cdat)
    return 'null' if val == '' && cdat['nonull'] != 't'
    if %w{numeric int int4 int8 float float4 float8}.include?(tp)
      val = val.gsub(/[$,]/,'')
      if val == ''
        raise "Illegal blank value for table:#{tab} column:#{col}" if errchk
        return 'null'
      end
      return val
    elsif tp[0] == '_'
      return "'#{esc(val)}'"
    end
    return "'" + (escape_string (val)) + "'"
  end
  
# -----------------------------------------------------------------------------
  def table_split(tab)				#Split schema, table into array
    return tab.split('.') if tab.include?('.')
    return ['public',tab]
  end

# -----------------------------------------------------------------------------
  def style(tab, col=nil)		# Return table or column default styles
    #Port_me?
  end

# -----------------------------------------------------------------------------
  def view_oid (tab)			# Return name of an oid column (typically _oid) for a view
    #Port_me?
  end

# -----------------------------------------------------------------------------
  def message_text (tab, code)		# Return the text for a specified message
    #Port_me?
  end

# -----------------------------------------------------------------------------
  def table(tab)			# Return meta-data about tables
    idx = tab
#printf("table tab:%s\n", tab)
    if !@table_data[idx]
      s, t = table_split(tab)
      res = self.x("select tab_kind,has_pkey,cols,pkey from wm.table_data where td_sch = '#{esc(s)}' and td_tab = '#{esc(t)}';")
      if res.ntuples >= 1
        @table_data[idx] = res[0]
      end
    end
    raise "No meta-information found for table:#{tab} column:#{col}" if !@table_data[idx]
#p @table_data[idx]
    return @table_data[idx]
  end

# -----------------------------------------------------------------------------
  def column(tab, col = nil)		# Return hash containing column meta-data, or all columns
    if col
      idx = tab + ':' + col
#printf("column tab:%s col:%s idx:%s\n", tab, col, idx)
      if !@column_data[idx] then
        s, t = table_split(tab)
        self.x("select cdt_col as col,field,type,nonull,def,length,pkey from wm.column_data where cdt_sch = '#{esc(s)}' and cdt_tab = '#{esc(t)}';").each { |rec|
          ix = tab + ':' + rec['col']
          rec.delete('col')
          @column_data[ix] = rec
#printf("  cd[%s]=%s\n", ix, rec)
        }
      end
    else			# Return table data
      #Port_me
    end
    raise "No meta-information found for table:#{tab} column:#{col}" if !@column_data[idx]
    return @column_data[idx]
  end

# -----------------------------------------------------------------------------
  def column_values(tab, col, value=nil)	# Return allowable values for a column if they exist
    #Port_me?
  end

# -----------------------------------------------------------------------------
  def tables_ref(tab, refme=false)	# Return tables that are referenced (pointed to) by the specified table
    #Port_me?				# If refme true, return tables that reference the specified table
  end

# -----------------------------------------------------------------------------
  def columns_fk(tab, ftab)		# Return the fk columns in a table and the pk columns they point to in a foreign table
    #Port_me?
  end

# -----------------------------------------------------------------------------
  def comp_list(fdata, res, func='=')	#Generate a list of fields = val
    i = res[:parms].length + 1
    conds = []; fdata.each_pair { |idx, val|
      conds << quote_ident(idx.to_s) + " #{func} $" + i.to_s; i += 1
      res[:parms] << val
    }
    conds
  end

# -----------------------------------------------------------------------------
  def buildWhere(logic, res)				#Generate a where clause and its parameters
    i = res[:parms].length + 1				#parameter counter
    if logic.is_a?(String)				#Explicit where clause (potential security hole)
      return(logic)
    elsif logic.key?('items')
      logic[:and] = true if !logic.key?('and')		#Default to ands
      clauses = []
      logic[:items].each { |item| clauses << buildWhere(item, res)}
      return clauses.join(logic[:and] ? ' and ' : ' or ')
    elsif logic.key?('left')
      oper = logic[:oper] || '='
      raise "Invalid operator: #{oper}" if !Opers.include?(oper)
      res[:parms] << (logic[:entry] || logic[:right] || '')
      clause = "#{quote_ident(logic.left)} #{oper} $#{i}"; i += 1
      return clause
    elsif logic.is_a?(Hash)
      clauses = []
      logic.each_pair { |key, val|
        clauses << "#{quote_ident(key.to_s)} = $#{i}"; i += 1
        res[:parms] << val
      }
      return clauses.join(' and ')
    end
    raise "mangled logic: #{logic}"
  end

# -----------------------------------------------------------------------------
  def doSelect(fields, tab=nil, logic=nil)	#Run a select from given parameters
#printf("Select fields:%s tab:%s logic:%s\n", fields, tab, logic)
    res = {parms:[]}
    frtab = tab ? " from " + tab.split('.').map{|n| quote_ident(n)}.join('.') : ''
    where = buildWhere(logic, res)
    wwhere = " where " + where if where != ''
    query = 'select ' + fields + frtab + wwhere + ';'
#printf("Select query:%s parms:%s\n", query, res[:parms])
    exec_params(query, res[:parms])
  end

# -----------------------------------------------------------------------------
  def doInsert(tab, data)		#Insert a record contained in a hash
#printf("Insert tab:%s data:%s\n", tab, data)
    parms = []
    i = parms.length + 1				#parameter counter
    fields = []; values = []
    data.each_pair { |key, val|
        fields << self.quote_ident(key)
        values << "$" + i.to_s; i += 1
        parms << val
    }
    sql = "insert into #{tab.split('.').map{|n| quote_ident(n)}.join('.')} (#{fields.join(',')}) values (#{values.join(',')}) returning *;"
#printf "Test_me:%s :%s\n", sql, parms
   res = exec_params(sql, parms)
   raise 'Error inserting #{sql}' if res.ntuples != 1
   res[0]
  end

# -----------------------------------------------------------------------------
  def doUpdate(tab, data, logic)	#Update records as specified in a hash
#printf("Update table:%s data:%s logic:%s\n", tab, data, logic)
    res = {parms:[]}
    setems = comp_list(data, res)
    return nil if setems.length <= 0
    where = buildWhere(logic, res)
    raise 'Illegal where clause' if !where
    wwhere = "where " + where if where != ''
    sql = "update #{tab.split('.').map{|n| quote_ident(n)}.join('.')} set #{setems.join(',')} #{wwhere};"
#printf "Test_me:%s :%s\n", sql, res[:parms]
    exec_params(sql, res[:parms])
  end

# -----------------------------------------------------------------------------
  def doDelete(tab, where)	#Delete records from a table
#printf("Delete from table:%s where:%s\n", tab, where)
    res = {parms:[]}
    wh = buildWhere(where, res)
    raise 'unbounded delete' if res[:parms].length <= 0
    sql = "delete from #{tab.split('.').map{|n| quote_ident(n)}.join('.')} where #{wh};"
#printf "Test_me:%s :%s\n", sql, res[:parms]
    exec_params(sql, res[:parms])
  end

end	#class DB
end	#module Wyseman

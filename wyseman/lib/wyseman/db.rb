#Open a connection to a database, to be managed by wyseman.
#If the specified database doesn't exist, create it.
#If the bootstrap schema doesn't exist, create that too.
#Copyright WyattERP: GNU GPL Ver 3; see: License in root of this package
# -----------------------------------------------------------------------------
#TODO:
#- Support for more than just english in initialize()
#- Test if args passed in, like port, dbname
#- Test if args passed in as a hash
#- 
require 'pg'

module Wyseman
class DB < PG::Connection
  def initialize (*args)
    begin
      @lang = 'en'					#Fixme
      super(*args)
    rescue PG::ConnectionBad				#If can't connect
      (args[-1] = (oldh = args[-1]).dup)[:dbname] = 'template1'
      db = PG::Connection.new(*args)			#Connect to template db
      oldh[:dbname] = db.exec("select current_user;").getvalue(0,0) if !oldh[:dbname]	#Get my PG username if no username specified explicitly
      db.exec "create database " + qid(oldh[:dbname])	#Create my database
      db.close
      args[-1] = oldh
      super(*args)					#And try reconnecting
    end

    set_notice_receiver { |res|
      puts res.error_message().split("\n")[0];		#Strip out any CONTEXT: lines
    }
      
    begin
      one("select count(*) from wm.objects;")		#If bootstrap schema doesn't exist
    rescue PG::UndefinedTable				#create it
      t(File.open(File.join(File.dirname(__FILE__), '..' , 'bootstrap.sql'),'r').read)
    end
    
    @column_data = {}
    @table_data = {}
  end

# -----------------------------------------------------------------------------
  def x(query)						#Short-hand for exec
      exec(query)
  end

# -----------------------------------------------------------------------------
  def t(query)						#Exec query as atomic transaction
      transaction { |c| c.exec(query)}
  end

# -----------------------------------------------------------------------------
  def esc(str)						#Short-hand for escaping sql
      escape_string (str)
  end

# -----------------------------------------------------------------------------
  def qid(str)						#Short-hand for quoting identifier
      quote_ident (str)
  end

# -----------------------------------------------------------------------------
  def one(query)					#Get a single row as an array
      exec(query).values[0]
  end

# -----------------------------------------------------------------------------
  def quote(tab, col, val, errchk = false)		#Return a value with single quote, if 
    return val if col == 'oid'
    tp = (cdat = column(tab, col))['type']
#printf("  cdat:%s\n", cdat)
    return 'null' if val == '' && cdat['nonull'] == 't'
    if %w{numeric int int4 int8 float float4 float8}.include?(tp)
      val.gsub!(/[$,]/,'')
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
    #Port_me
  end

# -----------------------------------------------------------------------------
  def view_oid (tab)			# Return name of an oid column (typically _oid) for a view
    #Port_me
  end

# -----------------------------------------------------------------------------
  def error_text (tab, code)		# Return the text for a specified message
    #Port_me
  end

# -----------------------------------------------------------------------------
  def table(tab)			# Return table text and type
    idx = tab
#printf("table tab:%s\n", tab)
    if !@table_data[idx]
      s, t = table_split(tab)
      res = self.x("select tab_kind,has_pkey,columns,pkey from wm.table_data where td_sch = '#{esc(s)}' and td_tab = '#{esc(t)}';")
      if res.ntuples >= 1
        @table_data[idx] = res[0]
      end
    end
    raise "No meta-information found for table:#{tab} column:#{col}" if !@table_data[idx]
#p @table_data[idx]
    return @table_data[idx]
  end

# -----------------------------------------------------------------------------
  def column(tab, col = nil)	# Return hash containing column text and type, or all columns
    if col
      idx = tab + ':' + col
#printf("column tab:%s col:%s idx:%s\n", tab, col, idx)
      if !@column_data[idx] then
        s, t = table_split(tab)
        self.x("select col,title,help,type,nonull from wm.column_pub where sch = '#{esc(s)}' and tab = '#{esc(t)}' and language = '#{@lang}';").each { |rec|
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
  def column_values(table, column, value=nil)	# Return allowable values for a column if they exist
    #Port_me
  end

# -----------------------------------------------------------------------------
  def tables_ref(table, refme=false)	# Return tables that are referenced (pointed to) by the specified table
    #Port_me				# If refme true, return tables that reference the specified table
  end

# -----------------------------------------------------------------------------
  def columns_fk(table, ftable)		# Return the fk columns in a table and the pk columns they point to in a foreign table
    #Port_me
  end

# -----------------------------------------------------------------------------
  def doSelect(fields, tab, where)	#Run a select from given parameters
    if where.is_a?(Hash)
      conds = []
      where.each_pair { |idx, val|
        conds << self.qid(idx) + ' = ' + self.quote(tab,idx,val)
      }
      where = conds.join(' and ')
    end
    query = "select #{fields} from #{tab} where #{where};"
printf("Select table:%s query:%s\n", tab, query)
    self.x query
  end

# -----------------------------------------------------------------------------
  def doInsert(tab, data)		#Insert a record contained in a hash
#printf("Insert tab:%s data:%s\n", tab, data)
    fields, values = [], []
    data.each_pair { |idx, val|
        fields << self.qid(idx)
        values << self.quote(tab,idx,val)
    }
    sql = "insert into #{tab} (#{fields.join(',')}) values (#{values.join(',')}) returning *;"
puts 'Test_me:' + sql
   self.x sql
  end

# -----------------------------------------------------------------------------
  def doUpdate(table, data, where)	#Update records as specified in a hash
printf("Update table:%s data:%s where:%s\n", table, data, where)
    setems = []
    data.each_pair { |idx, val|
        setems << self.qid(idx) + '=' + self.quote(table,idx,val)
    }
    raise 'Illegal where clause' if !where
    w = (where != '') ? 'where ' + where : ''
puts 'Test_me'
#    self.x "update #{table} set #{setems.join(',')} #{w};"
  end

# -----------------------------------------------------------------------------
  def doDelete(table, where)	#Delete records from a table
printf("Delete from table:%s where:%s\n", table, where)
    raise 'Illegal where clause' if !where
    w = (where != '') ? 'where ' + where : ''
puts 'Test_me'
#    self.x "delete from #{table} #{w};"
  end

end	#class DB
end	#module Wyseman

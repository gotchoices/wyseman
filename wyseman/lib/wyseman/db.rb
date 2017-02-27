# -----------------------------------------------------------------------------
# Open a connection to a database, to be managed by wyseman.
# If the specified database doesn't exist, create it.
# If the bootstrap schema doesn't exist, create that too.
#TODO:
#- Test if args passed in, like port, dbname
#- Test if args passed in as a hash
#- 
require 'pg'

class WysemanDB < PG::Connection
  def initialize (*args)
    begin
      @dbc = super(*args)
    rescue PG::ConnectionBad					#If can't connect
      (args[-1] = (oldh = args[-1]).dup)[:dbname] = 'template1'
      db = PG::Connection.new(*args)				#Connect to template db
      oldh[:dbname] = db.exec("select current_user;").getvalue(0,0) if !oldh[:dbname]	#Get my PG username if no username specified explicitly
      db.exec "create database " + q(oldh[:dbname])		#Create my database
      db.close
      args[-1] = oldh
      @dbc = super(*args)				#And try reconnecting
    end

    @dbc.set_notice_receiver { |res|
      puts res.error_message().split("\n")[0];		#Strip out any CONTEXT: lines
    }
      
    begin
      one("select count(*) from wm.objects;")		#If bootstrap schema doesn't exist
    rescue PG::UndefinedTable				#create it
      t(File.open(File.join(File.dirname(__FILE__), '..' , 'bootstrap.sql'),'r').read)
    end
  end
  def x(query)						#Short-hand for exec
      exec(query)
  end
  def t(query)						#Exec query as atomic transaction
      transaction { |c| c.exec(query)}
  end
  def e(str)						#Short-hand for escaping sql
      escape_string (str)
  end
  def q(str)						#Short-hand for quoting identifier
      quote_ident (str)
  end
  def one(query)					#Get a single row as an array
      exec(query).column_values(0)
  end
end

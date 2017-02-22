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
      db = PG::Connection.new(*args, dbname:'template1')
      uname = db.exec("select current_user;").getvalue(0,0)	#Get my PG username
      db.exec "create database " + q(uname)			#Create my database
      db.close
      @dbc = super(*args, dbname:uname)				#And try reconnecting
    end
      
    begin
      one("select count(*) from wm.objects;")		#If bootstrap schema doesn't exist
    rescue PG::UndefinedTable				#create it
      t(File.open(File.join(File.dirname(__FILE__), '..' , 'bootstrap.sql'),'r').read)
    end
  end
  def x(query)						#Short-hand for exec
      exec(query)
  end
  def t(query)						#Short-hand for exec
      exec(query)
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

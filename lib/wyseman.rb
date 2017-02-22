#Ruby interface to Schema Manager functions
#TODO:
#X- Warn if same object defined twice in same run
#- Make this work good enough for MyCHIPs for now
#- Implement classes to do database builds/updates from command line or from app
#- Implement run-time libs in ruby classes
#- Module versions vs/ object versions (see TODOs in bootstrap.sql)
#- Code/schema to commit schema versions
#- 
#- Try building wyselib schema as a module
#- Build cattle schema on top of it with separate module
#- 
#- More TODOs in wmparse.tcl (implement text, defaults)
#- 

require 'tcltklib'	#See: https://github.com/ruby/tk/blob/master/MANUAL_tcltklib.eng
require 'wyseman/db'

#Parse tcl schema descriptions and manipulate their objects in the database
# -----------------------------------------------------------------------------
class Wyseman
  @@callbacks = {}	#Hash of callbacks for each instance
  
  def self.callback(idx)
    idx ? @@callbacks[idx] : @@callbacks
  end
  
  def initialize()
    @tclip = TclTkIp.new(nil, false)
    @fname = ''
    @ss = self.to_s[2..-2]				#Make hash index, unique to this instance
#printf("Self:%s\n", @ss)
    @@callbacks[@ss] = Proc.new {|a,b,c,d,e,f,g,h| results(a,b,c,d,e,f,g,h)}	#Store a callback proc for this instance

    cbname = "Wyseman.callback(#{@ss.inspect}).call"	#Make handler calls in tcl for each kind of sql thing
    @tclip._eval("proc hand_object {name obj ver mod deps create drop} {eval [list set ::create $create]; eval [list set ::drop $drop]; eval [list ruby #{cbname}('[join [list sql $name $obj $ver $mod $deps ::create ::drop] {','}]')]}")
    @tclip._eval("proc hand_priv {name obj lev group give} {eval [list ruby #{cbname}('[join [list priv $name $obj $lev $group $give] {','}]')]}")

    %w(wylib wmparse).each { |f|			#Read tcl code files
      begin
        @tclip._eval(File.open(File.join(File.dirname(__FILE__), f + '.tcl'),'rb') {|io| io.read})
      rescue Exception => e
        raise "Error parsing file: " + f + ".tcl"
      end
    }
    @db = WysemanDB.new()				#Connect to the database
    
    if !@db.one("select object from wm.objects where object = 'table:wm.table_text'")[0]	#If run_time schema not loaded yet
      parse File.join(File.dirname(__FILE__), 'run_time.wms')
    end
  end

  def results (func, *args)
    begin
      case func
        when 'sql'
          name, obj, ver, mod, deps, create, drop = args
          create = @tclip._get_global_var(create)
          drop = @tclip._get_global_var(drop)
#printf("SQL name:%s obj:%s ver:%s mod:%s deps:%s\n  Create:%s\n  Drop:%s\n", name, obj, ver, mod, deps, create, drop)
#          sql = %Q{insert into wm.objects (obj_name, obj_type, version, deps, module, source, crt_sql, drp_sql) values ('#{@db.e(name)}', '#{obj}', #{ver}, '#{@db.e(deps)}', '#{@db.e(mod)}', '#{@db.e(@fname)}', '#{@db.e(create)}', '#{@db.e(drop)}') on conflict (object) do update set version = #{ver}, deps = '#{@db.e(deps)}', module = '#{@db.e(mod)}', source = '#{@db.e(@fname)}', crt_sql = '#{@db.e(create)}', drp_sql = '#{@db.e(drop)}';}
          if deps == ''
            deparr = '{}'
          else
            deparr = %Q{{"#{@db.e(deps.split(' ').join('","'))}"}}
          end
          sql = %Q{insert into wm.objects (obj_type, obj_name, deps, module, source, crt_sql, drp_sql) values ('#{obj}', '#{@db.e(name)}', '#{@db.e(deparr)}', '#{@db.e(mod)}', '#{@db.e(@fname)}', '#{@db.e(create)}', '#{@db.e(drop)}');}

        when 'priv'
          name, obj, lev, group, give = args
#printf("PRIV name:%s obj:%s lev:%s group:%s give:%s\n", name, obj, lev, group, give)
          object = obj + ':' + name
#          sql = %Q{insert into wm.grants (object, priv, level, allow) values ('#{@db.e(object)}', '#{@db.e(group)}', #{lev}, '#{@db.e(give)}');}
          sql = %Q{select wm.grant('#{@db.e(object)}', '#{@db.e(group)}', #{lev}, '#{@db.e(give)}');}

#        when 'dep'
#          name, obj, dep = args
#printf("DEP name:%s obj:%s dep:%s\n", name, obj, dep)
#          sql = %Q{delete from wm.depends where object = '#{@db.e(name)}';}
#          dep.split(' ').each {|d|
#            sql << %Q{\ninsert into wm.depends (object, depend) values ('#{@db.e(name)}', '#{d}');}
#          }
      end
    rescue Exception => e
      $stderr.puts "Error processing parse information from TCL: #{e.message}"
      raise
    end

#printf("Sql:%s\n", sql)
    begin
      @db.x(sql)
    rescue Exception => e
      $stderr.puts "Error inserting schema information: #{e.message} SQL: #{sql}\n"
      raise
    end
  end
  
  def parse (fname)
    @fname = fname
    @tclip._eval("wmparse::parse " + fname)
  end

end

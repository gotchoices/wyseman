#Wyseman session; wrapper around TCL core parser
#Copyright WyattERP.org; See license in root of this package
# -----------------------------------------------------------------------------
#TODO:
#X- Warn if same object defined twice in same run
#X- Make this work good enough for MyCHIPs for now
#- What if I define text for a nonexistent table or column?
#- An application can initialize its own database
#- Implement run-time libs in ruby classes (ruby/tk?)
#- Module versions vs/ object versions (see TODOs in bootstrap.sql)
#- Code/schema to commit schema versions
#- 
#- More TODOs in wmparse.tcl (implement text, defaults)
#- 

require 'tk'		#See: https://github.com/ruby/tk/blob/master/MANUAL_tcltklib.eng
require 'wyseman/db'

module Wyseman

#Parse tcl schema descriptions and manipulate their objects in the database
# -----------------------------------------------------------------------------
class Session
  @@callbacks = {}	#Hash of callbacks for each instance
  
  def self.callback(idx)
    idx ? @@callbacks[idx] : @@callbacks
  end
  
  def initialize(db)
    @db = db						#Remember our database connection
    @tclip = TclTkIp.new(nil, false)
    @fname = ''
    @ss = self.to_s[2..-2]				#Make hash index, unique to this instance
#printf("Self:%s\n", @ss)
    @@callbacks[@ss] = Proc.new {|a,b,c,d,e,f,g| results(a,b,c,d,e,f,g)}	#Store a callback proc for this instance

    cbname = "Wyseman::Session.callback(#{@ss.inspect}).call"	#Make handler calls in tcl for each kind of sql thing
    @tclip._eval("proc hand_object {name obj mod deps create drop} {eval [list set ::create $create]; eval [list set ::drop $drop]; eval [list ruby #{cbname}('[join [list object $name $obj $mod $deps ::create ::drop] {','}]')]}")
    @tclip._eval("proc hand_priv {name obj lev group give} {eval [list ruby #{cbname}('[join [list priv $name $obj $lev $group $give] {','}]')]}")
    @tclip._eval("proc hand_query {name query} {eval [list set ::query $query]; eval [list ruby #{cbname}('[join [list sql $name ::query] {','}]')]}")
    @tclip._eval("proc hand_cnat {name obj col nat ncol} {eval [list ruby #{cbname}('[join [list cnat $name $obj $col $nat $ncol] {','}]')]}")
    @tclip._eval("proc hand_pkey {name obj cols} {eval [list ruby #{cbname}('[join [list pkey $name $obj $cols] {','}]')]}")

    %w(wylib wmparse).each { |f|			#Read tcl code files
      begin
        @tclip._eval(File.open(File.join(File.dirname(__FILE__), f + '.tcl'),'rb') {|io| io.read})
      rescue Exception => e
        raise "Error parsing file: " + f + ".tcl"
      end
    }
    
    if !@db.one("select obj_nam from wm.objects where obj_typ = 'table' and obj_nam = 'wm.table_text'")	#If run_time schema not loaded yet
      parse File.join(File.dirname(__FILE__), 'run_time.wms')		#Parse it
      @db.t("select case when wm.check_drafts(true) then wm.check_deps() end;")	#Check versions/dependencies
      @db.t("select wm.make(null, false, true);")				#And build it
      parse File.join(File.dirname(__FILE__), 'run_time.wmt')		#Read text descriptions
      parse File.join(File.dirname(__FILE__), 'run_time.wmd')		#Read display switches
    end

    @db.x('delete from wm.objects where obj_ver <= 0;')	#Remove any failed working entries
  end

  def results (func, *args)
    begin
      case func
        when 'object'
          name, obj, mod, deps, create, drop = args
          create = @tclip._get_global_var(create)
          drop = @tclip._get_global_var(drop)
#printf("OBJ name:%s obj:%s mod:%s deps:%s file:%s\n  Create:%s\n  Drop:%s\n", name, obj, mod, deps, @fname, create, drop)
          if deps == ''
            deparr = '{}'
          else
            deparr = %Q{{"#{@db.esc(deps.split(' ').join('","'))}"}}
          end
          sql = %Q{insert into wm.objects (obj_typ, obj_nam, deps, module, source, crt_sql, drp_sql) values ('#{obj}', '#{@db.esc(name)}', '#{@db.esc(deparr)}', '#{@db.esc(mod)}', '#{@db.esc(@fname)}', '#{@db.esc(create)}', '#{@db.esc(drop)}');}

        when 'priv'
          name, obj, lev, group, give = args
#printf("PRIV name:%s obj:%s lev:%s group:%s give:%s\n", name, obj, lev, group, give)
          sql = %Q{select wm.grant('#{@db.esc(obj)}', '#{@db.esc(name)}', '#{@db.esc(group)}', #{lev}, '#{@db.esc(give)}');}

        when 'pkey'				#Should only be one of these, at col_dat[1]
          name, obj, cols  = args
#printf("PKEY name:%s obj:%s cols:%s\n", name, obj, col)
          sql = %Q{update wm.objects set col_data = array_prepend('pri,#{cols.split(' ').join(',')}',col_data) where obj_typ = '#{obj}' and obj_nam = '#{name}' and obj_ver = 0;}

        when 'cnat'
          name, obj, col, nat, ncol = args
#printf("CNAT name:%s obj:%s col:%s nat:%s ncol:%s\n", name, obj, col, nat, ncol)
          sql = %Q{update wm.objects set col_data = array_append(col_data,'nat,#{[col,nat,ncol].join(',')}') where obj_typ = '#{obj}' and obj_nam = '#{name}' and obj_ver = 0;}

        when 'sql'
          name, query = args
          sql = @tclip._get_global_var(query)
#printf("SQL name:%s \n  Sql:%s", name, sql)

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
  
  def parse (fname)				#Parse a wyseman file
    @fname = File.basename(fname)
    if File.extname(fname) == '.wmi'
      return `PATH=".:$PATH" #{fname}`		#Execute specified init file, capture sql
    end
    begin
      @tclip._eval("wmparse::parse " + fname)
    rescue Exception => e
      $stderr.puts e.message
      return nil
    end
    return ''
  end

  def check (prune = true)
    @db.t("select case when wm.check_drafts(#{prune}) then wm.check_deps() end;")	#Check versions/dependencies
  end

  def destroy ()
    @tclip._eval("wmparse::cleanup")
    @tclip.delete()
  end

end	#class Session
end	#module Wyseman

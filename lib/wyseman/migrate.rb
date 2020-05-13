#Wyseman migration command handler; Maintains Wyseman.migrate file
#Copyright WyattERP.org; See license in root of this package
# -----------------------------------------------------------------------------
#TODO:
#X- Locate and load Wyseman.migrate
#X- Apply command to file
#X-  drop column
#X-  rename column
#X-  pop last command
#X-  list commands
#X- Save Wyseman.migrate
#- 

module Wyseman
require 'json'
MigFileName = 'Wyseman.migrate'

#Create a migration handler class
# -----------------------------------------------------------------------------
class Migrate
  
  def initialize(cwd)
    @migFile = File.join(cwd, MigFileName)
    @changed = false
    @migData = nil
#printf("MigFile:%s\n", @migFile)
    if File.exists?(@migFile)			#Can we find an existing migration file in the source folder?
      begin
        fcont = File.open(@migFile, 'rb') {|io| io.read}
        @migData = JSON.parse(fcont) if fcont.length > 0	#Attempt to load it
      rescue Exception => e
        raise "Error loading file: " + @migFile
      end
    end
    @migData = {} if !@migData			#Else, start out with a blank structure
#printf("MigData:%s\n", @migData)
  end		#initialize

  def finish ()					#Write out the migration file if changes have been made
    begin
      serial = JSON.pretty_generate(@migData, {:indent=>'  '})
      File.open(@migFile, 'w') {|io| io.write(serial)}
    rescue Exception => e
      raise "Error writing file: " + @migFile
    end if @changed
  end		#finish
  
  def command (cmdline)				#Process a single migration command
    cmd = cmdline.shift()
#printf("Cmd:%s line:%s\n", cmd, cmdline)
    begin
      case cmd
        when 'drop'
          table, column = cmdline
#printf("Drop:%s col:%s\n", table, column)
          @migData[table] = [] if !@migData.key?(table)
          @migData[table] << 'drop ' + column
          @changed = true

        when 'rename'
          table, oldcol, newcol = cmdline
#printf("Rename:%s %s to %s\n", table, oldcol, newcol)
          @migData[table] = [] if !@migData.key?(table)
          @migData[table] << 'rename ' + oldcol + ' ' + newcol
          @changed = true

        when 'pop'
          table = cmdline.shift
#printf("Pop: %s\n", table)
          if @migData.key?(table)
            @migData[table].pop
            @migData.delete(table) if @migData.length <= 0
            @changed = true
          end

        when 'list'
          tables = cmdline
          tables = @migData.keys if !tables || tables.length <= 0
printf("List:%s keys:%s\n", tables, @migData.keys)
          tables.each { |tab|
            puts 'Table: ' + tab + ":\n  " + @migData[tab].join("\n  ") if @migData.key?(tab)
          }
      end
    rescue Exception => e
      $stderr.puts "Unknown migration command: #{e.message}"
      raise
    end
  end	#Command
  
end	#class Migrate
end	#module Wyseman

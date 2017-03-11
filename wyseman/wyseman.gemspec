Gem::Specification.new do |s|
  s.name        = 'wyseman'
  s.version     = '0.5'
  s.date        = '2017-02-08'
  s.summary     = "WyattERP Schema Manager"
  s.description = "An application for managing an SQL schema in PostgreSQL"
  s.authors     = ["Kyle Bateman"]
  s.email       = ["info@wyatterp.org"]
  s.platform    = Gem::Platform::RUBY
  s.files       = [
	"Copyright",
	"License",
	"README",
	"Release",
	"lib/wyseman.rb",
	"lib/bootstrap.sql",
	"lib/run_time.wmd",
	"lib/run_time.wms",
	"lib/run_time.wmt",
	"lib/wmparse.tcl",
	"lib/wylib.tcl",
	"lib/wyseman/db.rb",
	"bin/wyseman",
	"bin/wysegi.wish",
	"bin/wysegi",
	"bin/wmrelease.sh",
	"bin/wmrelease",
	"bin/wmversion.sh",
	"bin/wmversion",
	"bin/wmmkpkg.sh",
	"bin/wmmkpkg"
]
  s.executables << 'wyseman' << 'wysegi' << 'wmmkpkg' << 'wmrelease' << 'wmversion'
  s.homepage    = 'http://wyatterp.org/wyseman'
  s.requirements << 'Postgresql'
  s.requirements << 'Tcl/Tk, Tcl-PG installed if you want to run wysegi'
  s.license       = 'GPL-3.0'
end

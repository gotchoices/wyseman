#Parse wyseman schema description files
#---------------------------------------
#include(Copyright)
#TODO:
#X- Make generic so I can call from ruby
#X- Test calling wmparse::err
#X- Eliminated field proc.  Now can't build audit tables.  How to get table schema?
#X- Generalize grants to work for any site schema (levels 1..N)
#X- Put default admin grants in schema files
#X- Test/port standalone grant code
#X- Can build ruby gem
#X- Clean out unused, commented code
#X- How best to handle overloaded functions, objects with same name of different types
#X- Test replacing view/rules (old cnf(repl) replace switch)
#X- After PG8.2, sequences have a usage priv (rather than only select,update)
#X- Also many other privs in latest postgresql
#- 
#- Test tabtext (no handler yet)
#- Test tabdef, store defaults in database (no handler yet)
#- 
#- Re-create tcl parts in another file, make tcl version work again? (probably not)
#-  Command line version runs only through ruby gem
#-  Run-time libraries work in tcl and ruby
#-  Can still build tcl wyseman run-time library
#- Get wisegi working again to visualize schema files
#- 
#puts "proc hand_object {\n[info body hand_object]\n}"		;#Debug

namespace eval wmparse {
    variable v
    set v(fname)	{}
    set v(module)	{}
    set v(requires)	{}	;#list of required files already sourced
    set v(objs)		{table view sequence index function trigger rule schema other grant tabtext tabdef define field require module}
    set v(int) [interp create]
    foreach i $v(objs) {$v(int) alias $i wmparse::$i}
    $v(int) alias def def

    set v(swar) {{name 2} {dependency 2 dep} {create 2} {drop 2} {grant 2} {version 1 vers} {text 1}}
    set v(snar) {name dep create drop grant}
    
    variable ob			;#holds info about each object
    set ob(names)	{}
    variable md			;#macro definitions
}

# Record the module name for any defined objects
#------------------------------------------------------------
proc wmparse::module {m} {
    variable v
    set v(module) $m
}

# Read and interpret the specified file
#------------------------------------------------------------
proc wmparse::require {args} {
    variable v
    set path [file dirname [file normalize $v(fname)]]	;#Path of file we're in
    foreach f $args {
        set file [file join $path $f]			;#Make full pathname of file
        if {[lcontain $v(requires) $file]} {		;#If already loaded
            #Do nothing
        } elseif {[file exists $file]} {		;#If I can find it
#puts "source:$file"
            interp eval $v(int) source $file		;#Interpret it
            lappend v(requires) $file
        } else {
            error "Can't find required file: $file"
        }
    }
}

# Read and interpret the specified file
#------------------------------------------------------------
proc wmparse::parse {fname} {
    variable v
    set v(fname) $fname
    if {$v(module) == {}} {set v(module) [file rootname [file tail $fname]]}	;#default module name to file name, if none other specified
    if {[catch {interp eval $v(int) source $fname} errmsg]} {
        puts "Error ($fname): $::errorInfo"
        error "Aborting Script"
    }
}

# Store a macro definition
#------------------------------------------------------------
proc wmparse::define {name body} {
    variable md
    set md($name) [string trim $body]
}

# Scan a string for a macro definition
#------------------------------------------------------------
if {[info commands macscan] == {}} {
proc wmparse::macscan {name code} {
    if {[set idx [string first "${name}(" $code]] < 0} {return {}}	;#If macro name not found
#puts "macscan name:$name code:$code"
    set pre [string range $code 0 [expr $idx - 1]]			;#String before macro name
    incr idx [expr [string length $name] + 1]
#puts " pre:$pre idx:$idx @:[string index $code $idx]"
    set parmidx $idx							;#Beginning of parameters
    for {set lev 0} {1} {incr idx} {
        set c [string index $code $idx]
        if {$c == {)}} {
            if {$lev <= 0} {
                set parm [string range $code $parmidx [expr $idx - 1]]
                incr idx
                set post [string range $code $idx end]
                break
            } else {
                incr lev -1
            }
        } elseif {$c == {(}} {
            incr lev
        } elseif {$c == {}} {
            error "Unterminated macro: $name following: $pre"
        }
    }
    return [list $pre $parm $post]
}}

# Substitute any macros found in the given code string
#------------------------------------------------------------
proc wmparse::macsub {code} {
    variable v
    variable md
    foreach {mn mb} [array get md] {	;#for each macro we know about, get name and body
        set bpa [macscan $mn $code]	;#call C function to scan for macro
        if {$bpa == {}} continue		;#macro not found
#puts "mn:$mn mb:$mb"

        lassign $bpa before parms after
#puts "B:$before P:$parms A:$after"
        set p 1
        foreach parm [split $parms ,] {
            set parm [string trim $parm]	;#ignore whitespace near commas
            regsub -all "%$p" $mb $parm mb	;#sub values into macro body
#puts "    parm:$p:$parm mb:$mb"
            incr p
        }
        set code "$before[macsub $mb][macsub $after]"	;#recursively substitute macros inside and after parmlist
    }

    foreach cmd {eval expr subst} {
        set bpa [macscan $cmd $code]		;#find any escapes to supported tcl commands
        if {$bpa != {}} {
            lassign $bpa before parms after
            if {$cmd == {eval}} {set c {}} else {set c $cmd}
#puts "B:$before: P:$parms: A:$after:"
            if {[catch {
                set code "$before[macsub [interp eval $v(int) $c $parms]][macsub $after]"
            } err]} {
                error "Parsing $cmd macro: $parms\n  ($err)"
                return {}
            }
        }
    }
    return $code
}

# Do the parts common to any object
#------------------------------------------------------------
proc wmparse::object {obj args} {
    variable v
    variable ob

#    if {$v(abort)} {return -code return {}}
    argform $v(snar) args
    argnorm $v(swar) args
    foreach tag {name dep create drop grant vers} {set $tag [string trim [xswitchs $tag args]]}
    if {$vers == {}} {set vers 0}
    if {[llength $args] > 0} {error "Unrecognized parameters: $args"}
#    set drop [string trim $drop]
#    if {$create == {}} {error "Not enough parameters for $obj: $name"; return}
    if {$drop == {}} {
        set drop "drop $obj if exists $name;"
    } elseif {[string range $drop 0 0] == {+}} {
        set drop "drop $obj if exists $name; [string range $drop 1 end]"
    } elseif {[string range $drop 0 0] == {@}} {
        set drop "[string range $drop 1 end]; drop $obj if exists $name"
    }
    if {![regexp {.*;$} $drop] && ![regexp {wm\.vers\(} $drop]} {append drop {;}}

    regsub -all {([\n;,])[ \t]*--[^\n]*} $create {\1} create	;#strip sql comments

    if {![regexp {.*;$} $create]} {append create {;}}

    if {[lcontain $ob(names) $name]} {error "Object $name already defined"}
    lappend ob(names) $name

    set deps {}; foreach d [lsort -unique $dep] {	;#normalize dependencies
        lassign [split $d {:}] tt oo			;#is it a full object as: type:name
#puts "tt:$tt oo:$oo"
        if {$oo == {}} {
            lappend deps $tt
        } else {
            set tt [unabbrev {{table 2} {view 1} {sequence 2} {index 1} {function 1} {trigger 2} {rule 1} {schema 2} {other 1}} $tt]
            lappend deps "${tt}:$oo"
        }
    }

    hand_object $name $obj $vers $v(module) [join $deps { }] $create $drop

    set ob($name.create) $create			;#code to create object
    set ob($name.drop)   $drop				;#code to destroy object
    set ob($name.obj)    $obj				;#the object type (table, func, etc.)
    set ob($name.vers)   $vers				;#version of the object
    set ob($name.text)   {}				;#data from tabtext object
    set ob($name.defs)   {}				;#default display data from tabdef object
    set ob($name.grant)  {}				;#contains actual grant sql code
    set ob($name.file)   $v(fname)			;#the source file this object was found in
#puts " file:$v(fname)"

#Parse grants for the object, producing grant SQL:
    set grant [macsub $grant]				;#substitute any macros
    if {![lcontain {table view sequence function schema} $obj]} {
        if {$grant != {}} {error "Grants are valid for: tables, views, functions, schemas and sequences"}
    } else {
#puts "Obj:$obj name:$name grant:$grant"
        foreach grec $grant {				;#for each grant record
            set gives [lassign $grec group]
             if {$gives == {}} {			;#default grant if nothing specified
                 if {[lcontain {table view} $obj]} {
                     set gives {select}
                 } elseif {$obj == {function}} {
                     set gives {execute}
                 } elseif {$obj == {schema}} {
                     set gives {usage}
                 }
             }
             set lev 1; foreach give $gives {
                 foreach g $give {
                     set siud [unabbrev {{select 1} {insert 1} {update 1} {delete 1} {execute 1} {usage 2}} $g]
#puts " name:$name obj:$obj group:$group lev:$lev siud:$siud"
                     hand_priv $name $obj $lev $group $siud
                 }
                 incr lev
             }
        }
    }
    return $name
}

# Parse a table
#------------------------------------------------------------
proc wmparse::table {args} {
    variable v
    argform $v(snar) args
    argnorm $v(swar) args
    foreach tag {name dep create text} {set $tag [xswitchs $tag args]}
    set create [macsub [string trim $create]]
    if {![regexp -nocase {^create } $create]} {
        set create "create table $name (\n${create}\n)"
    }
    eval object table \$name \$dep \$create $args
    if {$text != {}} {tabtext $name {*}$text}
}

#------------------------------------------------------------
proc wmparse::view {args} {
    variable v
    variable ob
    
    argform $v(snar) args
    argnorm $v(swar) args
    argnorm {{native 3} {primarykeys 3 prim}} args
    foreach tag {name dep create drop text} {set $tag [xswitchs $tag args]}
    set create [macsub [string trim $create]]

    if {![regexp -nocase {^create } $create]} {set create "create view $name as $create"}

    if {[set nats [xswitchs native args]] != {}} {
        foreach nat $nats {			;#can specify multiple native records
#puts "Nat:$nat"
            lappend ob(cnats) [eval list $name [macsub $nat]]
        }
    }
    if {[set prims [xswitchs prim args]] != {}} {
#puts "Prims:$prims"
        lappend ob(prims) [list $name [macsub $prims]]
    }
    eval object view \$name \$dep \$create \$drop $args
    if {$text != {}} {tabtext $name {*}$text}
}

#------------------------------------------------------------
proc wmparse::sequence {args} {
    variable v
    argform $v(snar) args
    argnorm $v(swar) args
    foreach tag {name dep create} {set $tag [xswitchs $tag args]}
    set create [macsub [string trim $create]]
    if {![regexp -nocase {^create } $create]} {
        set create "create sequence $name $create"
    }
    eval object sequence \$name \$dep \$create $args
}

#------------------------------------------------------------
proc wmparse::index {args} {
    variable v
    argform $v(snar) args
    argnorm $v(swar) args
    foreach tag {name dep create drop} {set $tag [xswitchs $tag args]}
    set create [macsub [string trim $create]]
#    if {[llength $dep] != 1} {error "Must list a single dependency for indexes (the name of the indexed table)"}
    if {[llength $dep] > 1} {
        set tab [lindex $dep 0]		;#must list table first if multiple dependencies
    } else {
        set tab $dep
    }
    if {[regexp -nocase {^create } $create]} {		;#literal create script specified
        if {$name == {}} {error "Must specify index name"}
    } else {					;#we'll construct a name and a create script
        if {$name == {}} {
            if {[llength [split $tab .]] > 1} {set ns "[lindex [split $tab .] 0]."} else {set ns {}}
            set name "[string map {. _} $tab]_x_[join $create _]"		;#put index in correct schema
#puts "ns:$ns $name:$name tab:$tab"
            if {$drop == {}} {set drop "drop index if exists $ns$name;"}		;#we need to prefix with namespace for the drop
        }
        if {[string range $create 0 0] == {(}} {set cr $create} else {set cr [join $create ,]}	;#if it is a function, don't try to comma separate fields
        set create "create index $name on $tab ($cr)"
    }
    eval object index \$name \$dep \$create \$drop $args
}

#------------------------------------------------------------
proc wmparse::function {args} {
    variable v
    argform $v(snar) args
    argnorm $v(swar) args
    foreach tag {name dep create drop} {set $tag [xswitchs $tag args]}
    set create [macsub [string trim $create]]

    if {![regexp -nocase {^create } $create]} {set create "create function $name $create"}

    #Drop spaces, variable names from parameter list to get official function name
#puts "function name:$name"
    if {![regexp -nocase {([^(]*)\(([^)]*)\)} $name junk func parms]} {error "Can't parse function name: $name"}
#puts "         func:$func parms:$parms"
    set plist {}
    foreach parm [split $parms ,] {
        if {![regexp -nocase {^out$} [lindex $parm 0]]} {	;#ignore output variables
            lappend plist [string trim [lindex $parm end]]	;#and use the last token (which should be the type)
        }
    }
    set name "${func}([join $plist ,])"
#puts "         name:$name"
    
    eval object function \$name \$dep \$create \$drop $args
}

#------------------------------------------------------------
proc wmparse::trigger {args} {
    variable v
    argform $v(snar) args
    argnorm $v(swar) args
    foreach tag {name dep create drop} {set $tag [xswitchs $tag args]}
    set create [macsub [string trim $create]]
#puts "CREATE:$create"
    if {![regexp -nocase {[\n ]+on[\n ]+([^\n ]*)[\n ]+.*for[\n ]} $create junk tab]} {
        if {$dep == {}} {error "Failed to find trigger table dependency: $name"; return}
        set tab {}
    }
    if {![regexp -nocase {procedure ([^\n (]*)\(.*\)} $create junk fnc]} {
        if {$dep == {}} {error "Failed to find trigger function dependency: $name"; return}
        set fnc {}
    }
    if {$tab != {}} {lappend dep "$tab"}
    if {$fnc != {}} {lappend dep "${fnc}()"}
#puts "DEP:$dep"
    if {![regexp -nocase {^create } $create]} {
        set create "create trigger $name $create"
    }
    if {$drop == {}} {
        if {![regexp -nocase {[\n ]+on[\n ]+([^\n ]*)[\n ]+.*for[\n ]} $create junk tab]} {error "Failed to find trigger table dependency: $name"; return}
        set drop "drop trigger if exists $name on $tab"
    }
    eval object trigger \$name \$dep \$create \$drop $args
}

#------------------------------------------------------------
proc wmparse::rule {args} {
    variable v
    argform $v(snar) args
    argnorm $v(swar) args
    foreach tag {name dep create drop} {set $tag [xswitchs $tag args]}
    set create [macsub [string trim $create]]
#puts "CREATE:$create"
    if {![regexp -nocase {[\n ]+to[\n ]+([^\n ]*)[\n ]+.*[dw][oh][\n ]} $create junk tab]} {
        if {$dep == {}} {error "Failed to find rule table dependency: $name"; return}
        set tab {}
    }
    if {$tab != {}} {lappend dep "$tab"}
#puts "DEP:$dep"
    if {![regexp -nocase {^create } $create]} {
        set create "create rule $name as $create"
    }
    if {$drop == {}} {
        if {![regexp -nocase {[\n ]+to[\n ]+([^\n ]*)[\n ]+.*[dw][oh][\n ]} $create junk tab]} {error "Failed to find trigger table dependency: $name"; return}
        set drop "drop rule if exists $name on $tab"
    }
    eval object rule \$name \$dep \$create \$drop $args
}

#------------------------------------------------------------
proc wmparse::schema {args} {
    variable v
    argform $v(snar) args
    argnorm $v(swar) args
    foreach tag {name dep create} {set $tag [xswitchs $tag args]}
    set create [macsub [string trim $create]]
    if {![regexp -nocase {^create } $create]} {set create "create schema $name;"}
    eval object schema \$name \$dep \$create $args
}

#------------------------------------------------------------
proc wmparse::other {args} {
    variable v
    argform $v(snar) args
    argnorm $v(swar) args
    foreach tag {name dep create drop} {set $tag [xswitchs $tag args]}
    set create [macsub [string trim $create]]
    if {$create == {}} {error "You must specify an explicit create script for object: $name"}
    if {$drop == {}} {error "You must specify an explicit drop script for object: $name"}
    eval object other \$name \$dep \$create \$drop $args
}

# Specify permissions by module rather than with the database object definition
# Object can be specified by a list: {name type} such as {mydata table}
# Object and type can contain SQL wildcards (%, _)
#------------------------------------------------------------
proc wmparse::grant {group perms} {
    variable ob
#puts "grant group:$group perms:$perms"
    foreach grec $perms {
        set gives [lassign $grec name]			;#get object name
        if {[llength $name] > 1} {
            lassign $name name obj
        } else {
            set obj {%}
        }
        set lev 1; foreach give $gives {
             foreach g $give {
                 set siud [unabbrev {{select 1} {insert 1} {update 1} {delete 1} {execute 1} {usage 2}} $g]
#puts " name:$name obj:$obj group:$group lev:$lev suid:$siud"
                 hand_priv $name $obj $lev $group $siud
             }
             incr lev
        }
    }
}

# Handle a structure containing table text information
#------------------------------------------------------------
proc wmparse::tabtext {name args} {
    variable ob
    if {![lcontain $ob(names) $name]} {error "Can not define text information for non-existent table: $name"; return}
    set ob($name.text) [eval wmddict::tabtext $name $args]
#puts "name:$name text:$ob($name.text)"
}

# Handle a structure containing table default view information
# If args == {}, return the default view info for the given table
#------------------------------------------------------------
proc wmparse::tabdef {name args} {
    variable ob
#puts "tabdef name:$name args:$args"
    if {$args == {} && [info exists ob($name.defs)]} {return $ob($name.defs)}
    if {![lcontain $ob(names) $name]} {error "Can not define default view information for non-existent table: $name"; return}
    set ob($name.defs) $args
}

# Return the specified information field for this object
#------------------------------------------------------------
proc wmparse::field {name {field dep}} {
    variable ob
    if {![lcontain $ob(names) $name]} {err "object: $name not found looking for field: $field"; return}
    if {![info exists ob($name.$field)]} {err "field $field not found for object: $name"; return}
    return $ob($name.$field)
}

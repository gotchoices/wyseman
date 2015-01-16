#Parse and interpret wyseman schema files
#---------------------------------------
#include(Copyright)
#TODO:
#- after PG8.2, sequences should get usage priv (rather than select,update)
#- better way than to reference global cnf(repl)?
#- 

package require wylib
package provide wyseman 0.40

namespace eval wmparse {
    namespace export family level parse field expand dropdep
    variable v
    set v(fname)	{}
    set v(abort)	0
    set v(objs)		{table view sequence index function trigger rule schema other grant tabtext tabdef define field err}
    set v(int) [interp create]
    foreach i $v(objs) {$v(int) alias $i wmparse::$i}

    set v(swar) {{name 2} {dependency 2 dep} {create 2} {drop 2} {grant 2} {version 1 vers} {text 1}}
    set v(snar) {name dep create drop grant}
    
    variable ob
    set ob(names)	{}
    set ob(groups)	{}
    set ob(cnats)	{}		;#forced column native-table definitions
    set ob(prims)	{}		;#forced primary key definitions
    set ob(privs)	{{admin select update {insert delete}}}		;#admin can access every table/view
    variable md		;#macro definitions
}

# Return a list of forced column native-tables
#------------------------------------------------------------
proc wmparse::natives {} {return $wmparse::ob(cnats)}

# Return a list of forced column primary key definitions
#------------------------------------------------------------
proc wmparse::primaries {} {return $wmparse::ob(prims)}

# Return a list of the groups (and their 3 individual levels) we found while parsing
#------------------------------------------------------------
proc wmparse::groups {} {
    variable ob
    set glist {}
    foreach gr $ob(groups) {lappend glist ${gr}_limit ${gr}_user ${gr}_super}
    return $glist
}

# Report an error while parsing the file
#------------------------------------------------------------
proc wmparse::err {s} {
    variable v
    puts "Error ($v(fname)): $s"
    set v(abort) 1
}

# Read and interpret the specified files
#------------------------------------------------------------
proc wmparse::parse {args} {
    variable v
    variable ob
    foreach fname $args {
#puts "Parsing file:$fname"
        set v(fname) $fname
        set v(abort) 0
        interp eval $v(int) source $fname
#puts "Done with file:$v(fname)"
        set v(fname) {post-parse}
    }
    foreach name $ob(names) {					;# Process all grants for all objects
        set grsql {}
        set gobj [set obj $ob($name.obj)]
#puts "$obj $name"
        if {[lcontain {view table} $gobj]} {set gobj {table}}	;#force use of table for views

        foreach group [lsort -unique $ob($name.groups)] {	;#for each group given privs on this object
#puts " group:$group"

            set privs {}					;#expanded, unique, cumulative list of privileges
            foreach lev {limit user super} {
                set give $ob($name.gives.$group.$lev)		;#possibly abbreviated, redundant privileges
                if {$give == {}} {				;#default grant if nothing specified
                    if {[lcontain {table view} $obj]} {
                        set give {select}
                    } elseif {$obj == {function}} {
                        set give {execute}
                    } elseif {$obj == {schema}} {
                        set give {usage}
                    }
                }
                foreach g [lsort $give] {
                    set pr [unabbrev {{select 1} {insert 1} {update 1} {delete 1} {execute 1} {usage 2}} $g]
                    if {![lcontain $privs $pr]} {lappend privs $pr}
                }
#puts "  ${lev}: privs:$privs"
                if {$group == {public}} {		;#special case for public privs
                    lappend grsql "revoke all on $gobj $name from public"
                    if {$privs != {}} {lappend grsql "grant [join $privs ,] on $gobj $name to public"}
                    break
                } elseif {$obj == {function}} {		;#special case for function privs
#puts "obj:$obj name:$name privs:$privs"
                    if {$grsql == {}} {lappend grsql "revoke all on $gobj $name from public"}
                    if {$privs != {}} {
                        if {$privs != {execute}} {err "Only allowable priv for function $name is execute"}
                        lappend grsql "revoke all on $gobj $name from \"${group}_${lev}\""
                        lappend grsql "grant [join $privs ,] on $gobj $name to group \"${group}_${lev}\""
                    }
                } else {
                    lappend grsql "revoke all on $gobj $name from \"${group}_${lev}\""
                    if {$privs != {}} {lappend grsql "grant [join $privs ,] on $gobj $name to group \"${group}_${lev}\""}
                }
            }
        }
        if {[llength $grsql] > 0} {
            set ob($name.grant) "[join $grsql ";\n"];"		;#save grant code in its own structure
        }
    }
}

# Determine if descen is a descendant of ancest
#------------------------------------------------------------
proc wmparse::ancest {ancest descen} {
    variable ob
    if {![lcontain $ob(names) $descen]} {err "Can't find a an object: $descen looking for descendents of $ancest"; return 0}
#puts "A:$ancest D:$descen"
    if {$ob($descen.dep) == {}} {return 0}		;#no parents
#puts "D:$ob($descen.dep)"
    if {[lcontain $ob($descen.dep) $ancest]} {return 1}	;#immediate parent
    foreach dep $ob($descen.dep) {
        if {[ancest $ancest $dep]} {return 1}
    }
    return 0
}

# Expand the object names in lvname if they contain wildcards (*,?)
#------------------------------------------------------------
proc wmparse::expand {inlist} {
    variable ob
    
    set newlist {}
    foreach spec $inlist {
#puts "spec:$spec"
        if {[regexp {[*?]} $spec]} {
            foreach nm $ob(names) {		;#check all names
                if {[string match $spec $nm]} {	;#include all that match
                    lappend newlist $nm
                }
            }
            if {[llength $newlist] <= 0} {
                err "glob expression: $spec doesn't expand to anything"
                lappend newlist _nothing_
            }
        } else {
            lappend newlist $spec
        }
    }
    return $newlist
}

# Compute the (deepest) dependency level of a database object
#------------------------------------------------------------
proc wmparse::level {name} {
    variable ob
    if {$ob($name.dep) == {}} {return 0}
    set max 0
    foreach dep $ob($name.dep) {
        if {![lcontain $ob(names) $dep]} {err "object: $dep not found looking for dependencies in: $name"; continue}
        set lev [level $dep]
        if {$lev > $max} {set max $lev}
    }
    return [expr $max + 1]
}

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
#        set parms [macsub $parms]		;#mac substitute before and after parameter substitution?
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
#puts "B:$before P:$parms A:$after"
            if {[catch {
                set code "$before[macsub [interp eval $v(int) $c $parms]][macsub $after]"
            } err]} {
                err "Parsing $cmd macro: $parms\n  ($err)"
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

    if {$v(abort)} {return -code return {}}
    argform $v(snar) args
    argnorm $v(swar) args
    foreach tag {name dep create drop grant vers} {set $tag [string trim [xswitchs $tag args]]}
    if {$vers == {}} {set vers 0}
    if {[llength $args] > 0} {err "Unrecognized parameters: $args"}
#    set drop [string trim $drop]
#    if {$create == {}} {err "Not enough parameters for $obj: $name"; return}
    if {$drop == {}} {
        set drop "drop $obj if exists $name;"
    } elseif {[string range $drop 0 0] == {+}} {
        set drop "drop $obj if exists $name; [string range $drop 1 end]"
    } elseif {[string range $drop 0 0] == {@}} {
        set drop "[string range $drop 1 end]; drop $obj if exists $name"
    }
    if {![regexp {.*;$} $drop] && ![regexp {wm\.vers\(} $drop]} {append drop {;}}
    append drop " select wm.vers('$name');"

    regsub -all {([\n;,])[ \t]*--[^\n]*} $create {\1} create	;#strip sql comments

    if {$obj == {view} && $::cnf(repl)} {
        regsub -all {create rule} $create {create or replace rule} create
    }

    if {![regexp {.*;$} $create]} {append create {;}}
    if {$create != {;} && $vers >= 0} {append create " select wm.vers('$name','$obj',$vers,'$dep','[sql::escape $drop]');"}

    if {[lcontain $ob(names) $name]} {err "Object $name already defined"}
    lappend ob(names) $name
    set ob($name.create) $create			;#code to create object
    set ob($name.drop)   $drop				;#code to destroy object
    set ob($name.obj)    $obj				;#the object type (table, func, etc.)
    set ob($name.vers)   $vers				;#version of the object
    set ob($name.text)   {}				;#data from tabtext object
    set ob($name.defs)   {}				;#default display data from tabdef object
    set ob($name.grant)  {}				;#contains actual grant sql code
    set ob($name.file)   $v(fname)			;#the source file this object was found in
    if { ![info exists ob($name.groups)]} {set ob($name.groups)  {}}				;#list of groups which get permissions on this object
#puts " file:$v(fname)"

#Parse grants for the object, producing grant SQL:
    set grant [macsub $grant]				;#substitute any macros
    if {![lcontain {table view sequence function schema} $obj]} {
        if {$grant != {}} {err "Grants are valid for: tables, views, functions, schemas and sequences"}
    } else {
#puts "$obj $name"
        if {[lcontain {view table} $obj]} {		;#include default admin privs
            set grant [concat $ob(privs) $grant]
        }
        foreach grec $grant {				;#for each grant record
            set gives [lassign $grec group]
            if {![lcontain $ob(groups) $group]} {lappend ob(groups) $group}	;#make sure we know about this group
            lappend ob($name.groups) $group					;#remember what groups have been given privs on this object
            foreach lev {limit user super} {
                set gives [lassign $gives give]		;#grab next item
                lappend ob($name.gives.$group.$lev) {*}$give	;#remember what this object will get (and add to any other gives already recorded for it)
#puts " group:$group lev:$lev give:$ob($name.gives.$group.$lev)"
            }
        }
    }
#if {$name == {empl_v}} {
#    puts "CREATE:$ob($name.create)"
#    puts "DROP:$ob($name.drop)"
#}

    set ob($name.dep)    [lrmdups $dep]		;#objects this object is dependent upon
    foreach o $ob($name.dep) {
        lappend ob($o.ped) $name		;#objects that depend on this object
    }
    if {![info exists ob($name.ped)]} {set ob($name.ped)   {}}
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

    if {$::cnf(repl)} {
        set carp { or replace}
        set drop { -- drop disabled;}
#        regsub -all {create rule} $create {create or replace rule} create	;#This doesn't work here because rules may not be expanded from macros until later in ::object
    } else {
        set carp {}
    }
    if {![regexp -nocase {^create } $create]} {set create "create${carp} view $name as $create"}

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
#    if {[llength $dep] != 1} {err "Must list a single dependency for indexes (the name of the indexed table)"}
    if {[llength $dep] > 1} {
        set tab [lindex $dep 0]		;#must list table first if multiple dependencies
    } else {
        set tab $dep
    }
    if {[regexp -nocase {^create } $create]} {		;#literal create script specified
        if {$name == {}} {err "Must specify index name"}
    } else {					;#we'll construct a name and a create script
        if {$name == {}} {
            if {[llength [split $tab .]] > 1} {set ns "[lindex [split $tab .] 0]."} else {set ns {}}
            set name "[translit . _ $tab]_x_[join $create _]"		;#put index in correct schema
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

#puts "create:$create"
# Don't need to list standard languages as dependencies anymore
#    if {[regexp -nocase {[\t\n ]+language[\t\n ]+([^\t\n ;]*)} $create junk lang]} {
#        set lang [string trim $lang ']
#        if {![lcontain {sql SQL c C} $lang]} {lappend dep [string trim $lang ']}
#    } else {
#        err "Failed to find language dependency for: $name"
#    }

    if {$::cnf(repl)} {set carp { or replace}; set drop { -- drop disabled;}} else {set carp {}}
    if {![regexp -nocase {^create } $create]} {set create "create${carp} function $name $create"}

    #Drop spaces, variable names from parameter list to get official function name
#puts "function name:$name"
    if {![regexp -nocase {([^(]*)\(([^)]*)\)} $name junk func parms]} {err "Can't parse function name: $name"}
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
        if {$dep == {}} {err "Failed to find trigger table dependency: $name"; return}
        set tab {}
    }
    if {![regexp -nocase {procedure ([^\n (]*)\(.*\)} $create junk fnc]} {
        if {$dep == {}} {err "Failed to find trigger function dependency: $name"; return}
        set fnc {}
    }
    if {$tab != {}} {lappend dep "$tab"}
    if {$fnc != {}} {lappend dep "${fnc}()"}
#puts "DEP:$dep"
    if {![regexp -nocase {^create } $create]} {
        set create "create trigger $name $create"
    }
    if {$drop == {}} {
        if {![regexp -nocase {[\n ]+on[\n ]+([^\n ]*)[\n ]+.*for[\n ]} $create junk tab]} {err "Failed to find trigger table dependency: $name"; return}
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
        if {$dep == {}} {err "Failed to find rule table dependency: $name"; return}
        set tab {}
    }
    if {$tab != {}} {lappend dep "$tab"}
#puts "DEP:$dep"
    if {![regexp -nocase {^create } $create]} {
        set create "create rule $name as $create"
    }
    if {$drop == {}} {
        if {![regexp -nocase {[\n ]+to[\n ]+([^\n ]*)[\n ]+.*[dw][oh][\n ]} $create junk tab]} {err "Failed to find trigger table dependency: $name"; return}
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
    if {![regexp -nocase {create } $create]} {err "You must specify an explicit create script for object: $name"}
    if {$drop == {}} {err "You must specify an explicit drop script for object: $name"}
    eval object other \$name \$dep \$create \$drop $args
}

# Specify permissions by module rather than with the database object definition
#------------------------------------------------------------
proc wmparse::grant {group perms} {
    variable ob
#puts "grant group:$group perms:$perms"
    foreach grec $perms {
        set gives [lassign $grec name]			;#get object name
        lappend ob($name.groups) $group			;#remember what groups have been given privs on this object
        foreach lev {limit user super} {
            set gives [lassign $gives give]		;#grab next item
            lappend ob($name.gives.$group.$lev) {*}$give	;#remember what this object will get (and add to any other gives already recorded for it)
#puts " group:$group name:$name lev:$lev give:$ob($name.gives.$group.$lev)"
        }
    }
}

# Handle a structure containing table text information
#------------------------------------------------------------
proc wmparse::tabtext {name args} {
    variable ob
    if {![lcontain $ob(names) $name]} {err "Can not define text information for non-existent table: $name"; return}
    set ob($name.text) [eval wmddict::tabtext $name $args]
#puts "name:$name text:$ob($name.text)"
}

# Store a macro definition
#------------------------------------------------------------
proc wmparse::define {name body} {
    variable md
    set md($name) [string trim $body]
}

# Handle a structure containing table default view information
# If args == {}, return the default view info for the given table
#------------------------------------------------------------
proc wmparse::tabdef {name args} {
    variable ob
#puts "tabdef name:$name args:$args"
    if {$args == {} && [info exists ob($name.defs)]} {return $ob($name.defs)}
    if {![lcontain $ob(names) $name]} {err "Can not define default view information for non-existent table: $name"; return}
    set ob($name.defs) $args
}

# Return a list of objects with their levels in the hierarchy
#------------------------------------------------------------
proc wmparse::family {{branch {}} {sql {}}} {
    variable ob
    set ol {}
    foreach name [lsort $ob(names)] {	;#in alphabetical order
        if {$branch != {} && ![ancest $branch $name] && $branch != $name} {continue}
        set rec [list [level $name] $ob($name.obj) $name]	;#first part of record: level, object_type, object_name
        if {[lcontain {create drop text defs grant} $sql]} {
            lappend rec $ob($name.$sql)				;#also append sql to drop, create etc
        }
        lappend ol $rec
    }
#puts ":::::sql:$sql ol:$ol"
    return [lsort -index 1 $ol]		;#return in order of type
}

# Return the specified field for this object
#------------------------------------------------------------
proc wmparse::field {name {field dep}} {
    variable ob
    if {![lcontain $ob(names) $name]} {err "object: $name not found looking for field: $field"; return}
    if {![info exists ob($name.$field)]} {err "field $field not found for object: $name"; return}
    return $ob($name.$field)
}

# Drop an object from another object's dependency list
#------------------------------------------------------------
proc wmparse::dropdep {name dropit} {
    variable ob
    set ob($name.dep) [lremove $ob($name.dep) $dropit]
}

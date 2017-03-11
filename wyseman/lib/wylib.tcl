# Misc functions that don't really have a good home and are not in a namespace
#------------------------------------------
#Copyright WyattERP: GNU GPL Ver 3; see: License in root of this package

# Find shortcut arguments (missing their switch) and add it in
#------------------------------------------
proc argform {switches av} {
    upvar $av args
    set slen [llength $switches]
    set alen [llength $args]
    for {set s 0; set a 0} {$s < $slen && $a < $alen} {incr a 2} {
        if {[string range [lindex $args $a] 0 0] != {-}} {
            set args [linsert $args $a -[lindex $switches $s]]
            incr alen
            incr s
        }
    }
}

# Correct an abbreviated value
#------------------------------------------
proc unabbrev {switches arg} {
    set arln [string length $arg]
#puts "arg:$arg arln:$arln"
    foreach rec $switches {
        lassign $rec full len std
        if {$std == {}} {set std $full}
#puts "$arg == $std"
        if {$arg == $std} break
#puts "$arln >= $len && $arg == [string range $full 0 [expr $arln - 1]]"
        if {$arln >= $len && $arg == [string range $full 0 [expr $arln - 1]]} {
            return $std
        }
    }
    return $arg
}

# Find abbreviated (or longer) switches and substitute their standard form
#------------------------------------------
proc argnorm {switches av} {
    upvar $av args
    set anum [llength $args]
    for {set a 0} {$a < $anum} {incr a 2} {
        if {[string range [set arg [lindex $args $a]] 0 0] != {-}} continue
        set arg [string range $arg 1 end]
        if {[set farg [unabbrev $switches $arg]] != $arg} {
            set args [lreplace $args $a $a -$farg]
        }
    }
}

# Extract a switch and its value from an argument list
#------------------------------------------
proc xswitch {sw av {vv {}} {sv {}} {rm 1}} {
    upvar $av alist
    if {$vv != {}} {upvar $vv val}
    if {[set si [lsearch -regexp $alist "^-($sw)$"]] < 0} {return {}}
#    if {[set si [lsearch -regexp $alist "^-([swexp $sw])\$"]] < 0} {return {}}
    if {$sv != {}} {upvar $sv asw; set asw [lindex $alist $si]}
    set vi [expr $si + 1]
    set val [lindex $alist $vi]
    if {$rm} {set alist [lreplace $alist $si $vi]}
    return $val
}

# Call above repeatedly until all matching switches have been extracted
#------------------------------------------
proc xswitchs {sw av {vv {}}} {
    upvar $av alist
    set retval {}

#Fails if non-last switch value is {}:
#    while {[set x [uplevel xswitch $sw $av $vv]] != {}} {
#        set retval $x
#    }

#This keeps going as long as target switches remain in command line:
    while {[lcontain $alist "-$sw"]} {
        set retval [uplevel xswitch $sw $av $vv]
    }
    return $retval
}

#Does a list contain a specified element
#------------------------------------------
proc lcontain {list element} {
    if {[lsearch -exact $list $element] >= 0} {return true} else {return false}
}


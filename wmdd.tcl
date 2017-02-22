#Routines for applications to access the wyseman data dictionary
#---------------------------------------
#Copyright WyattERP: GNU GPL Ver 3; see: License in root of this package

#TODO:
#X- Access a user variable which controls language
#X- cache values from database?
#X- have ::nonull call whole table at once like ::type
#- consolidate ::columns and ::column functions?
#- 
package require wylib
package provide wyseman 0.50

namespace eval wmdd {
    namespace export errtext table type column columns value pkey tables_ref table_parts columns_fk
    variable v
    set v(lang) {en}
}

# Return name of an oid column (typically _oid) for a view
#------------------------------------------------------------
proc wmdd::view_oid {table} {
    variable v
    set idx "view_oid:$table"
    lassign [wmdd::table_parts $table] sch tab
    if {![info exists v($idx)]} {
        lassign [sql::one "select cdt_col from wm.column_data where cdt_sch = '$sch' and cdt_tab = '$tab' and type = 'oid' order by field desc limit 1"] v($idx)
    }
    return $v($idx)
}

# Split a table object into {schema table}, include public if no schema given
#------------------------------------------------------------
proc wmdd::table_parts {table {join {}}} {
    lassign [split $table .] sch tab
    if {$tab == {}} {set ret [list public $sch]} else {set ret [list $sch $tab]}
    if {$join != {}} {return [join $ret $join]} else {return $ret}
}

# Return the text for a specified message
#------------------------------------------------------------
proc wmdd::errtext {table code} {
    variable v
    set idx "error:$table:$code"
    lassign [wmdd::table_parts $table] sch tab
    if {![info exists v($idx)]} {
        set v($idx) [sql::one "select title,help from wm.error_text where et_sch = '$sch' and et_tab = '$tab' and code = '$code' and language = '$v(lang)'"]
    }
    return $v($idx)
}

# Return table text
#------------------------------------------------------------
proc wmdd::table {table} {
    variable v
    set idx "table:$table"
    lassign [wmdd::table_parts $table] sch tab
    if {![info exists v($idx)]} {
        set v($idx) [sql::one "select title,help,tab_kind from wm.table_pub where sch = '$sch' and tab = '$tab' and language = '$v(lang)'"]
    }
    return $v($idx)
}

# Return tcl boolean indicating if this field can not be null
#------------------------------------------------------------
proc wmdd::nonull {table column} {
    variable v
    set idx "nonull:$table:$column"
    lassign [wmdd::table_parts $table] sch tab
    if {![info exists v($idx)]} {
        set v($idx) [sql::one "select case when nonull then 1 else 0 end from wm.column_data where cdt_sch = '$sch' and cdt_tab = '$tab' and cdt_col = '$column'"]
    }
    return $v($idx)
}

# Return column text
#------------------------------------------------------------
proc wmdd::column {table column} {
    variable v
    set idx "column:$table:$column"
#puts "column table:$table column:$column idx:$idx"
    lassign [wmdd::table_parts $table] sch tab
    if {![info exists v($idx)]} {	# Grab the whole table at once--not just this column
        foreach rec [sql::qlist "select col,title,help,type from wm.column_pub where sch = '$sch' and tab = '$tab' and language = '$v(lang)'"] {
            set rec [lassign $rec col]
            set ix "column:$table:$col"
            set v($ix) $rec
        }
        if {![info exists v($idx)]} {error "Can't find data for table:$table, column:$column"; return {}}
    }
    return $v($idx)
}

# Return column type
#------------------------------------------------------------
proc wmdd::type {table column} {
    if {$column == {oid}} {return {oid}}
#    return [lindex [column $table $column] 2]
    set typ [lindex [column $table $column] 2]
    if {[lcontain {int2 int4 int8} $typ]} {
        set type {int}
    } elseif {[lcontain {float4 float8} $typ]} {
        set type {float}
    } else {
        set type $typ
    }
    return $type
}

# Return all column text for a table
#------------------------------------------------------------
proc wmdd::columns {table} {
    variable v
    set idx "columns:$table"
    lassign [wmdd::table_parts $table] sch tab
#debug wmdd_columns: table idx sch tab
    if {![info exists v($idx)]} {
        set v($idx) [sql::qlist "select col,title,help,type from wm.column_pub where sch = '$sch' and tab = '$tab' and language = '$v(lang)' order by 2"]
    }
    if {$v($idx) == {}} {error "No columns found for $table.  Is the wm.column_native populated?"}
#puts " columns:$v($idx)"
    return $v($idx)
}

# Return allowable values for a column if they exist
#------------------------------------------------------------
proc wmdd::value {table column {val {}}} {
    variable v
    set idx "value:$table:$column"
#puts "wmdd::value table:$table column:$column"
    lassign [wmdd::table_parts $table] sch tab

    if {![info exists v($idx)]} {
	foreach rec [columns $table] {			;#Grab the whole table at once
	    set col [lindex $rec 0]
#puts "  set v(value:$table:$col) {}"
	    set v(value:$table:$col) {}
	}
        foreach rec [sql::qlist "select v.vt_col,v.value,v.title,v.help from wm.value_text v join wm.column_pub c on c.nat_sch = v.vt_sch and c.nat_tab = v.vt_tab and c.nat_col = v.vt_col where c.sch = '$sch' and c.tab = '$tab' and v.language = '$v(lang)';"] {
            lassign $rec col value title help
            lappend v(value:$table:$col) [list $value $title $help]
            set v(value:$table:$col:$value) [list $value $title $help]
        }
    }
#puts "table:$table column:$column values:$v($idx)"
    if {$val != {}} {set idx "$idx:$val"}
    if {![info exists v($idx)]} {error "No values found for $table:$column value:$val.  Is the wm.column_native populated?"}
    if {$val == {}} {return $v($idx)} else {return [lrange $v($idx) 1 end]}
}

# Return the primary key field names for a table
#------------------------------------------------------------
proc wmdd::pkey {table} {
    variable v
    set idx "pkey:$table"
#puts "wmdd::pkey table:$table"
    lassign [wmdd::table_parts $table] sch tab
    if {![info exists v($idx)]} {
        set key {}
        foreach tag [sql::qlist "select col from wm.column_pub where sch = '$sch' and tab = '$tab' and pkey order by field"] {
            lappend key $tag
        }
        set v($idx) $key
    }
#puts "  table:$table pkey:$v($idx)"
    return $v($idx)
}

# Return tables that are referenced (pointed to) by the specified table
# If refme true, return tables that reference the specified table
#------------------------------------------------------------
proc wmdd::tables_ref {table {refme 0}} {
    variable v
    if {$refme} {
        lassign {tt_tab ft_tab} tcol wcol
    } else {
        lassign {ft_tab tt_tab} tcol wcol
    }
#puts "FIXME: table:$table tcol:$tcol wcol:$wcol"
    set ret {}
    set tags {}
    lassign [wmdd::table_parts $table] sch tab

#Slower this way:
#    set query "select 
#        k.tt_tab,k.ft_tab,k.key,k.keys,k.tt_col,k.ft_col,tt.title,tt.help,ct.title,ct.help,k.conname,k.unikey
#      from        wm.fkey_pub	k
#        left join wm.table_text	tt on tt.tt_sch = k.sch and tt.tt_tab = k.$tcol and tt.language = '$v(lang)' 
#        left join wm.column_pub	ct on ct.sch = k.sch and ct.tab = k.tt_tab and ct.tt_col = k.nt_col and ct.language = '$v(lang)'
#      where k.$wcol = '$table' and has_table_privilege('$table','select') order by k.tt_sch, k.tt_tab, k.ft_tab, k.key;"

#A lot faster with subqueries:
    set query "select 
        k.tt_tab,k.ft_tab,k.key,k.keys,k.tt_col,k.ft_col,tt.title,tt.help,
        (select title from wm.column_pub where sch = k.tt_sch and tab = k.tt_tab and col = k.tn_col and language = '$v(lang)') as title,
        (select help  from wm.column_pub where sch = k.tt_sch and tab = k.tt_tab and col = k.tn_col and language = '$v(lang)') as help,
        k.conname,k.unikey
      from        wm.fkey_pub	k
        left join wm.table_text	tt on tt.tt_sch = k.tt_sch and tt.tt_tab = k.${tcol} and tt.language = '$v(lang)' 
      where k.$wcol = '$table' and has_table_privilege('$table','select') order by k.tt_tab, k.ft_tab, k.key;"

#debug query
    foreach rec [sql::qlist $query] {
        lassign $rec tab_name ftab_name key keys colname fcolname ttitle thelp ftitle fhelp conname unikey
#puts [format {tab_name:%-20s ftab_name:%-20s key:%2d keys:%2d colname:%-12s fcolname:%-12s ftitle:%-14.14s ttitle:%s} $tab_name $ftab_name $key $keys $colname $fcolname $ftitle $ttitle]
        set tag "$tab_name.$ftab_name.$conname.$unikey"
        if {![lcontain $tags $tag]} {lappend tags $tag}		;#store all unique key sets
        lappend cols($tag)	$colname
        lappend fcols($tag)	$fcolname
        lappend ftitles($tag)	$ftitle
        lappend fhelps($tag)	$fhelp
        set tt($tag)		$ttitle
        set th($tag)		$thelp
#puts " tag:$tag cols:$cols($tag) fcols:$fcols($tag)"
#puts "   ftitles:$ftitles($tag) fhelps:$fhelps($tag)"
    }
    foreach tag $tags {
        lassign [split $tag .] tab_name ftab_name conname unikey
        if {[llength $cols($tag)] > 1} {
            lappend ret [list $tab_name $cols($tag) $ftab_name $fcols($tag) $tt($tag) $th($tag) [join $ftitles($tag) {; }] [join $fhelps($tag) {; }]]
        } else {
            lappend ret [list $tab_name [lindex $cols($tag) 0] $ftab_name [lindex $fcols($tag) 0] $tt($tag) $th($tag) [lindex $ftitles($tag) 0] [lindex $fhelps($tag) 0]]
        }
    }
#puts "tables_ref $table $refme ret:$ret"
    return $ret
}

# Return the fk columns in a table and the pk columns they point to in a foreign table
#------------------------------------------------------------
proc wmdd::columns_fk {table ftable} {
    variable v
    set idx "columns_fk:$table:$ftable"
    if {![info exists v($idx)]} {
#puts "table:$table ftable:$ftable"
        set v($idx) {}
        lassign [wmdd::table_parts $table] sch tab
        lassign [wmdd::table_parts $ftable] fsch ftab
        foreach rec [sql::qlist "select tt_cols,ft_cols from wm.fkeys_pub where tt_sch = '$sch' and tt_tab = '$tab' and ft_sch = '$fsch' and ft_tab = '$ftab'"] {
            lassign $rec tt_cols ft_cols
#puts "Fwd: tt_cols:$tt_cols ft_cols:$ft_cols"
            lappend v($idx) [list [eval split $tt_cols ,] [eval split $ft_cols ,]]		;#eval gets rid of {}'s
        }
        if {[llength $v($idx)] > 0} {return $v($idx)}	;#if we found something
        foreach rec [sql::qlist "select tt_cols,ft_cols from wm.fkeys_pub where tt_sch = '$fsch' and tt_tab = '$ftab' and ft_sch = '$sch' and ft_tab = '$tab'"] {
            lassign $rec tt_cols ft_cols		;#else try a reverse relationship
#puts "Rev: tt_cols:$tt_cols ft_cols:$ft_cols"
            lappend v($idx) [list [eval split $tt_cols ,] [eval split $ft_cols ,]]		;#eval gets rid of {}'s
        }
    }
#puts " v($idx):$v($idx)"
    return $v($idx)
}

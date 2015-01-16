# Common TCL functions for use by any schema file
#include(Copyright)

# Remove a field from a list
#------------------------------------------
proc lremove {list element} {
    if {[set idx [lsearch -exact $list $element]] < 0} {return $list}
    return [lreplace $list $idx $idx]
}

# Turn a TCL list into a comma-separated list
#----------------------------------------------------------------
proc fld_list {items {alias {}}} {
    if {$alias == {}} {
        return [join $items {, }]
    } else {
        return "$alias.[join $items ", $alias."]"
    }
}

# Put "new." in front of each field name and return comma separated list
#----------------------------------------------------------------
proc fld_list_new {items} {
    set rlist {}
    foreach item $items {lappend rlist "new.$item"}
    return [join $rlist {, }]
}

# Turn each field into "fld=new.fld" and return comma separated list
#----------------------------------------------------------------
proc fld_list_eq {items {app new} {delim {, }}} {
    set rlist {}
    foreach item $items {lappend rlist "$item = $app.$item"}
    return [join $rlist $delim]
}

# Generic view insert rule
#----------------------------------------------------------------
proc rule_insert {view table fields {where {}}} {return "
    create rule ${view}_innull as on insert to $view do instead nothing;
    create rule ${view}_insert as on insert to $view
        $where do instead
        insert into $table ([fld_list $fields]) values ([fld_list_new $fields]);
"}

# Generic view update rule
#----------------------------------------------------------------
proc rule_update {view table upfields pkfields {where {}}} {return "
    create rule ${view}_upnull as on update to $view do instead nothing;
    create rule ${view}_update as on update to $view
        $where do instead
        update $table set [fld_list_eq $upfields]
        where [fld_list_eq $pkfields old { and }];
"}

# Generic view delete rule
#----------------------------------------------------------------
proc rule_delete {view table pkfields {where {}}} {return "
    create rule ${view}_denull as on delete to $view do instead nothing;
    create rule ${view}_delete as on delete to $view
        $where do instead
        delete from $table where [fld_list_eq $pkfields old { and }];
"}

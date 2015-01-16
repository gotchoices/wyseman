#Produce an interactive ER Diagram
#There are two coordinate spaces: real and logical.  Items should always
#be located according to logical space which will not change as a result
#of zooming.  Real coordinates are the actual pixels on the canvas which
#are spaced differently depending on what the current zoom is
#------------------------------------------
#Copyright WyattERP, all other rights reserved
package provide wyseman 0.40

#TODO:
#- draw arrows between tables
#- only compute shortest arrow path on create/drop
#- rubber-band only affected arrows when tables dragged
#- Separate menus for on-table / on-canvas
#- 
#- 
#LATER:
#- Expand to a toplevel mlb from right-click menu
#-

namespace eval erd {
    namespace export erd
    variable cfig
    variable v

    image create bitmap but -data "#define dot_width 7\n#define dot_height 7\nstatic unsigned char dot_bits[] = {\n0x08, 0x14, 0x2a, 0x55, 0x2a, 0x14, 0x08};"

    set cfig(swar) {{field 1 f} {frame 2 fr} {language 2 lang} {initialize 2 init} {size 2} {pageheight 5} {pagewidth 5}}
}

#option add *Erd*Listbox.font fixed widgetDefault
#option add *Erd*Listbox.borderWidth 1 widgetDefault
#option add *Erd.Canvas*Listbox.font {Fixed 8} 25	;#overcome Mlb defaults
#option add *Erd.Canvas*Label.font {Helvetica 8} widgetDefault
option add *Erd.Canvas*Listbox.borderwidth 1 widgetDefault
option add *Erd.Canvas.Frame.relief raised widgetDefault
option add *Erd.Canvas.Frame.borderWidth 1 widgetDefault
option add *Erd.Canvas.Frame.Label.background #8080ff widgetDefault
option add *Erd.Canvas.Frame.Label.cursor dot widgetDefault
option add *Erd.Canvas.Frame.width 120 widgetDefault
option add *Erd.Canvas.Frame.height 240 widgetDefault

#Anytime the widget main frame is configured, reconfigure the canvas size to fill the frame
#--------------------------------
proc erd::p_config {w {wid {}} {hei {}}} {
    variable cfig

#puts "P Configure w:$w wid:$wid hei:$hei width:[winfo width $w] height:[winfo height $w]"
    if {$wid == {}} {set wid [winfo width $w]}
    if {$hei == {}} {set hei [winfo height $w]}
    set pw [expr $wid - [winfo width  $w.ys] - 2]	;#-2 is a kludge (how to know exactly?)
    set ph [expr $hei - [winfo height $w.xs] - 2]

    $w.c configure -width $pw -height $ph 	;#-scrollregion "0 0 $mw $ph"
}

# Convert a logical coordinate to a real canvas coordinate at current scale
#--------------------------------
proc erd::ltor {w xy} {return [expr round($xy * $erd::cfig(size$w))]}

# Convert a real canvas coordinate to a logical coordinate at current scale
#--------------------------------
proc erd::rtol {w xy} {return [expr round($xy / $erd::cfig(size$w))]}

# Get first tag from an item that is not "current" (hopefully the table name)
#--------------------------------
proc erd::tagof {w tag} {
    foreach t [$w.c gettags $tag] {
        if {$t != {current}} {return $t}
    }
    return {}
}

# Prepare for a drag-n-drop
#--------------------------------
proc erd::start_drag {w x y} {
    variable v
    set v(initx) [set v(lastx) [$w.c canvasx $x]]	;#initxy is where we were before we started dragging (canvas space)
    set v(inity) [set v(lasty) [$w.c canvasy $y]]
#puts "start: lastx:$v(lastx) lasty:$v(lasty)"
    set v(curset$w) [tagof $w current]
    $w.c raise $v(curset$w)
}

# Do the dragging
#--------------------------------
proc erd::drag {w x y} {
    variable v
    set t $v(curset$w)
    set x [$w.c canvasx $x]
    set y [$w.c canvasy $y]
#puts "drag: lastx:$v(lastx) lasty:$v(lasty) x:$x y:$y"
    $w.c move $t [expr $x - $v(lastx)] [expr $y - $v(lasty)]
    set v(lastx) $x
    set v(lasty) $y

#Rubber band: (too slow)
#    links $w $t
}

# After dragging (drop it), snap to grid
#--------------------------------
proc erd::end_drag {w x y} {
    variable cfig
    variable v
#puts "end_drag $w"
    set x [$w.c canvasx $x]	;#get canvas coordinates of pointer
    set y [$w.c canvasy $y]
    if {![lcontain $cfig(tags$w) $v(curset$w)]} return
#puts "done: initx:$v(initx) inity:$v(inity) x:$x y:$y"
    set rx [rtol $w [expr $x - $v(initx)]]	;#total delta (logical)
    set ry [rtol $w [expr $y - $v(inity)]]
#puts "      rx:$rx ry:$ry"
    set sx [expr [ltor $w $rx] + $v(initx)]	;#on-grid absolute position (logical)
    set sy [expr [ltor $w $ry] + $v(inity)]
#puts "      sx:$sx sy:$sy"
    $w.c move $v(curset$w) [expr $sx - $v(lastx)] [expr $sy - $v(lasty)]	;#snap to grid
    set t $w.c.$v(curset$w)
    set cfig(x$t) [expr $cfig(x$t) + $rx]	;#remember where widget is now
    set cfig(y$t) [expr $cfig(y$t) + $ry]
#puts "      nx:$cfig(x$t) ny:$cfig(y$t)"

    links $w $v(curset$w)
}

#Print canvas
#--------------------------------
proc erd::print {w {tofile 0}} {
    variable cfig
    variable v
    if {$tofile} {
        if {[sfile::dia {Select a filename to export to} -dest fname -op {Export to} -mask {*.ps} -wait 1] != 0} return
    } else {
        set fname [file join [lib::cfig workdir] "erd-tmp.ps"]
    }
    update
    lib::cwatch $w
#    set xc [expr round($v(maxx$w) / 2)]
#    set yc [expr round($v(maxy$w) / 2)]
    lassign {144 144} xc yc
    set anchor nw
#puts "Printing postscript to: $fname" 
#puts "  maxx:$v(maxx$w) maxy:$v(maxy$w) xc:$xc yc:$yc"
    $w.c postscript -file $fname -width $v(maxx$w) -height $v(maxy$w) -pagewidth $cfig(pagewidth$w) -pageheight $cfig(pageheight$w) -rotate $cfig(rotate$w) -pagex $xc -pagey $yc -pageanchor $anchor -colormode gray
    lib::cnorm $w
    if {!$tofile} {print::print erd_print -file $fname}
}

# Compute the best (closest) end points for an arrow between two tables
#--------------------------------
proc erd::closest {w tab1 x1 y1 tab2 x2 y2} {
    upvar $x1 x1u $y1 y1u $x2 x2u $y2 y2u
    variable cfig
    variable v
    
    set t1x [expr $cfig(x$w.c.$tab1) * $cfig(size$w)]	;#table 1 origin
    set t1y [expr $cfig(y$w.c.$tab1) * $cfig(size$w)]
    set t1w $cfig(width$w)		;#width
    set t1h $cfig(height$w.c.$tab1)	;#height
    
    set t2x [expr $cfig(x$w.c.$tab2) * $cfig(size$w)]	;#table 2 origin
    set t2y [expr $cfig(y$w.c.$tab2) * $cfig(size$w)]
    set t2w $cfig(width$w)		;#width
    set t2h $cfig(height$w.c.$tab2)	;#height

    set x1m [expr $t1x + $t1w]		;#table 1 max coordinates
    set y1m [expr $t1y + $t1h]
    set x1i [expr $t1w / 2]		;#table 1 increment size
    set y1i [expr $t1h / 2]
    set x2m [expr $t2x + $t2w]		;#table 2 max coordinates
    set y2m [expr $t2y + $t2h]
    set x2i [expr $t2w / 2]		;#table 2 increment size
    set y2i [expr $t2h / 2]
    
    set min 10000000
    for {set x1t $t1x} {$x1t <= $x1m} {set x1t [expr $x1t + $x1i]} {
      for {set y1t $t1y} {$y1t <= $y1m} {set y1t [expr $y1i + $y1t]} {
        for {set x2t $t2x} {$x2t <= $x2m} {set x2t [expr $x2t + $x2i]} {
          for {set y2t $t2y} {$y2t <= $y2m} {set y2t [expr $y2i + $y2t]} {
            set dist [expr sqrt(pow($x1t - $x2t,2) + pow($y1t - $y2t,2))]
            if {$dist < $min} {
#                lassign "$x1t $y1t $x2t $y2t" x1u y1u x2u y2u
                set v(${tab1}-close-${tab2}) "$x1t $y1t $x2t $y2t"
                set min $dist
#puts "xt:$xt yt:$yt dist:$dist"
            }
          }
        }
      }
    }
}

# Draw links outbound from the specified tables
#--------------------------------
proc erd::outlinks {w args} {
    variable cfig
    variable v

#puts "args:$args"
    if {[llength $args] <= 0} {set args $v(linktags$w)}
    foreach tab1 $args {
        foreach tab2 $v(link.$w.c.$tab1) {
    
#puts " tab1:$tab1 tab2:$tab2"
#            if {![info exists v(${tab1}-close-${tab2})]} {
                closest $w $tab1 x1 y1 $tab2 x2 y2
#            }
            lassign $v(${tab1}-close-${tab2}) x1 y1 x2 y2
            if {[llength [set id [$w.c find withtag "$tab1-link-$tab2"]]] <= 0} {	;#doesn't exist yet
                $w.c create line $x1 $y1 $x2 $y2 -tags "$tab1-link-$tab2 arrow" -arrow last -fill red
            } else {
                $w.c coords $id $x1 $y1 $x2 $y2
#puts " $w.c coords $id $x1 $y1 $x2 $y2"
                $w.c raise arrow
            }
        }
    }
}

# Draw all links in or out of a specified table
#--------------------------------
proc erd::links {w t} {
    variable cfig
    variable v
    set dirty $t			;#also drag any outbound arrows
    foreach tag $v(linktags$w) {	;#and any inbound arrows
        if {[lcontain $v(link.$w.c.$tag) $t] && ![lcontain $dirty $tag]} {
            lappend dirty $tag
        }
    }
#if {[lcontain $dirty empl]} {puts "dirty: $dirty"}
    eval outlinks $w $dirty
}

# Draw a table at the specified location and font size
# Scale: 100=
#--------------------------------
proc erd::draw_table {w tag} {
    variable cfig
    variable v

    set t $w.c.$tag
    set height $cfig(cheight$w)
    set width $cfig(width$w)
    set font $cfig(font$w)
    set x [expr int($cfig(x$t) * $cfig(size$w))]
    set y [expr int($cfig(y$t) * $cfig(size$w))]
    $w.c delete $tag
    
    if {$x < $v(minx$w)} {set v(minx$w) $x}
    if {$y < $v(miny$w)} {set v(miny$w) $y}
#puts "draw x:$x y:$y"
    $w.c create rect $x $y [expr $x + $width] [expr $y + $height + 2] -tags $tag -fill $cfig(tcolor$w)
    $w.c create text [expr $x + 2] [expr $y + ($height/2) + 1] -text $tag -tags $tag -anchor w -font $font
    $w.c create line $x [expr $y + $height] [expr $x + $width] [expr $y + $height] -tags $tag
    incr y [expr $height + 2]
    set cfig(height$t) [expr $height + 2]
    foreach rec $cfig(query$t) {
        lassign $rec field columnname ispkey
        if {$ispkey == {t}} {set c $cfig(kcolor$w)} else {set c $cfig(color$w)}
#puts "ispkey:$ispkey c:$c"
        $w.c create rect $x $y [expr $x + $width] [expr $y + $height] -tags $tag -fill $c
        $w.c create text [expr $x + 2] [expr $y + ($height/2) + 1] -text $columnname -tags $tag -anchor w -font $font
        incr y $height
        incr cfig(height$t) $height
    }
    $w.c bind $tag <Button-3> "erd::cmenu $w $tag"
    incr x $width
    if {$x > $v(maxx$w)} {set v(maxx$w) $x}
    if {$y > $v(maxy$w)} {set v(maxy$w) $y}
}

# Add a new table widget to the canvas
#--------------------------------
proc erd::add {w args} {
    variable cfig
    variable v
    argform {table title help x y} args
    argnorm {{table 2} {title 2} {help 2}} args
    if {[set table [xswitchs table args]] == {}} return
    set t $w.c.$table
    lassign {0 0} x y
    foreach s {title help} {set cfig($s$t) [xswitchs $s args]}
    foreach s {x y} {xswitchs $s args $s}

    set cfig(query$t) [sql::qlist "select field,col,is_pkey from wm.column_pub where obj = '$table' and (language isnull or language = '$cfig(lang$w)') order by field"]
    set cfig(x$t) $x
    set cfig(y$t) $y
#    draw_table $w $table	;#wait for redraw
}

# Yield/restore preferences
#------------------------------------------
proc erd::pref {w args} {
    variable cfig
    variable v
    if {[llength $args] > 0} {eval pref::restore $args; return}
    
    lappend parr "configure -size [$w cget -size]"
    foreach tag $cfig(tags$w) {
        lappend parr "table $tag configure -x [$w table $tag cget -x] -y [$w table $tag cget -y]"
    }
#puts "Dump pref:$parr"
    return $parr
}

# Context menu
#------------------------------------------
proc erd::cmenu {w {tag {}}} {
    variable v
    set v(tabtag$w) $tag
#puts "tag:$tag"
    lassign [winfo pointerxy .] x y
    tk_popup $w.m $x $y
}

# Redraw canvas, possibly at a new scale
#--------------------------------
proc erd::redraw {w {delta 0}} {
    variable cfig
    variable v

#puts "redraw:$w"
    incr cfig(size$w) $delta
    if {$cfig(size$w) < 4} {set cfig(size$w) 4; return}
    if {$cfig(size$w) > 20} {set cfig(size$w) 20; return}

#Calculate results of new scale
    set cfig(font$w) "courier $cfig(size$w) bold"
    set cfig(cheight$w) [expr [font metrics $cfig(font$w) -ascent] + 2]
    set cfig(width$w) [expr $cfig(cheight$w) * 8]
    
#puts "size:$cfig(size$w)"
    array set v "minx$w 1000000 miny$w 1000000 maxx$w -1000000 maxy$w -1000000"
    lib::cwatch $w
    foreach tag $cfig(tags$w) {draw_table $w $tag}
    lib::cnorm $w

    if {0 < $v(minx$w)} {set v(minx$w) 0}
    if {0 < $v(miny$w)} {set v(miny$w) 0}
#puts "$v(minx$w) $v(miny$w) $v(maxx$w) $v(maxy$w)"
    $w.c configure -scrollregion "$v(minx$w) $v(miny$w) $v(maxx$w) $v(maxy$w)"
    
    outlinks $w
}

# Add all tables from the database
#--------------------------------
proc erd::init {w args} {
    variable cfig
    variable v

#    argform {} args
    argnorm {{xoff 2} {yoff 2} {xmax 2}} args
    array set cfig "xoff$w 18 yoff$w 18 xmax$w 160"
#    foreach s {} {set cfig($s$w) [xswitchs $s args]}
    foreach s {xoff yoff xmax} {xswitchs $s args cfig($s$w)}

    set cfig(tags$w) {}
    lassign {1 1} x y
    foreach rec [sql::qlist "select obj,tab_kind,title,help from wm.table_pub where tab_kind = 'r' and (language isnull or language = '$cfig(lang$w)') order by obj"] {
#puts "T rec:$rec"
        lassign $rec tag tab_kind title help		;#query finds only tables with text descriptions
        add $w $tag $title $help $x $y
        lappend cfig(tags$w) $tag
        incr x $cfig(xoff$w)
        if {$x > $cfig(xmax$w)} {
            set x 1
            incr y $cfig(yoff$w)
        }
        set v(link.$w.c.$tag) {}
    }
    set v(linktags$w) {}
    redraw $w
#puts "tags:$cfig(tags$w)"
    foreach rec [sql::qlist "select tt_obj,ft_obj from wm.fkey_pub where ft_obj != tt_obj and tt_obj in ('[join $cfig(tags$w) {','}]') and ft_obj in ('[join $cfig(tags$w) {','}]') order by 2"] {
        lassign $rec tag fobj
#puts "L rec:$rec"
        lappend v(linktags$w) $tag		;#tables with fk references (outbound arrows)
        lappend v(link.$w.c.$tag) $fobj		;#who they point to
        outlinks $w $tag
    }
}

# Get configuration for an entry
#------------------------------------------
proc erd::cget {w option} {
    variable cfig
    argnorm $cfig(swar) option
    set opt [string trimleft $option -]
#puts "cget:$w opt:$opt"
    if {[lcontain {lang size pagewidth pageheight} $opt]} {return $cfig($opt$w)}
    return [eval _$w cget $option]
}

# Configure an existing widget
#------------------------------------------
proc erd::configure {w args} {
    variable cfig
    if {$args == {}} {return [_$w configure]}
    argnorm $cfig(swar) args
    foreach tag {lang size pagewidth pageheight} {xswitchs $tag args cfig($tag$w)}
    if {$args != {}} {return [eval _$w configure $args]}
    return {}
}

# Constructor
#------------------------------------------
proc erd::erd {w args} {
    variable cfig
    variable v

    argnorm $cfig(swar) args
    array set cfig "lang$w en tags$w {} pagewidth$w 24i pageheight$w 36i color$w #f0f0ff tcolor$w #b0b0ff kcolor$w #b0ffb0 size$w 6 rotate$w 1"
#    foreach s {data} {set cfig($s$w) [xswitchs $s args]}
    foreach s {init lang size pagewidth pageheight} {xswitchs $s args cfig($s$w)}

    lassign {} cols fr
    while {[xswitch f args va sw] != {}} {lappend cols $sw $va}	;#grab fields from cmdline
    while {[set x [xswitch fr args]] != {}} {append fr { } $x}

    set cfig(lbargs$w) $args
    array set v "master$w {} marked$w {}"

    if {[winfo exists $w]} {
        eval $w configure $fr
    } else {
        eval wframe::_frame $w -class Erd $fr
        bind $w <Configure> {erd::p_config %W %w %h}
        widginit $w erd *$w
    }

    canvas $w.c -bg white -xscrollc "$w.xs set" -yscrollc "$w.ys set" ;#-scrollregion "0 0 $cfig(width$w) $cfig(height$w)"
    scrollbar $w.xs -orient h -command "$w.c xview"
    scrollbar $w.ys -orient v -command "$w.c yview"
    button $w.b -image but -help {What does this do} -command "$w huh"
    grid $w.c $w.ys -row 0 -sticky news
    grid $w.xs $w.b -row 1 -sticky news
#    grid propagate $w no
#    p_config $w

    bind $w.c <1> "erd::start_drag $w %X %Y"
    bind $w.c <B1-Motion> "erd::drag $w %X %Y"
    bind $w.c <ButtonRelease-1> "erd::end_drag $w %X %Y"
    bind $w.c <Button-3> "erd::cmenu $w"

    bind $w.c <plus> "erd::redraw $w 2"
    bind $w.c <equal> "erd::redraw $w 2"
    bind $w.c <minus> "erd::redraw $w -2"

#Build widget menus
    menu $w.m
    $w.m add command ps -label {Postscript} -command "erd::print $w 1" -help {Generate a postscript file of the diagram}
    $w.m add command pr -label {Print} -command "erd::print $w" -help {Print the canvas to a file}

    $w.m add cascade -label Table -menu $w.m.c -help {Perform operations on this column}
    menu $w.m.c -tearoff no
    $w.m.c add command au -label {Raise} -command "$w.c raise \$erd::v(tabtag$w)" -help {Cause this table to overlap others}
    $w.m.c add command au -label {Lower} -command "$w.c lower \$erd::v(tabtag$w)" -help {Cause this table to underlay others}

    if {[info exists cfig(init$w)]} {
        if {$cfig(init$w)} {init $w}		;#insert initial data
    }
    return $w
}

# Get configuration for a table
#------------------------------------------
proc erd::table_cget {w tag option} {
    variable cfig
#    argnorm {} option
    set opt [string trimleft $option -]
#puts "cget:$w opt:$opt"
    if {[lcontain {x y} $opt]} {return $cfig($opt$w.c.$tag)}
    dia::err "Unknown option: -$opt"
}

# Configure an existing table
#------------------------------------------
proc erd::table_configure {w tag args} {
    variable cfig
#    if {$args == {}} {return [_$w configure]}
#    argnorm {} args
    set did_something 0
    foreach s {x y} {
        xswitchs $s args cfig($s$w.c.$tag)
        incr did_something
    }
    if {$did_something} {draw_table $w $tag; links $w $tag}
    if {$args != {}} {dia::err "Unknown options: $args"}
    return {}
}

# Pass a command to a table (pseudo widget)
#--------------------------------
proc erd::table {w tag args} {
    variable cfig
    set args [lassign $args cmd]
#puts "table:$w tag:$tag cmd:$cmd args:$args"
    set cmd [unabbrev {{configure 3} {cget 2}} $cmd]
    if {[lcontain {configure cget} $cmd]} {return [eval table_$cmd $w $tag $args]}
}

# Widget command
#------------------------------------------
proc erd::wcmd {w cmd args} {
    variable cfig
    variable v
#puts "wcmd:$w $cmd $args"
    set cmd [unabbrev {{frame 1} {add 2} {get 2} {initialize 2 init} {preference 3 pref} {configure 2} {cget 2}} $cmd]
    if {[lcontain {add get init pref links configure cget} $cmd]} {return [eval $cmd $w $args]}
    switch -exact -- $cmd {
        {w}		{return $w}
        {table}	{
            set args [lassign $args tag]
            if {[lcontain $cfig(tags$w) $tag]} {return [eval table $w $tag $args]}
            error "Invalid table: $tag"
        }
        {frame} {return [eval table _$w $args]}
        {default}	{
            if {[lcontain $cfig(tags$w) $cmd]} {
                return [eval table $w $cmd $args]
            } else {
                return [eval $w.c $cmd $args]
            }
        }
    }
}

#bind Erd <Leave>	{+help::leave %W}
#bind Erd <Motion>	{+help::motion %W}

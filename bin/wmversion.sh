#!/bin/bash
#Set the package version in all tcl files according to what is in Makefile
#Copyright WyattERP.org; See license in root of this package
# -----------------------------------------------------------------------------

if [ ! -z "$2" ]; then
    lib="$1"
    vers="$2"
else
    IFS='=' read junk lib  <<<"$(grep '^LIBNAME=' Makefile)"
    IFS='=' read junk vers <<<"$(grep '^VERSION=' Makefile)"
echo "Setting package:$lib version to: $vers"
    if [ -z "$lib" ]; then
        echo "Can't find lib name in Makefile"
        exit 1
    fi
    if [ -z "$vers" ]; then
        echo "Can't find version in Makefile"
        exit 1
    fi
fi

for f in $(grep -l "package provide $lib" *.tcl); do
    cp $f /tmp/$f.tmp
#echo "f:$f"
#echo "s/^\(package provide $lib\) [0-9.]*/\1 $vers/"
    cat /tmp/$f.tmp |\
	sed -e "s/^\(package provide $lib\) [0-9.]*/\1 $vers/" |\
	cat >$f
#	cat >/dev/null		#For debug
#	grep 'package provide'
    rm /tmp/$f.tmp
done

if [ -f Version.h ]; then
cat >Version.h <<-EOF
	#define	PACKAGE		"$lib"
	#define VERSION		"$vers"
	EOF
fi

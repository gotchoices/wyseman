#!/bin/sh
#Make the current directory into a release tar file
#Copyright WyattERP.org; See license in root of this package
# -----------------------------------------------------------------------------
buildin=/tmp		#build release tar in this directory

make clean		#make it clean first

if [ ! -z "$1" ]; then
    package="$1"
else
read j1 package j2 <<EOF
$(grep '^LIBNAME' Makefile |tr '=' ' ')
EOF
fi

if [ ! -z "$2" ]; then
    version="$2"
else
read j1 version j2 <<EOF
$(grep '^VERSION' Makefile |tr '=' ' ')
EOF
fi

read release junk <Release
echo "package:$package: version:$version: release:$release:"

fbase="$package-$version.$release"

thisdir=$(basename $(pwd))

tarfile="$buildin/$fbase.tgz"
echo "Building dir: $thisdir in $tarfile"

targetdir=/tmp/$fbase

echo "Formatting, tarring, and zipping files..."

for file in $(find ./ |\
              grep -v '/old' |\
              grep -v '/TODO' |\
              grep -v '/mkrelease' |\
              grep -v '/.svn') ; do
    if [ -d $file ] ; then
        mkdir -p $targetdir/$file
    else
        cp $file $targetdir/$(dirname $file)
    fi
done
cd $targetdir
cd ..
tar -czf $tarfile $fbase
rm -rf $targetdir

echo "Done"

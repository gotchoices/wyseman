LIBNAME=wyseman
VERSION=0.40
LBITS := $(shell getconf LONG_BIT)

#Allow the user to install where he wants
ifeq ("$(WYLIB)","")
    LIBDIR=/usr/lib
else
    LIBDIR=${WYLIB}
endif
ifeq ("$(WYBIN)","")
    BINDIR=/usr/local/bin
else
    BINDIR=${WYBIN}
endif

PKGNAME=${LIBNAME}-${VERSION}
INSTDIR=${LIBDIR}/${PKGNAME}

all: shared pkgIndex.tcl

shared:
	cd c; make
	ln -f -s c/libwyseman.so .
ifeq ($(LBITS),64)
	ln -f -s c/libwyseman-x86_64.so .
endif

pkgIndex.tcl: wmparse.tcl wmddict.tcl wmdd.tcl
ifeq ($(LBITS),64)
	echo "pkg_mkIndex -lazy . erd.tcl wmparse.tcl wmddict.tcl wmdd.tcl libwyseman-x86_64.so" | tclsh

	# allow pkgIndex to load the 64-bit and 32-bit versions of libwyseman.so
	mv pkgIndex.tcl pkgIndex.tmp1
	echo "# 64-bit and 32-bit combined Tcl package index file" > pkgIndex.tmp2
	echo 'if {$$::tcl_platform(pointerSize) == 8} {' >> pkgIndex.tmp2
	cat pkgIndex.tmp1 >> pkgIndex.tmp2
	echo "} else {" >> pkgIndex.tmp2
	cat pkgIndex.tmp1 | sed -e 's/libwyseman-x86_64.so/libwyseman.so/' >> pkgIndex.tmp2
	echo "}" >> pkgIndex.tmp2
	mv pkgIndex.tmp2 pkgIndex.tcl
	rm pkgIndex.tmp1
else
	echo "pkg_mkIndex -lazy . erd.tcl wmparse.tcl wmddict.tcl wmdd.tcl libwyseman.so" | tclsh

	# allow pkgIndex to load the 64-bit and 32-bit versions of libwyseman.so
	mv pkgIndex.tcl pkgIndex.tmp1
	echo "# 64-bit and 32-bit combined Tcl package index file" > pkgIndex.tmp2
	echo 'if {$$::tcl_platform(pointerSize) == 8} {' >> pkgIndex.tmp2
	cat pkgIndex.tmp1 | sed -e 's/libwyseman.so/libwyseman-x86_64.so/' >> pkgIndex.tmp2
	echo "} else {" >> pkgIndex.tmp2
	cat pkgIndex.tmp1 >> pkgIndex.tmp2
	echo "}" >> pkgIndex.tmp2
	mv pkgIndex.tmp2 pkgIndex.tcl
	rm pkgIndex.tmp1
endif

install: all
	if ! [ -d ${INSTDIR} ] ; then mkdir ${INSTDIR} ; fi
	install -m 644 *.tcl ${INSTDIR}
	install -m 755 libwyseman.so ${INSTDIR}
	install -m 755 wyseman	${BINDIR}
	install -m 755 wysegi	${BINDIR}
	install -m 755 wmmkpkg	${BINDIR}
ifeq ($(LBITS),64)
	install -m 755 libwyseman-x86_64.so ${INSTDIR}
endif

uninstall:
	rm -rf ${INSTDIR}

release:
	mkrelease

clean:
	rm -f pkgIndex.tcl
	rm -f *.so
	cd c; make clean

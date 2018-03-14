LIBNAME=wyseman
VERSION=0.60
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

all: pkgIndex.tcl

pkgIndex.tcl: erd.tcl wmdd.tcl
	wmmkpkg ${LIBNAME} ${VERSION}
#	echo "pkg_mkIndex -lazy . erd.tcl wmdd.tcl" | tclsh

install: all
	if ! [ -d ${INSTDIR} ] ; then mkdir ${INSTDIR} ; fi
	install -m 644 *.tcl ${INSTDIR}

uninstall:
	rm -rf ${INSTDIR}

release:
	wmrelease ${LIBNAME} ${VERSION}

clean:
	rm -f pkgIndex.tcl

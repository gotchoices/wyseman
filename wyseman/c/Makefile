LIBDIR=/ati/etc/tcl
DEFS=
OBJS=
LBITS := $(shell getconf LONG_BIT)

all:	libwyseman.so
all:	libwyseman.so libwyseman-x86_64.so

libwyseman-x86_64.so: macscan-x86_64.o wyseman-x86_64.o
ifeq ($(LBITS),64)
	gcc -m64 -shared macscan-x86_64.o wyseman-x86_64.o -o libwyseman-x86_64.so
endif

libwyseman.so: macscan.o wyseman.o
	gcc -m32 -shared macscan.o wyseman.o -o libwyseman.so

wyseman-x86_64.o: wyseman.c
ifeq ($(LBITS),64)
	gcc -m64 -fpic -c wyseman.c -o wyseman-x86_64.o ${DEFS}
endif

wyseman.o: wyseman.c
	gcc -m32 -fpic -c wyseman.c ${DEFS}

macscan-x86_64.o: macscan.c
ifeq ($(LBITS),64)
	gcc -m64 -fpic -c macscan.c -o macscan-x86_64.o ${DEFS}
endif

macscan.o: macscan.c
	gcc -m32 -fpic -c macscan.c ${DEFS}

clean:
	rm -f *.so *.o

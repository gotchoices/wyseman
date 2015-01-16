#To make a different database (mydb):
#    make build DBNAME=mydb
#To rebuild a branch of the database:
#    wyseman -db wyatt -oper 'dump drop create restore grant' -branch empl *.wms
DBNAME=wyatt
DATDIR=/tmp/pgdata
BRANCH=__none__

all: text

#Create database tables containing language text describing tables/columns
text:
	wyseman -db ${DBNAME} -oper text common.tcl *.wms *.wmt

#Create run-time library with table/column/widget preferences
lib:
	wyseman -db ${DBNAME} -oper lib common.tcl *.wms *.wmd
	cd wmdb; make

#Recreate a node in the database and all its dependents without losing data (hopefully)
redo: 
	wyseman -db ${DBNAME} -branch ${BRANCH} -oper 'dump drop create grant restore' common.tcl *.wms

#Do all steps to build a new database and populate it from dump files (may need to drop first)
rebuild: createdb create populate index sequence text

#Do all steps to build a new empty database (may need to drop first)
build: createdb create index text

#Dump all database tables to backup files and drop
dump:
	wyseman -db ${DBNAME} -oper 'dump' common.tcl *.wms

#Create basic schema (but not indexes until after data sucked in)
create:
	wyseman -db ${DBNAME} -oper 'create grant' -texcl 'index' common.tcl *.wms

#Populate database from dump files
populate:
	wyseman -db ${DBNAME} -oper restore -work ${DATDIR} common.tcl *.wms

#build indexes after data restored
index:
	wyseman -db ${DBNAME} -oper create -tincl 'index' common.tcl *.wms

#Set sequences to values that match current table data
sequence:
	psql ${DBNAME} -f sequences.sql

#Create a new database and build the wyatt information schema
createdb:
	createdb ${DBNAME}

dropdb:
	dropdb ${DBNAME}
	sleep 1

#install:

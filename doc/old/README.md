## Wyseman: WyattERP Schema Manager

Wyseman is a database schema manager, part of the WyattERP application 
framework.

It is used for authoring and managing database schemas in PostgreSQL.  It 
also provides run-time access to a dictionary for access to meta-data about
database objects.

Run-time support includes:
* Javascript
* Ruby (deprecated)
* Legacy TCL

This is how it works.
You author your SQL objects inside TCL data containers like this:
```
    table myschema.mytable {dependency1 dependency2 ...} {
      columnA	typeA 	primary key,
      columnB	typeB,		-- Regular SQL stuff in here
      columnC	typeC		-- Just as in 'table create'
    }
```
This tells wyseman what your object is, how to create it, and unless it is 
self-evident, how to drop it.  Most importantly, it tells if there are other 
objects that will have to be recreated as well if we want to rebuilt this one.

There are two other very similar object decriptions you can make too:

1. A *tabtext* contains language data about the table, columns, and possible
values for your data.  You can define this for any number of different languages.
For example:

```
  tabtext myschema.mytable {What my table is for} {
    columnA	{Title for A} {More detailed info for column A}
    columnB	{Title for B} {More detailed info for column B}
    columnC	{Title for C} {More detailed info for column C} {
      value1	  {Title for 1} {What this possible C value means}
      value2	  {Title for 2} {What this possible C value means}
      value3	  {Title for 3} {What this possible C value means}
    }
  } -language en
```

2. A *tabdef* contains information about how your tables and views should 
normally render and otherwise, be handled, in the user's view.

Once you have your schema defined, just tell wyseman to build it from your files.
It will store all your objects into a special schema in the database.
And on your command, it will build the target schema you have just designed.

Then, as you make changes to your object definitions, wyseman can modify and 
upgrade the running database, without disrupting any data it may contain, to 
keep it current with your design.

Now go create your frontend using [Wylib](http://github.com/gotchoices/wylib)
and your application will automatically have access to all the information
about your database tables, columns and so forth.

There is also an associated package called 
[Wyselib](http://github.com/gotchoices/wyselib)
that contains a bunch of basic schema components for handling common things 
like people, accounts, products, etc.

These packages work together to make it relatively painless to make and more 
importantly, *maintain* a production database application.

----
### Background History
When I first started using SQL relational databases, there was one issue
I continually struggled with:  How is it best to maintain the source 
definition of my database schema.

I started out editing my SQL in neatly commented text files.  During the
testing phase, I would periodically drop the database and re-create it
from my text files until I finally had a working system.

This all worked out very well until I began to find the weaknesses in my
design and wanted to fix them.  Now the problems was, I had live data
in my tables so I couldn't just drop the database and start over.  I had
to alter the database without disturbing it too much so it could stay in
operation for my users.

Like most people, I discovered the "alter" commands of SQL and began
carefully adjusting tables, adding columns, altering views, changing
functions etc.  The problem was, my original SQL files quickly began to
become obsolete.  They described the schema I had originally crafted, but
not the one it was becoming.

For a while, I tried to keep them current.  Each time I would alter the
database, I would edit my SQL files to reflect the changes I had made.
But these changes never actually got tested so I was never quite sure if
I had gotten them right.

In one case, I found that in dropping and re-creating certain tables,
I had inadvertently dropped certain key referential integrity triggers.
This resulted in a large amount of bad data creeping into my database and
long hours of work to fix it.

In another case, I wanted to re-create my schema for another enterprise. 
When I tried to run my SQL files, I found indeed they were full of errors.
Even after fixing the errors, I was not quite sure they reflected my 
working production system.

I tried using pg_dump to dump out the schema from my production system
and re-create it on the new system, but I was frustrated that the SQL was
really not the original code I had written, but a bit more cryptic form.
I was able to re-create the database exactly, but it proved difficult to
modify it for the needs of the new enterprise except through a set
of new alter commands.

It finally occurred to me that the create/alter model of SQL assumes
you are comfortable with the notion that the source for your model is
contained within the working instance of the database yourself.  Any
text files you create are merely temporary representations of the
modifications you apply.  The model consists of the net result of all
the changes that have been applied over time.  If you want to replicate
or alter the model, you are limited to the alter/dump commands available
and you'd better get it perfect as you apply your changes to the
production database.

As I used SQL more, I found myself using similar structures over and
over again.  For example, when adding insert or update rules to views, I
used similar syntax over and over with a few key parameter changes.
Sometimes, I also found other similar table or function structures that
could have been re-useable if only I had some kind of macro or scripting
capability on top of SQL.

Eventually, I set out to create a tool for managing my schema definitions
that would help me solve these and a few other problems.

I determined it would be best to have my source model contained in
text files rather than in the running instance of the database.  This
would give me more control over my authoring content.  If I wanted to
alter the model or create new instances, I could do it at any time
regardless of the accessibility of my production instance(s).

By using text files, this also opened up the opportunity to use 
pre-processing (macros, functions, etc.) to make my schema definitions
more concise and maintainable.

The original attempt consisted of a handful of shell scripts and a 
syntactical convention for placing bits of SQL inside my schema files in
predictable ways so the shell scripts could execute the right bits of
SQL at the right times.

Certain sections of the files contained the code for dropping certain
objects.  Other sections had the SQL to create those same objects.
Objects were also categorized by type which led to the very handy feature
of being able to drop and recreate all objects of a certain kind (like
re-indexing the whole database from a single command.)

I used m4 to pre-process my files, so I could begin to wrap bits of code
in macros.  This allowed me to create more SQL from a smaller set of
source code.  The result was, certain kinds of changes only needed
to be made in one place and the changes would propagate throughout the
database.

I also had a method by which certain source files were dependent upon
others.  This assured that the database objects were build (and/or 
dropped) in the right order.

All this worked so well, I decided to take another crack at it and see
if I could make it even better.  I decided to make it a part of my
open-source ERP toolkit Wyatt-ERP and added a data-dictionary capability 
for storing more information about tables, columns and column values.  
The result was Wyseman.

I very much liked the scripting capabilities of Tcl.  M4 had a number of
problems that worked out much better in Tcl.  The Tcl list constructs
also proved to be a great way to package the SQL bits and organize them
into the proper dependencies.

With this new implementation of Wyseman, it became possible to create an
entire database quickly and easily.  With an appropriate Makefile, this
could be done with a single command.  Because everything is 
scripted in Tcl, you could even parameterize your schema (i.e. you could
create schemas that are customized for different instances, but which
are described by a single set of schema files.)

Once you got your instance running, it was much easier to operate on the
"living patient."  You could select any branch of the "tree" of 
dependencies (like a function, for example), and with one command, you
could drop the old version of the object with all its dependencies, and 
then rebuild it again fresh from your schema definition files.

This gives the assurance that your running instance is truly the
product of your schema definition files.  And you don't have to worry about
whether all the dependent objects got correctly rebuilt or not.

If any of the objects you need to rebuild are tables, the data would be
dumped to a file before you did the drop, and re-inserted after the
table is re-created.  As long as the same columns exist in the tables
before and after, this all works.

So if you need to change the columns of a table, you would have to write a 
shell script that did the following:

  1. Correct any known anomalies in the data
  2. You can safely drop any data integrity triggers if needed
  3. Issue alter commands to add/drop table columns
  4. Synthesize appropriate data for any newly added columns
  5. Call wyseman to drop/restore the applicable database sections

Before you run your script on the production instance, you would use
pg_dump to create a sandbox copy of the instance and test your upgrade
script on that.  When everything looks good, you can shut down access to
the production instance and run the upgrade for real.

This all worked pretty well and served all the needs of the business it
was created for.

Fast-forward 10 years or so and I'm working on a new project that needs
these same kind of capabilities.  However it was clear, Wyseman needed
a bit of sprucing up to meet the needs of this project.  So the current
iteration includes the following upgrades:

- Reimplemented the command line program in Ruby, rather than TCL
- Improved the amount of data contained in the data dictionary
- Created the notion of schema versions to track multiple releases
- The schema files are still authored in text files, but then cached
  in the database itself, where the drop/re-create can all happen in
  a single transaction now.
- Implemented a Ruby run-time library to access the meta-data
- Implemented a Javascript run-time library to access the meta-data

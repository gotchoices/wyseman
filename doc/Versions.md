Schema Version Control

Objectives:
-------------------------------------------------------------------------------
Wyseman has three fundamental purposes:

- Schema Authoring
  Help the developer code, and make changes to the schema, quickly apply them 
  and evaluate their function in a tight, efficient design iteration cycle.
  This currently works quite well.

- Runtime Access
  Provide applications with an API to the database that is oriented around
  accessing tables, views, functions, reports and the schema data dictionary.
  This is also working well.

- Version Control
  Allow applications to seamlessly update older versions of a schema without
  requiring a full dump/restore and potentially other fiddling by end users.  
  This has not yet been implemented.

-------------------------------------------------------------------------------
Version Control Enhancements (Dec 2021)

The initial approach of the Ruby/JS port (as of 1.0.17) was to rely only on a
"release" number for each official version of the schema.  This approach has 
several problems:

- It can be difficult to know if a given instantiation of an object in the DB
  belongs to one release or another.  We have only the wm.release() function
  to rely on.  So how do we really know for sure about each individual object 
  when trying to update an entire schema from one release to the next?
  
  The initial approach was a precompiled schema file (schema-1.sql) which would
  have all the SQL in it to instantiate a schema of a given version.  But it
  didn't include the "development" parts of the schema such as wm.objects.  The 
  plan was to then create a schema-2.sql, schema-3.sql and so forth as the 
  schema design progressed.
  
  But this would also require migration scripts such as migrate-1-2.sql,
  migrate-2-3.sql etc. so an app could work with an existing DB instance at a 
  given release level and promote it all the way up to whatever the current 
  version should be.

- Schema components should be capable of being drawn from third-party libraries
  (such as wyselib).  This makes versioning even more complicated.  If my 
  schema version is release 3, but something changes in wyselib, how do I know 
  to promote my application release?  If I always have everything populated in 
  the wm.objects table, I might be able to detect that difference.  But it 
  would be difficult to know simply from a running instance of the database.
  
  The development schema included a field mod_ver intended somehow for this 
  purpose but hasn't been clear how to use or implement it yet.
  
These issues seem to lead to the conclusion that every object should somehow
deal with its own version control.  If every object could be uniquely 
identified by its:

  - Object type
  - Object name
  - Object version number

Then we could also record a hash of its contents, to also include (at least):
  - Create code
  - Dependencies
  - Grants

Then, the notion of a "release" could consist of a manifest of all the objects 
that belong in that given release, along with their versions and hashes.  This 
seems to simplify a number of issues.

Now a component can record an individual history of its changes, how to
migrate forward into new versions of the schema, and perhaps even how to revert
back to previous versions.

Some remaining potential pitfalls:

- How to track an object that was part of a prior release, but has now been
  dropped altogether?  Maybe it is enough to just have it absent from the 
  manifest.  During development, the developer would have to wisely use the 
  --prune switch to decide if/when to remove an object that is not part of a 
  current parse.  One would have to be careful if only parsing a subset of 
  all the applicable source files.
  
  Our initial approach will be to disable --prune if/when the branch option
  is set.  In other words, if we are not parsing all schema files, then
  don't try to prune because you will simply be deleting something that
  didn't get parsed on that run.

- How/where to save information about previous versions of database objects.
  The DB meta schema is designed for tracking multiple versions of objects. 
  But the flat files are not.  They only represent the current, latest 
  snapshot.  If we delete our database, we will lose all history.  If we want 
  someone else to have access to the entire schema history, they would need 
  more than the source files could provide.  There needs to be some file-based 
  archive, part of the schema directory that retains all the old object 
  history.

- How to reliably migrate data from one version of a table to the next when
  the structure of the table may have changed.  Non-table objects are not a
  problem.  We can just drop and re-create.  But when doing a dump/restore on
  a table, the system gets confused if the old data won't fit into the new
  table columns.

- Do we care about preserving past states of the data dictionary and the
  initialization data?  While this might be nice, it is probably of marginal
  value--especially in comparison to the complexity it would introduce.

-------------------------------------------------------------------------------
Table Data Migration

The main difficulties are presented by:

- New Constraints
  The problem is, the user's table may contain data that worked under the older, 
  more permissive constraints but won't be tolerated under the new constraints.  
  Likely the best we could hope for would be to register a set of queries that 
  would hopefully reveal rows that won't be allowed under the new set of 
  constraints.
  
  A savy developer could use wyseman to run these checks against the production
  database to see what data might need to be massaged prior to running an 
  update script.  A better approach would be a way for apps to do this on their
  own and just report data problems to the user.

- New Columns
  This can easily be handled by proper default values in the new schema.  The
  main problem will be if the developer creates a "not null" constraint but no
  default value.

- Missing Columns
  If a column is renamed or removed from one version to the next, we really need
  some kind of alter script to run just prior to the drop/create cycle on the
  table.  This will be done in a transaction so it can be safe from other
  accesses going on.  But it will really be up to the developer to write this
  correctly so that data dumped from the old table can be re-imported into the
  new one.
  
  For a renamed column, it is as simple as "alter table rename column x to y."
  
  For a deleted column, there is a chance there is data in that column that may
  need to be presented somehow in some new column.  The developer would have to 
  create the new column, insert data into it based on a query of the old, 
  obsolete column, and then drop the old column.

Wyseman could benefit from the following two features:

- Data Tests
- Version Migrations

Both apply only to tables and no other kind of object.

Data tests are limited to queries that will reveal records that have to be 
manually changed before there is any hope of upgrading versions.  Perhaps we
can get by without this feature because any attempt at upgrade would fail if 
there is offending data in a table.  As long as such attempts are atomic, there 
should be no harm in the attempt.

Version Migrations could potentially be any arbitrary SQL that must be executed 
in a transaction immediately before a drop/create cycle on the table.  But it
will simplify things to limit this to a few specific cases where table columns 
have been changed:

  - add column w sql_spec	(initialization expression)
  - drop column x		(revert expression)
  - rename column y z
  - update column expresson	(optional revert expression)

From this abstraction we could likely generate SQL to alter the table, just
prior to the drop/create.  We don't need to affect every possible change to the
table--just enough so the old data can dump and then restore back into the new
table properly.

Our meta schema will need to have provisions for storing and maintaining these
operations associated with the tables they belong to.  The operations also must
be stored in the order they were created, and are expected to be applied.

-------------------------------------------------------------------------------
History / Migration:

Wyseman will maintain files in the application schema folders called
Wyseman.hist.  This file holds a JSON structure containing the raw SQL 
information (what is in wm.objects) about all objects part of prior releases
but not representing any current changes in the associated schema file.

We will create a new command line switch to wyseman to accept a table
migration operation (delta) such as add, drop, rename, or update).  This
operation will be pushed onto a stack contained in another file called
Wyseman.delta.  The user will also have the ability to simply add delta
operations to that file by hand if they feel comfortable doing so.

Examples of table migration commands:
  - wyseman -g "trees add species 'text' maple"
  - wyseman -g "my.table add address 'text not null' ''"
  - wyseman -g "s.parts drop version 'int not null' 1"
  - wyseman -g "base.contacts rename cell mobile"
  - wyseman -g "items update status '\'closed\' where isnull'"

This will get translated into a json object describing the migration
operation, such as:
```
    {tab:'trees', oper:'add', col:'species', spec:'text' init:'maple'}
    or
    {tab:'contacts' oper:'rename' col:'cell' spec:'mobile'}
```

Each time wyseman rebuilds a table, it will check Wyseman.delta to see if 
there are new migration operations that are not applied to the database.  
If so, it will copy these into the database and make sure they are applied
on the next drop/create cycle for the applicable tables.

In addition to providing operations to the -g switch, you should be able
to give the following commands (pseudo operations):
  - "table list"	List out the migration commands for this table, 
  			showing what has and has not yet been deployed
  - "table edit"	Edit the migration file for this table
  - "table pop"		Un-apply the last deployed migration and remove
  			it from the stack in the database.  Mark as dirty.
  - "table reset"	Un-apply all deployed migrations and remove them
  			from the stack in the database.  Mark as dirty.

Once a new schema release is committed, our list of migration commands should 
get locked down and become a permanent part of the object, and recorded in
the associated history file.

We should be able to re-create the history file at any time from the locked
object versions contained in the database.  And we should also be able to 
populate an empty database from a valid history and delta file.

-------------------------------------------------------------------------------
Simplified Migration Syntax:

The above proposal implies encoding migration commands and then reconstructing
an SQL command based on the encoded command.  This may be more compact in
certain ways, but it is also limited to the foresight of the design, in what
commands are available.  And in its prototype JSON implementation, it doesn't
end up being all that compact anyway.

An alternate syntax would be to simply include SQL text fragments as follows:
  - tablename add column w sql_spec
  - tablename drop column x
  - tablename rename column y to z
  - any other full SQL command

The parser would examine the first and second token.  If the first token is
reasonably a tablename, and the second token is one of "add, drop, rename", we
will prepend to the command "alter table" and execute it.  Otherwise, we will
assume it to be a complete command and execute it as-is.

The DB could then store an index into the array of commands to point to the
next un-applied command, if any.  This will keep track of which commands have
yet to be executed.  This would be a very efficient way of marking/unmarking
the command stack for execution or re-execution.

-------------------------------------------------------------------------------
Bootstrap Schema:

Finally, we will resign to the fact that a production DB will contain the 
wm.objects table and its contents.  We need a reliable way to know which 
objects have been instantiated in the database.  And it will likely be
easier to bring an old schema current using the build mechanism previously 
only a part of the development environment.

There is probably not that compelling a reason anyway to use a trimmed-down 
schema (lacking certain development components) in a production database.

-------------------------------------------------------------------------------
Schema Operation Modes:

There are two basic modes of operation for a WyattERP database.  These need to
be compatible with each other at all times so we can switch back and forth
without anything bad happening.  This means I can create a database from a
canned schema file and then start changing schema objects and re-deploying
them.  It also means I can deploy first from object source code and then use
the resulting database in a production way.

  - Production:
    - Some app is accessing the DB through the Wyseman run-time API
    - Upon launch, check to see if there is an existing database
    - If no existing DB:
      - Populate wm.objects with build data from the schema file
      - Instantiate all database objects to current spec
      - Build data dictionary
      - Initialize all table data
    - Otherwise (there is an existing DB)
      - Check it's release/checksum
      - If the DB is newer than our schema file, report and abort!
      - If the DB matches our schema file, proceed normally
      - If the DB is older than our current schema file:
        - Load current and historical objects into DB
        - Prepare an SQL transaction to upgrade
        - Try executing it
        - If it succeeds, proceed as normal
        - If it fails, report and abort

  - Development:
    - The schema is under active development/modification
    - The wyseman CLI is being called to deploy objects from source code
    - Wm loads the bootstrap and run-time schema if it doesn't already exist
    - Also loads older objects from Wyseman.hist if they are not already loaded
    - Waits for further calls to wyseman to parse schema description files
    - When that happens:
      - Scan in all schema objects
      - Compare them to what is instantiated in the DB
      - Drop/replace anything that needs to be updated
      - Optionally prune any strays left over
      - Update Beta count in Wyseman.hist file
      - Keep track in the DB of which deltas (Wyseman.delta) got applied
    - When the developer commits a schema release number
      - Advance the release number in the DB
      - Create a new beta sequence for the next working release
    - The first time an object is modified after a release:
      - The old version gets a max_rel set to the prior release
      - We make a copy of the object starting min_rel at working release
      - We update the history file with the old version

-------------------------------------------------------------------------------
Status:

It is the job of the schema (and history) files to determine what the actual 
schema should be for any given release state.  The DB is primarily used as a
parsing, organizing mechanism to build and rebuild objects on demand.

If we are incrementally updating schema objects, the DB must keep track of 
which delta commands have actually been instantiated.  If the database is 
deleted, we will have to assume that we can just re-instantiate all objects
from the source files (in development mode) and can ignore any deltas sitting 
in Wyseman.delta as those would apply to previous versions of the table that
hopefully have already been applied in some prior instantiation of the DB.

In production mode (initializing from a schema file) we should attempt to
update the DB (including all applicable deltas) to whatever release of the
schema our application is expecting.

-------------------------------------------------------------------------------
File Changes:

To summarize the handling of these Wyseman-maintained files:

Wyseman.hist: (one per schema module)
  - Every Wyseman run:
    - Starting template file made (if absent) for each schema module
    - Compare with DB; Load history/releases if necessary to match file
    - After history and releases accurate, can then parse regular objects
  - If any objects were instantiated/modified in a make:
    - Increment the beta count (in the main module only)
  - When a release is committed
    - Put datestamp in the last element of the release array (main only)
    - Start a new beta count as the next array element (main only)
    - Increment next, release in DB (insert new releases record)

Wyseman.delta: (one per schema module)
  - When a migration command is given to Wyseman
    - Enter it into the correct array/file (depending on module and object)
  - Every Wyseman make run:
    - Compare all deltas with the current DB
    - Mark any new commands as dirty (not yet completed)
    - Then allow the regular drop/make cycle to occur
  - When a release is committed
    - Pre-check: only main module should have any deltas
      Sub modules should be resonsible for their own releases
    - Clear out the delta list in the main module
      Old deltas should now be saved in Wyseman.hist

-------------------------------------------------------------------------------
Strategy:

Instead of a schema file that is straight SQL create code, the following JSON
file format is proposed:
```
{
  hash:		"Hash of object Sql code",
  name:		Schema_name,,
  release:	Release_number,
  publish:	"Published Date (null if work-in-process)",
  boot:		"Encoded bootstrap SQL",
  dict:		"Encoded SQL to delete/insert data dictionary tables",
  init:		"Encoded application schema initialization SQL",
  objects: [		//All objects in current release, in dependency order
    obj1: {
      hash:	"ABC...",
      type:	"View, table, etc",
      name:	"Object name",
      version:	N,
      deps:	[dependencies],
      grants:	[grants],
      column:	[view column data],		//Views only
      create:	"Encoded Sql create code",
      drop:	"Encoded Sql drop code",
      delta:	[{oper 1}, {oper 2}, ...]	//Tables only
      first:	Minimum_release,
      last:	Maximum_release
    },
    obj2:	{Object record as above},
    ...
  ],
  history: [		/All objects from past releases
    obj1:	{Object record as above},
    obj2:	{Object record as above},
    ...
  ]
}
```
A schema file of this format should contain enough information to build a new, 
empty schema of the current version, or (assuming the history property is 
present) to upgrade an existing database from any version up to the current.

-------------------------------------------------------------------------------
History File:

Wyseman maintains a record of all objects part of previous releases, but not
what is represented in the current schema description files.  This is used for
migrating users from one verson of the schema to the next.  Wyseman will
maintain one such file for each separate module found in the schema files.

Wyseman.hist contains a single JSON object structured as follows:
```
{
  module:	Module_name,	//Wyselib, myApp, etc.
  releases:	[		//1-based array!
    "Release 1 publish date",
    "Release 2 publish date",
    0				//Working beta (pre-release) number
    ...
  ],
  past: [		/All objects from past releases
    obj1:	{Object record as above},
    obj2:	{Object record as above},
    ...
  ]
}
```
-------------------------------------------------------------------------------
Boot Loader:

A JSON schema file may be wrapped into a self-loading sql chunk as follows:
```
create schema if not exists wm;
create or replace function wm.loader(objs jsonb) as $$
  ... -- loader capable of reading JSON structure below
$$;
wm.loader('{
  "hash":	"Hash of release object hashes",
  "release":	Release_number,
  ...
}'); drop function wm.loader(jsonb);
```

This has the advantage that the schema will be built by first populating
wm.objects and then instantiating each of the objects.  This will make future
updating much easier.

-------------------------------------------------------------------------------

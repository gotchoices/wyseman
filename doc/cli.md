# Command Line Tools

[Prev](command-reference.md) | [TOC](README.md) | [Next](versioning.md)

Wyseman provides several command-line tools for managing schemas, generating documentation, and administering the system. This chapter documents these tools and their usage.

## Primary Command: wyseman

The main `wyseman` command-line tool is the core utility for schema management operations, written in Node.js.

### Basic Usage

```bash
wyseman [options] [files...]
```

### Configuration

Wyseman reads configuration from a `Wyseman.conf` file in JSON format, which can include:

```json
{
  "dbname": "myapp",
  "host": "localhost",
  "port": 5432,
  "user": "mydbuser",
  "dir": "./schema",
  "module": "mymodule",
  "specific_target": [
    "file1.wms",
    "file2.wmt"
  ]
}
```

The config file can include target names as keys with arrays of files to process for that target.

### Common Options

| Option | Description |
|--------|-------------|
| `-?`, `--help` | Display help information |
| `-n`, `--dbname=NAME` | Specify database name |
| `-h`, `--host=HOST` | Specify database host name (default: localhost) |
| `-P`, `--port=PORT` | Specify database port (default: 5432) |
| `-u`, `--user=USER` | Specify database user name (default: admin) |
| `-b`, `--branch=OBJECTS` | Include the specified object(s) and all others that depend on them |
| `-S`, `--schema=FILE` | Create a schema file with the specified filename |
| `-g`, `--migrate=CMD` | Enter a schema migration command (see [Versioning](versioning.md) section for detailed syntax) |
| `-R`, `--release=VER` | Specify the release number of the schema file to generate (default: "next") |
| `-C`, `--commit` | Commit official schema release in the default directory |
| `-r`, `--replace` | Replace views/functions where possible |
| `-m`, `--make` | Build any uninstantiated objects in the database (default: true) |
| `-p`, `--prune` | Remove any objects no longer in the source file(s) (default: true) |
| `-d`, `--drop` | Attempt to drop objects before creating (default: true) |
| `-z`, `--post` | Run the post-parse cleanup scans (default: true) |
| `-q`, `--quiet` | Suppress printing of database notices |
| `-l`, `--list` | List DB objects and their dependencies |
| `-s`, `--sql` | Output SQL to create a database |

### Example Commands

```bash
# Build all objects from schema files
wyseman schema/*.wm*

# Build with specific options
wyseman --make --replace schema/*.wm*

# Commit a new release
wyseman --release=1.2.0 --commit

# Add a migration for a table
wyseman --migrate="myschema.users add email 'text'"

# Generate a schema file
wyseman --schema=schema-1.0.json schema/*.wm*

# List database objects and dependencies
wyseman --list
```

## Node.js Utility Tools

Wyseman includes several Node.js-based utility tools for specific tasks:

### wyseman-info (info.js)

Displays information about the currently installed Wyseman package.

```bash
wyseman-info [path|name|version]
```

If no argument is provided, it displays the package path, name, and version. With specific arguments, it displays just that information.

### wm-csv2db

Imports language data from a CSV file into database tables.

```bash
wm-csv2db [options] file.csv
```

#### Options

- `-n`, `--dbname=NAME` - Database name
- `-h`, `--host=HOST` - Database host
- `-P`, `--port=PORT` - Database port
- `-u`, `--user=USER` - Database user
- `-q`, `--quiet` - Suppress database notices

The CSV file must contain columns: type, sch, tab, col, language, title, help. The tool supports importing multiple language strings for tables, columns, values, and messages.

#### Usage Example

A typical workflow for adding a new language translation:

```bash
# 1. Create a CSV file with columns: type, sch, tab, col, language, title, help
# 2. Import the translations into the database
wm-csv2db translations-spanish.csv

# 3. Verify the imported data in the database
# 4. Export the data to a Wyseman text file
wm-db2wmt -l spa -s myschema >language/myschema-spa.wmt

# 5. Include the WMT file in your schema build
```

### wm-db2wmt

Exports language data from the database to a Wyseman text (.wmt) file format.

```bash
wm-db2wmt [options] >output.wmt
```

#### Options

- `-n`, `--dbname=NAME` - Database name
- `-h`, `--host=HOST` - Database host
- `-P`, `--port=PORT` - Database port
- `-u`, `--user=USER` - Database user
- `-s`, `--schema=SCHEMA` - Export items belonging only to this schema
- `-v`, `--view=VIEW` - Export items only for the specified view (or table)
- `-l`, `--language=LANG` - Export items only for the specified language (default: eng)
- `-q`, `--quiet` - Suppress database notices

The output is written to stdout and should be redirected to a file. For a multi-language project, you'll typically create separate WMT files for each language and schema combination:

```bash
# Export English language strings for the 'myapp' schema
wm-db2wmt -s myapp -l eng >language/myapp-eng.wmt

# Export Spanish language strings for the 'myapp' schema
wm-db2wmt -s myapp -l spa >language/myapp-spa.wmt
```

## Shell Script Utilities

Wyseman includes several shell script utilities for database and schema management:

### wmdump

Creates a backup of the tables in a database.

```bash
wmdump [options] [workdir]
```

#### Options

- `-h`, `--host=HOST` - Database host
- `-u`, `--user=USER` - Database user
- `-p`, `--port=PORT` - Database port
- `-d`, `--dbname=NAME` - Database name

Unlike `pg_dump`, this tool is designed specifically for Wyseman-managed databases. It offers several advantages:

1. It focuses on backing up only user table data, not the full schema
2. It stores each table's data in a separate file, making selective restoration easier
3. It includes separate schema files for each table for reference
4. It records row counts for verification during restore

These features make it particularly useful for:
- Migrating specific tables between Wyseman deployments
- Backing up only user data while letting schema be rebuilt from source
- Selective table-by-table restoration

The tool stores data and schema information in the specified work directory (default: /var/tmp/wm_backup).

### wmrestore

Restores data to a database previously dumped using wmdump.

```bash
wmrestore [options] [workdir]
```

#### Options

- `-h`, `--host=HOST` - Database host
- `-u`, `--user=USER` - Database user
- `-p`, `--port=PORT` - Database port
- `-d`, `--dbname=NAME` - Database name

This tool restores data from the specified work directory (default: /var/tmp/wm_backup) into empty tables. Tables should be created from schema files before running this tool. The restoration process:

1. Identifies all tables in the current schema
2. For each table with a corresponding backup file:
   - Executes the data import SQL
   - Verifies row counts before and after restoration
   - Reports any discrepancies

This allows for consistent restoration while ensuring data integrity.

### Legacy Tools

The following tools are primarily for TCL-based components of Wyseman and are considered legacy utilities:

#### wmversion

Sets the package version in TCL files according to what is in the Makefile.

```bash
wmversion [lib] [version]
```

If no arguments are provided, it extracts the library name and version from the Makefile. It updates all TCL files that contain a "package provide" line for the specified library.

#### wmmkpkg

Creates a TCL package index file (pkgIndex.tcl) for Wyseman.

```bash
wmmkpkg [libname] [version] [source_dir]
```

This utility is used instead of `pkg_mkIndex` to:
- Define applib_library as the path to wherever the library is found
- Cause init.tcl to be loaded upon require
- Load other modules only when called
- Include procedures defined by means other than proc

## Environment Variables

Wyseman commands respect the following environment variables:

- `WYSEMAN_DB`: Default database name
- `WYSEMAN_HOST`: Default database host
- `WYSEMAN_PORT`: Default database port
- `WYSEMAN_USER`: Default database user

Additionally, standard PostgreSQL environment variables are also respected:

- `PGHOST`: PostgreSQL host
- `PGPORT`: PostgreSQL port
- `PGDATABASE`: PostgreSQL database name
- `PGUSER`: PostgreSQL user
- `PGPASSWORD`: PostgreSQL password

## Integration with Build Systems

Wyseman works well with Make for automating schema builds. A typical Makefile might include:

```makefile
WYSEMAN = wyseman --conf=Wyseman.conf
SCHEMA_FILES = $(wildcard schema/*.wm*)

.PHONY: schema
schema:
	$(WYSEMAN) $(SCHEMA_FILES)

.PHONY: release
release:
	$(WYSEMAN) --release=$(VERSION) --commit
```

For Node.js projects, you can add Wyseman commands to your package.json scripts:

```json
"scripts": {
  "build-schema": "wyseman schema/*.wm*",
  "release-schema": "wyseman --release=$npm_package_version --commit"
}
```

## Deprecated Tools

The following tools in the Wyseman package are considered deprecated:

1. **ticket** - For generating authentication tickets
   - It's recommended to use the WyCLIF version instead (`wyclif/bin/adminticket`)

2. **erd** - For entity-relationship diagrams
   - Legacy TCL interface that requires TCL/TK

3. **wysegi** - Graphical interface
   - Legacy TCL/TK interface

[Prev](command-reference.md) | [TOC](README.md) | [Next](versioning.md)
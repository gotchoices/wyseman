# Command Line Tools

[Prev](command-reference.md) | [TOC](README.md) | [Next](versioning.md)

Wyseman provides several command-line tools for managing schemas, generating documentation, and administering the system. This chapter documents these tools and their usage.

## Primary Command: wyseman

The main `wyseman` command-line tool is used for schema management operations.

### Basic Usage

```bash
wyseman [options] [files...]
```

### Common Options

| Option | Description |
|--------|-------------|
| `--help` | Display help information |
| `--version` | Display version information |
| `--conf=FILE` | Specify configuration file |
| `--database=NAME` | Specify database name |
| `--branch=NAME` | Specify branch to work on |
| `--prune` | Remove objects not in parsed files |
| `--release=VER` | Commit a new schema release |
| `-g "CMD"` | Execute a migration command |

### Build Targets

| Target | Description |
|--------|-------------|
| `--objects` | Build database objects |
| `--init` | Initialize tables with data |
| `--defs` | Build display definitions |
| `--text` | Build language strings |
| `--all` | Build all of the above |

### Example Commands

```bash
# Build all objects from schema files
wyseman --all schema/*.wm*

# Build only objects and initialization
wyseman --objects --init schema/*.wm*

# Commit a new release
wyseman --release=1.2.0

# Add a migration for a table
wyseman -g "myschema.users add email 'text'"
```

## Configuration

Wyseman reads configuration from a `Wyseman.conf` file, which can include:

```
# Database connection
host = localhost
port = 5432
database = myapp
user = mydbuser
password = mydbpassword

# Schema options
schema = public
```

## Additional Command Line Tools

Beyond the main `wyseman` command, the following tools are provided:

### erd

Generates entity-relationship diagrams for the schema.

```bash
erd [options] [schema_name]
```

### ticket

Generates authentication tickets for accessing the database through the Wyseman API.

```bash
ticket [options] [username]
```

### wmdump

Dumps a schema to a file for backup or migration.

```bash
wmdump [options] [database] [file]
```

### wmrestore

Restores a schema from a previously dumped file.

```bash
wmrestore [options] [file] [database]
```

### wm-csv2db

Imports CSV data into database tables.

```bash
wm-csv2db [options] [file] [table]
```

### wm-db2wmt

Exports database table content to a Wyseman text (.wmt) file.

```bash
wm-db2wmt [options] [table] [file]
```

### wyseman-info

Displays information about the current schema.

```bash
wyseman-info [options] [object_name]
```

### wysegi

A graphical interface for working with Wyseman schemas (if supported).

```bash
wysegi [options]
```

## Makefile Integration

Wyseman works well with Make for automating schema builds. A typical Makefile might include:

```makefile
WYSEMAN = wyseman --conf=Wyseman.conf
SCHEMA_FILES = $(wildcard schema/*.wm*)

.PHONY: schema
schema:
	$(WYSEMAN) --all $(SCHEMA_FILES)

.PHONY: release
release:
	$(WYSEMAN) --release=$(VERSION)
```

## Environment Variables

Wyseman commands respect standard PostgreSQL environment variables:

- `PGHOST`: PostgreSQL host
- `PGPORT`: PostgreSQL port
- `PGDATABASE`: PostgreSQL database name
- `PGUSER`: PostgreSQL user
- `PGPASSWORD`: PostgreSQL password

Additionally, Wyseman-specific variables include:

- `WYSEMAN_CONF`: Path to configuration file
- `WYSEMAN_SCHEMA`: Default schema to use

[Prev](command-reference.md) | [TOC](README.md) | [Next](versioning.md)
# Versioning System

[Prev](cli.md) | [TOC](README.md) | [Next](runtime.md)

Wyseman includes a comprehensive versioning system that allows database schemas to evolve over time while preserving data and maintaining compatibility with applications.

## Version Control Goals

The primary goals of Wyseman's versioning system are:

- Allow any implementation of a database at any version to be upgraded to any later version
- Track versions of individual database objects, not just the schema as a whole
- Preserve data when upgrading tables even if the structure changes
- Provide a clear history of schema changes over time
- Support modular schemas with multiple components and dependencies

## Core Implementation Components

Wyseman's versioning system consists of three main components:

1. **Schema Management**: Tracks objects, dependencies, and versions in the database
2. **Migration System**: Handles table structure changes while preserving data
3. **History Tracking**: Maintains records of past versions for seamless upgrades

### Key Files and Their Structure

Several files are critical to the versioning system:

#### 1. Wyseman.hist

JSON file tracking schema release history and archived objects. Structure:

```json
{
  "module": "module_name",
  "releases": [
    "2023-01-01T00:00:00Z",  // Release 1 timestamp
    "2023-02-01T00:00:00Z",  // Release 2 timestamp
    0                        // Current beta counter (increments with changes)
  ],
  "prev": [
    {
      "obj_typ": "table",
      "obj_nam": "schema.table",
      "obj_ver": 1,
      "module": "module_name",
      "min_rel": 1,
      "max_rel": 1,
      "deps": ["dependency1", "dependency2"],
      "delta": ["rename old_column new_column"],
      "grants": ["perm1", "perm2"],
      "create": "base64_encoded_create_sql",
      "drop": "base64_encoded_drop_sql"
    }
    // More historical objects...
  ],
  "arch": [
    {
      "boot": "base64_encoded_bootstrap_sql",
      "init": "base64_encoded_initialization_sql",
      "dict": "base64_encoded_dictionary_sql"
    },
    // One entry per release...
  ]
}
```

#### 2. Wyseman.delta

JSON file containing pending table migration operations:

```json
{
  "schema.table1": [
    "add column_name 'text not null' default_value",
    "rename old_column new_column"
  ],
  "schema.table2": [
    "drop unused_column"
  ]
}
```

#### 3. schema-N.json

Generated schema files containing the full schema definition for a specific release:

```json
{
  "hash": "sha256_hash_of_contents",
  "module": "module_name",
  "release": 2,
  "publish": "2023-02-01T00:00:00Z",
  "compress": true,
  "releases": [
    "2023-01-01T00:00:00Z",
    "2023-02-01T00:00:00Z"
  ],
  "boot": "base64_encoded_bootstrap_sql",
  "init": "base64_encoded_initialization_sql",
  "dict": "base64_encoded_dictionary_sql",
  "objects": [
    {
      "obj_typ": "table",
      "obj_nam": "schema.table",
      "obj_ver": 2,
      "module": "module_name",
      "min_rel": 2,
      "max_rel": 2,
      "deps": ["dependency1", "dependency2"],
      "delta": ["rename old_column new_column"],
      "grants": ["perm1", "perm2"],
      "create": "base64_encoded_create_sql",
      "drop": "base64_encoded_drop_sql"
    },
    // More current objects...
  ],
  "prev": [
    // Historical objects from prior releases...
  ]
}
```

## Object Versioning Model

Each database object is tracked with detailed metadata:

| Attribute | Description |
|-----------|-------------|
| `obj_typ` | Object type (table, view, function, etc.) |
| `obj_nam` | Fully qualified object name |
| `obj_ver` | Version number of this specific object |
| `module` | Module this object belongs to |
| `min_rel` | First schema release this object appears in |
| `max_rel` | Last schema release this object appears in |
| `deps` | Dependencies on other objects |
| `delta` | Migration operations for table structure changes |
| `grants` | Access permissions for the object |
| `crt_sql` | SQL to create the object |
| `drp_sql` | SQL to drop the object |

This versioning model allows Wyseman to reconstruct any prior version of the schema, track object dependencies, and handle upgrades gracefully.

## Schema Release Lifecycle

### Development Phase

During development, schemas evolve through these steps:

1. Developers modify schema definition files (`.wms`, `.wmt`, etc.)
2. When a table structure changes in a way that affects data, a migration operation is added
3. The `wyseman` tool processes these files and updates the database
4. All changes exist as a "beta" version in the schema tracking system
5. The beta counter increments with each change (visible in `Wyseman.hist`)

### Release Process

When a schema is ready for release:

1. Wyseman commits the schema with `wyseman --release=X.Y.Z --commit`
2. This action:
   - Updates the release information in the database
   - Creates a timestamp for the release in `Wyseman.hist`
   - Archives previous versions of objects that have changed
   - Clears any pending migrations in `Wyseman.delta`
   - Starts a new beta sequence for the next release

### Upgrade Process

When upgrading an existing database to a newer schema version:

1. Wyseman loads historical object information from `Wyseman.hist`
2. It compares the database's current version to the target version
3. For each table that has migrations:
   - The system executes the required `ALTER TABLE` commands in order
   - Changes are made within a transaction to ensure data integrity
4. Objects are then dropped and recreated in the proper dependency order
5. The version information is updated to reflect the new state

## Table Data Migration Process

Wyseman handles table structure changes differently from other database objects due to the need to preserve data. For non-table objects (like views and functions), the system can simply drop and recreate them. However, for tables, this would lead to data loss.

### How Table Migrations Work

When a table structure changes, Wyseman follows this process:

1. The developer modifies a table definition in a `.wms` file
2. The developer adds migration commands using the `--migrate` option, which are stored in `Wyseman.delta`
3. When rebuilding the schema, Wyseman:
   - Identifies tables that need to be rebuilt
   - Executes any pending migration commands from `delta` array before dropping the table
   - Dumps the table data to a temporary file
   - Drops the old table
   - Creates the new table structure
   - Attempts to restore the data from the temporary file
   - Verifies that the row count matches

All of this happens in a transaction, ensuring data integrity.

### Implementation Details

The migration process is implemented in two key functions in `bootstrap.sql`:

1. **wm.make()**: Handles rebuilding database objects, including tables with data preservation
2. **wm.migrate()**: Executes table alteration commands before recreating a table

When rebuilding a table that has data:
- Wyseman stores the table's column list and data in a temporary file
- It then applies migration operations (stored in `delta` array) to align the old structure with the new structure
- After these changes, it dumps the modified table data
- It then drops and recreates the table with the new definition
- Finally, it restores the data into the new table structure

This approach is critical because:
- Direct schema changes (like column renames) can't be detected automatically
- Simply dumping and restoring without migrations would fail if column names or types changed
- The migration system provides a way to teach Wyseman how to handle these changes

### Migration Operations

Wyseman supports these key migration operations via the `--migrate` (or `-g`) switch:

```bash
# Add a new column with a default value
wyseman -g "schema.table add column_name 'data_type [constraints]' default_value"

# Remove a column
wyseman -g "schema.table drop column_name"

# Rename a column
wyseman -g "schema.table rename old_column new_column"

# Update column values
wyseman -g "schema.table update column 'sql_expression'"
```

These operations are stored in the `Wyseman.delta` file until they are applied during a schema commit.

### Migration Workflow

A typical workflow for making schema changes might look like:

1. Modify a table definition in a `.wms` file to add, rename, or remove columns
2. Add the necessary migration commands:
   ```bash
   wyseman -g "myschema.users add email 'text not null' ''"
   ```
3. Build the schema to apply changes:
   ```bash
   wyseman myschema/*.wms
   ```
4. When ready, commit the changes as a new release:
   ```bash
   wyseman --release=1.2.0 --commit
   ```

### Viewing and Managing Migrations

The system provides commands to inspect and manage migrations:

```bash
# List pending migrations for a table
wyseman -g "schema.table list"

# Remove the last migration command
wyseman -g "schema.table pop"
```

## Technical Implementation

The versioning system is implemented through several key components:

1. **Schema.js**: Manages schema objects, their properties, and creating schema files
2. **Migrate.js**: Handles table structure migrations through the delta file
3. **History.js**: Maintains records of past schema versions and objects

The system creates JSON schema files with comprehensive information about all objects in a given release. These files contain:

- Bootstrap SQL to set up the core database structure
- Object definitions for all tables, views, functions, etc.
- Data dictionary information for language and display properties
- Initialization SQL for populating tables
- Complete historical records to support upgrades from prior versions

## Limitations and Future Enhancements

The current versioning system has some limitations:

1. **Complex Table Alterations**: While the system handles common operations like adding, removing, and renaming columns, more complex table alterations may require manual intervention. Examples include:
   
   - Splitting a column into multiple columns
   - Merging multiple columns into one
   - Changing a column's data type with complex data transformations
   - Adding complex constraints that require data manipulation

2. **Constraint Handling**: New constraints that existing data might violate can cause upgrade issues. The system doesn't automatically validate existing data against new constraints before applying changes.

3. **Performance with Large Tables**: For tables with large amounts of data, the process of dumping and restoring data during structure changes can be time-consuming.

4. **Limited Rollback Support**: While the system tracks historical objects, rolling back to a previous version can be complex and may require manual intervention.

5. **Manual Migration Commands**: The system requires developers to manually specify migration operations rather than automatically detecting them, which could lead to errors if not done correctly.

Future enhancements may address these limitations by:

- Supporting more complex table transformation operations
- Adding data validation tools to check constraints before migration
- Implementing more efficient data transformation methods
- Improving rollback capabilities
- Adding automated detection of schema changes

## Example: Complete Upgrade Workflow

Here's a comprehensive example of managing schema versions from initial creation through multiple upgrades:

```bash
# 1. Initial schema creation
wyseman schema/*.wm*
wyseman --release=1.0.0 --commit

# 2. Adding a new column with migration
wyseman -g "myapp.users add email 'text' ''"
wyseman schema/*.wm*
wyseman --release=1.1.0 --commit

# 3. Renaming a column
wyseman -g "myapp.products rename description product_desc"
wyseman schema/*.wm*
wyseman --release=1.2.0 --commit

# 4. Generate schema files for each version
wyseman --release=1.0.0 --schema=schema-1.0.0.json
wyseman --release=1.1.0 --schema=schema-1.1.0.json
wyseman --release=1.2.0 --schema=schema-1.2.0.json

# 5. Install a specific version on a new database
# (using a DbClient with the schema file option)
# or upgrade any existing database from any version to any later version
```

## Best Practices for Schema Versioning

1. **Plan for versioning from the start**: Design your schema with future changes in mind
2. **Use meaningful release numbers**: Follow semantic versioning principles
3. **Document migration operations**: Keep notes on why certain migrations were needed
4. **Test upgrades thoroughly**: Verify that upgrades work from each prior version
5. **Create regular schema backups**: Store schema files for each official release
6. **Make atomic changes**: Keep related changes together in the same release
7. **Validate data before constraints**: Check data compatibility before adding constraints
8. **Apply migration commands carefully**: The system depends on correct migration commands to properly handle table structure changes

[Prev](cli.md) | [TOC](README.md) | [Next](runtime.md)
# Versioning System

[Prev](cli.md) | [TOC](README.md) | [Next](runtime.md)

Wyseman includes a comprehensive versioning system that allows database schemas to evolve over time while preserving data and maintaining compatibility with applications.

## Version Control Goals

The primary goals of Wyseman's versioning system are:

- Allow any implementation of a database at any version to be upgraded to any later version
- Track versions of individual database objects, not just the schema as a whole
- Preserve data when upgrading tables even if the structure changes
- Provide a clear history of schema changes over time

## Implementation Details

### Version Tracking

Each database object is tracked with:

- **Object name**: The fully qualified name of the object
- **Object type**: Table, view, function, etc.
- **Object version**: A numeric version identifier
- **Dependencies**: Other objects this object depends on
- **First release**: Minimum release where this object exists
- **Last release**: Maximum release where this object exists
- **Content hash**: A hash of the object's definition for integrity checking

### History Files

Wyseman maintains a `Wyseman.hist` file in JSON format that contains:

```json
{
  "module": "Module_name",
  "releases": [
    "Release 1 publish date",
    "Release 2 publish date",
    0
  ],
  "past": [
    {"Object record 1"},
    {"Object record 2"}
  ]
}
```

This history file maintains a record of all objects from past releases, which allows upgrading from any previous version.

### Migration Delta Files

For tables that change structure, Wyseman uses a `Wyseman.delta` file to track migration operations:

```
mytable add new_column 'text not null' default_value
mytable drop old_column
mytable rename original_name new_name
```

These migration commands are applied in a transaction before dropping and recreating a table, ensuring that data is properly preserved.

## Upgrade Process

When upgrading a schema, Wyseman follows these steps:

1. Identify the current database version
2. Compare with the target version
3. Load all necessary historical objects and migration operations
4. Prepare a transaction that will:
   - Apply table migrations to preserve data
   - Drop objects in reverse dependency order
   - Create objects in proper dependency order
5. Execute the transaction
6. Update version information in the database

## Table Data Migration

Table migrations handle the following scenarios:

- **New Columns**: Added with default values to handle existing data
- **Dropped Columns**: Data is preserved before dropping if needed elsewhere
- **Renamed Columns**: Column is renamed before table recreation
- **Changed Constraints**: Data validation occurs before applying new constraints

## Example Migration Workflow

```bash
# Add a new column to a table
wyseman -g "myschema.mytable add email 'text' ''"

# Rename a column
wyseman -g "myschema.contacts rename phone mobile"

# List pending migrations
wyseman -g "myschema.mytable list"

# Commit a new schema release
wyseman --release=1.2.0
```

## Research Tasks

- [ ] Document the exact process of upgrading between versions
- [ ] Provide more detailed examples of migration operations
- [ ] Analyze limitations of the current migration system
- [ ] Document best practices for schema versioning

[Prev](cli.md) | [TOC](README.md) | [Next](runtime.md)
# Basic Concepts

[Prev](installation.md) | [TOC](README.md) | [Next](authoring.md)

This section covers the foundational concepts that make up the Wyseman architecture and philosophy.

## Schema as Source of Truth

One of Wyseman's key principles is that the schema definition files are the primary source of truth for the database structure, not the database itself. This means:

- Schema is authored and maintained in text files
- Changes to the schema are made in these files
- The database is derived from these files, not vice versa
- Version control systems can track schema changes effectively

This approach solves the common problem where database structure diverges from documentation or source control.

## Object-Oriented Schema

Wyseman treats database objects as discrete components with:

- **Identities**: Each object has a unique name and type
- **Dependencies**: Objects can depend on other objects
- **Versions**: Objects evolve over time with version tracking
- **Metadata**: Objects have associated descriptions and display properties

## Database Interaction Model

Wyseman interacts with the database in these key ways:

1. **Schema Building**: Deploying schema definitions from files to the database
2. **Schema Upgrading**: Migrating from one schema version to another
3. **Runtime Access**: Providing applications with access to the schema and data
4. **Data Dictionary**: Making metadata available to applications

## Schema Lifecycle

![Schema Lifecycle](schema_lifecycle.png)

The typical lifecycle of a schema in Wyseman is:

1. **Authoring**: Creating schema definition files (.wms, .wmt, .wmd, .wmi)
2. **Deployment**: Building the schema in the database
3. **Iteration**: Making changes to the schema files
4. **Maintenance**: Deploying changes and migrating data
5. **Versioning**: Creating releases of the schema

## Schema Components

A complete Wyseman schema consists of:

### Core Objects
- **Tables**: Store data with columns and constraints
- **Views**: Provide alternative ways to see the data
- **Functions**: Implement business logic in the database
- **Triggers**: React to changes in the database

### Metadata
- **Text/Language**: Human-readable descriptions in multiple languages
- **Display Properties**: How objects should be presented in UIs
- **Initialization**: Default data and setup scripts

## File-Based vs. Database-Based Schema

Wyseman maintains the schema in two places:

1. **File-Based**: The authoritative schema definition files
2. **Database-Based**: A cache of the schema in the database

The database contains a complete copy of the schema definition, which allows:
- The schema to rebuild itself
- Applications to query the schema at runtime
- Versioning and migration to work properly

## Data Dictionary

The data dictionary is a core component that:
- Stores metadata about all database objects
- Provides runtime access to object descriptions
- Supports multiple languages for text items
- Helps applications present data appropriately

## Research Tasks

- [ ] Create diagram of schema lifecycle
- [ ] Document how objects are stored in the database
- [ ] Analyze dependency resolution algorithm
- [ ] Document the data dictionary structure in detail

[Prev](installation.md) | [TOC](README.md) | [Next](authoring.md)
# Project History

[Prev](troubleshooting.md) | [TOC](README.md) | [Next](future.md)

## Origins and Evolution

Wyseman has evolved significantly since its inception, adapting to new technologies while maintaining its core philosophy of schema management.

## Initial Challenge

The Wyseman project originated from a common problem in database development: how to maintain the source definition of a database schema while allowing the schema to evolve over time. 

The traditional approach—editing SQL in text files during development and then using ALTER commands on live databases—led to several issues:
- Source files becoming obsolete as databases evolved
- Difficulty in testing the accuracy of schema definitions
- Challenges in recreating schemas for new environments
- Risk of losing referential integrity during changes

## First Implementation

The first attempt at solving these problems consisted of shell scripts and a syntactical convention for SQL files, which included:
- Specific sections for dropping objects
- Sections for creating objects
- Categorization by object type
- Use of m4 for pre-processing and macros

This approach allowed for:
- Dropping and recreating specific types of objects
- Creating more SQL from smaller source code
- Managing dependencies between source files

## TCL Implementation

The next iteration integrated with the WyattERP toolkit and added a data dictionary capability. This version used TCL for several reasons:
- Better scripting capabilities compared to m4
- TCL list constructs that effectively packaged SQL
- Ability to organize SQL into proper dependencies

This implementation provided:
- Quick creation of entire databases
- Simple automation via Makefiles
- Ability to parameterize schemas for different instances
- Safe operations on "living" databases by carefully handling dependencies

## Ruby and JavaScript Implementations

Fast-forward approximately 10 years, and Wyseman was updated with significant enhancements:
- Command line program reimplemented in Ruby
- Enhanced data dictionary 
- Schema version tracking for multiple releases
- Schema files cached in the database itself
- Implementation of Ruby runtime library
- Implementation of JavaScript runtime library

## Current Status

The current implementation of Wyseman continues to evolve, with JavaScript becoming the primary runtime API, Ruby being deprecated, and TCL maintained for legacy support.

The core philosophy remains consistent:
- Schema definitions live in text files, not in the database
- The database is derived from these files
- Changes to the schema involve updating the files and reapplying them
- Database objects are managed with their dependencies in mind

## Design Decisions

Several key design decisions have shaped Wyseman:

1. **Text Files as Source of Truth**: Giving developers more control over authoring content
2. **Pre-processing Capability**: Making schema definitions more concise and maintainable
3. **Dependency Management**: Ensuring objects are built and dropped in the correct order
4. **Data Preservation**: Safely upgrading schemas without losing data
5. **Versioning**: Tracking schema versions and migrations

## TCL as a Wrapper for SQL

A notable design choice was using TCL as a wrapper for SQL. As stated in the documentation: "TCL is the best wrapper I've found for SQL." TCL provided:
- Clean, readable syntax for defining SQL objects
- Powerful list handling capabilities
- Good integration with shell environments
- Ability to embed SQL naturally within the language

While newer implementations have moved to Ruby and JavaScript for runtime support, TCL remains integral to the schema definition files due to these advantages.

[Prev](troubleshooting.md) | [TOC](README.md) | [Next](future.md)
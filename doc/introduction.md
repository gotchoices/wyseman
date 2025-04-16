# Introduction to Wyseman

[Prev](README.md) | [TOC](README.md) | [Next](installation.md)

## What is Wyseman?

Wyseman is a database schema manager, part of the WyattERP application framework. It provides a comprehensive solution for authoring, managing, and versioning PostgreSQL database schemas. The name "Wyseman" comes from "WyattERP Schema Manager" and reflects its role in the WyattERP ecosystem.

## Components Overview

Wyseman consists of several key components:

- **Schema Authoring Tools**: TCL-wrapped SQL syntax for defining database objects with dependency tracking
- **Command Line Interface**: Tools for building and maintaining schemas
- **Runtime Libraries**: JavaScript (primary), Ruby (deprecated), and TCL (legacy) libraries for accessing the schema, including both client-side and server-side components
- **Data Dictionary**: Stores metadata about database objects for application use
- **Version Control System**: Manages schema versions and migrations between versions

## Key Features

- **Schema Definition**: Author schema definitions in a clear, maintainable format
- **Dependency Tracking**: Automatically handle rebuild dependencies between objects
- **Versioning**: Track schema versions and handle migrations between versions
- **Data Preservation**: Safely upgrade schemas without losing data
- **Language Support**: Multi-language support for table and column descriptions
- **Display Definitions**: Define how data should be presented in user interfaces
- **Live Database Updates**: Safely update a running database within a transaction
- **MVC Architecture Support**: Facilitates Model-View-Controller design in applications

## Relationship to WyattERP Suite

Wyseman is one component of the WyattERP framework, which includes:
- **[Wyseman](https://github.com/gotchoices/wyseman)**: Database schema management and access
- **[Wylib](https://github.com/gotchoices/wylib)**: Frontend components and utilities
- **[Wyselib](https://github.com/gotchoices/wyselib)**: Common schema components for basic business functionality
- **[Wyclif](https://github.com/gotchoices/wyclif)**: Control Layer InterFace, Common structures for a backend server

These components work together to provide a complete framework for building business applications with PostgreSQL backends.

## Possible Documentation Enhancements

- [ ] Analyze relationship between components in more detail
- [ ] Document specific integration points with other WyattERP components
- [ ] Create a visual diagram of the architecture

[Prev](README.md) | [TOC](README.md) | [Next](installation.md)
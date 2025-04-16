# Wyseman

<div align="center">
  <h3>WyattERP Schema Manager for PostgreSQL</h3>
  <p>Author and manage database schemas with versioning, migrations, and runtime metadata access</p>
</div>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#ecosystem">Ecosystem</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

## Overview

Wyseman is a PostgreSQL schema manager that allows you to author, version, and maintain database schemas while providing runtime access to schema metadata. It uses TCL-based syntax to define database objects with dependencies, making it easy to manage complex database structures.

## Key Features

- **Schema Authoring**: Define database objects using a clean, macro-enabled syntax
- **Dependency Tracking**: Automatically handle object dependencies during rebuilds
- **Versioning System**: Track schema versions and manage migrations between versions
- **Data Preservation**: Safely upgrade schemas without losing data
- **Runtime API**: Access schema metadata from JavaScript, Ruby, or TCL applications
- **Multilingual Support**: Define text descriptions in multiple languages
- **Display Properties**: Define UI presentation hints for tables and columns

## Installation

```bash
# Using npm
npm install -g wyseman

# From source
git clone https://github.com/gotchoices/wyseman.git
cd wyseman
npm install
npm link
```

## Quick Start

### 1. Create your schema files

```tcl
# schema.wms - Schema definition
schema myapp {}

table myapp.users {myapp} {
  id        serial primary key,
  username  text not null unique,
  email     text,
  active    boolean default true
}

# text.wmt - Language data
tabtext myapp.users {Users} {System users} {
  {id        {ID}       {Unique identifier}}
  {username  {Username} {Login name}}
  {email     {Email}    {Contact email address}}
  {active    {Active}   {Whether user account is active}}
} -language en
```

### 2. Build your schema

```bash
# Create database objects, language data, and display properties
wyseman --all schema/*.wm*
```

### 3. Access in your application

```javascript
const Wyseman = require('wyseman');
const wm = new Wyseman({database: 'myapp'});

// Get table metadata
wm.meta.table('myapp.users')
  .then(meta => console.log(meta));

// Get language data
wm.lang.table('myapp.users', 'en')
  .then(text => console.log(text));
```

## Documentation

Comprehensive documentation is available in the [doc/](./doc/) directory:

- [Introduction and Concepts](./doc/concepts.md)
- [Schema Authoring Guide](./doc/authoring.md)
- [Schema File Reference](./doc/schema-files.md)
- [Command Reference](./doc/command-reference.md)
- [Version Control System](./doc/versioning.md)
- [Full Documentation Index](./doc/README.md)

## Ecosystem

Wyseman is part of the WyattERP application framework:

- **[Wyseman](https://github.com/gotchoices/wyseman)**: Schema management
- **[Wylib](https://github.com/gotchoices/wylib)**: UI components
- **[Wyselib](https://github.com/gotchoices/wyselib)**: Reusable schema objects
- **[Wyclif](https://github.com/gotchoices/wyclif)**: Client interface framework

These components are used together in the [MyCHIPs](https://github.com/gotchoices/mychips) project, a digital value exchange system.

## Contributing

Contributions are welcome! See [Contributing Guidelines](./doc/contributing.md) for details on how to get involved.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Alternatives and Similar Tools

Wyseman offers a unique approach to schema management with its TCL-based definition syntax and tight integration with the WyattERP ecosystem. For different needs or preferences, you might also consider:

- [Flyway](https://flywaydb.org/): Version-controlled database migrations
- [Liquibase](https://www.liquibase.org/): Open-source database schema change management
- [Sqitch](https://sqitch.org/): Database change management with Git-like workflow
- [Alembic](https://alembic.sqlalchemy.org/): Database migration tool for SQLAlchemy (Python)
- [Knex.js](http://knexjs.org/#Migrations): JavaScript SQL query builder with migrations
- [Prisma Migrate](https://www.prisma.io/migrate): Modern database migration tool for Node.js

Wyseman is distinguished by its dependency tracking, table data preservation during migrations, and integrated metadata system for application use.

---

<div align="center">
  <sub>Built with ❤︎ by <a href="https://github.com/gotchoices">GotChoices</a>.</sub>
</div>
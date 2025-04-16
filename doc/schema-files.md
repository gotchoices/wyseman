# Schema File Reference

[Prev](authoring.md) | [TOC](README.md) | [Next](command-reference.md)

This reference provides an overview of the different file types used in the Wyseman ecosystem, explaining their purpose, format, and how they interact.

> **Note**: For a tutorial on writing schema files, see [Schema Authoring](authoring.md).  
> For a comprehensive command dictionary, see [Schema Command Reference](command-reference.md).

## File Types Overview

Wyseman uses the following file extensions. These extensions are purely conventional - the content of the files is what matters. The `.wms` and `.wmt` files both contain TCL commands and lists, while `.wmd` files use YAML format.

| Extension | Purpose | Building Target |
|-----------|---------|----------------|
| `.wms` | Schema definition | `objects` |
| `.wmt` | Text/language strings | `text` |
| `.wmd` | Display properties (YAML format) | `defs` |
| `.wmi` | Initialization scripts (executable) | `init` |

## WMS (Schema) Files

WMS files define database objects using TCL commands. Each command creates a specific type of database object.

### Schema Objects

#### `schema`
- **Syntax**: `schema name {dependencies} {} options...`
- **Required Parameters**:
  - `name`: Schema name
- **Optional Parameters**:
  - `-dependency`, `-dep`: List of dependencies
  - `-create`: Custom CREATE statement (default: `CREATE SCHEMA name`)
  - `-drop`: Custom DROP statement
  - `-grant`: Permission definitions

#### `table`
- **Syntax**: `table name {dependencies} {column_definitions} options...`
- **Required Parameters**:
  - `name`: Table name
  - `column_definitions`: Column definitions in PostgreSQL syntax
- **Optional Parameters**:
  - `-dependency`, `-dep`: List of dependencies
  - `-primary`, `-pkey`, `-key`: Primary key column(s)
  - `-unique`: Unique constraint column(s)
  - `-inherits`, `-inh`: Inheritance specification
  - `-create`: Custom CREATE statement
  - `-drop`: Custom DROP statement 
  - `-grant`: Permission definitions
  - `-post`: Post-creation SQL
  - `-text`: Table description

#### `view`
- **Syntax**: `view name {dependencies} {query} options...`
- **Required Parameters**:
  - `name`: View name
  - `query`: SELECT statement that defines the view
- **Optional Parameters**:
  - `-dependency`, `-dep`: List of dependencies
  - `-create`: Custom CREATE statement
  - `-drop`: Custom DROP statement
  - `-grant`: Permission definitions
  - `-text`: View description
  - `-native`: When true, generates EXECUTE INSTEAD OF trigger
  - `-primarykeys`: List of primary key columns for native views

#### `function`
- **Syntax**: `function name {dependencies} {definition} options...`
- **Required Parameters**:
  - `name`: Function name
  - `definition`: Function definition in PostgreSQL syntax
- **Optional Parameters**:
  - `-dependency`, `-dep`: List of dependencies
  - `-create`: Custom CREATE statement
  - `-drop`: Custom DROP statement
  - `-grant`: Permission definitions
  - `-replace`: When true, generates CREATE OR REPLACE

#### `sequence`
- **Syntax**: `sequence name {dependencies} options...`
- **Required Parameters**:
  - `name`: Sequence name
- **Optional Parameters**:
  - `-dependency`, `-dep`: List of dependencies
  - `-create`: Custom CREATE statement
  - `-drop`: Custom DROP statement
  - `-grant`: Permission definitions
  - `-increment`, `-inc`: Increment value
  - `-minvalue`, `-min`: Minimum value
  - `-maxvalue`, `-max`: Maximum value
  - `-start`: Start value
  - `-cache`: Cache size
  - `-cycle`: When true, allows cycling

#### `index`
- **Syntax**: `index name {dependencies} {definition} options...`
- **Required Parameters**:
  - `name`: Index name
  - `definition`: Index definition in PostgreSQL syntax
- **Optional Parameters**:
  - `-dependency`, `-dep`: List of dependencies
  - `-create`: Custom CREATE statement
  - `-drop`: Custom DROP statement
  - `-unique`: When true, creates a unique index
  - `-method`: Index method (btree, hash, gist, gin, etc.)
  - `-table`: Table name
  - `-columns`: Columns to index

#### `trigger`
- **Syntax**: `trigger name {dependencies} {definition} options...`
- **Required Parameters**:
  - `name`: Trigger name
  - `definition`: Trigger definition in PostgreSQL syntax
- **Optional Parameters**:
  - `-dependency`, `-dep`: List of dependencies
  - `-create`: Custom CREATE statement
  - `-drop`: Custom DROP statement
  - `-table`: Table name
  - `-when`: BEFORE, AFTER, or INSTEAD OF
  - `-event`: INSERT, UPDATE, DELETE, or TRUNCATE
  - `-foreach`: ROW or STATEMENT
  - `-function`: Function to execute

#### `rule`
- **Syntax**: `rule name {dependencies} {definition} options...`
- **Required Parameters**:
  - `name`: Rule name
  - `definition`: Rule definition in PostgreSQL syntax
- **Optional Parameters**:
  - `-dependency`, `-dep`: List of dependencies
  - `-create`: Custom CREATE statement
  - `-drop`: Custom DROP statement
  - `-table`: Table name
  - `-event`: INSERT, UPDATE, DELETE, or SELECT
  - `-condition`: WHERE condition
  - `-action`: INSTEAD or ALSO

#### `other`
- **Syntax**: `other name {dependencies} options...`
- **Required Parameters**:
  - `name`: Object name
  - `-create`: Custom CREATE statement
  - `-drop`: Custom DROP statement
- **Optional Parameters**:
  - `-dependency`, `-dep`: List of dependencies

### Organization Commands

#### `module`
- **Syntax**: `module name`
- **Required Parameters**:
  - `name`: Module name for subsequent objects

#### `require`
- **Syntax**: `require file_path`
- **Required Parameters**:
  - `file_path`: Path to another schema file to include

#### `define`
- **Syntax**: `define name {body}`
- **Required Parameters**:
  - `name`: Macro name
  - `body`: Macro definition

### Grant Syntax

- **Syntax**: `-grant {{group1 {permission1 permission2}} {group2 {permission3}}}`
- **Permissions**: 
  - `select` (s): Read access
  - `insert` (i): Insert new records
  - `update` (u): Modify existing records
  - `delete` (d): Remove records
  - `execute` (x): Execute functions
  - `trigger` (t): Execute triggers
  - `usage` (g): Use objects
  - `all` (a): All permissions

## WMT (Language) Files

WMT files define language strings for database objects.

### Language Commands

#### `tabtext`
- **Syntax**: `tabtext table_name {title} {help} field_definitions options...`
- **Required Parameters**:
  - `table_name`: Table name
  - `title`: Short table description
  - `help`: Longer help text
- **Optional Parameters**:
  - `-language`, `-lang`: Language code (default: en)
  - Field definitions:
    ```
    field_name {title} {help} {
      value1 {title1} {help1}
      value2 {title2} {help2}
    }
    ```

## WMD (Display) Files

WMD files define UI display properties. Wyseman supports two formats for WMD files:

1. **YAML Format**: Modern approach, identified by a `---` marker at the start
2. **TCL Format**: Legacy approach using the `tabdef` command

The parser automatically detects the format based on the file content and processes it accordingly.

### YAML Format

```yaml
---
schema.table_name:
  focus: field_name
  fields:
    - {col: column1, size: 30}
    - {col: column2, size: 40, spe: edw}
    - {col: column3, size: 10, input: combobox}
  display: [column1, column2, column3]
  sort: [column1]
  subviews: [related_view1, related_view2]
```

#### Table Properties

- `focus`: Default focus field
- `fields`: Array of field display definitions
- `display`: Array of columns to display in default view
- `sort`: Default sort order
- `subviews`: Related views
- `actions`: Custom actions

#### Field Properties

- `col`: Column name
- `size`: Display width
- `spe`, `special`: Special formatting (e.g., `edw` for editor window)
- `input`: Input widget type
- `just`, `justify`: Text justification
- `state`: Widget state

### TCL Format

```tcl
tabdef schema.table_name -focus field_name -f {
  {column1 ent 30 {1 1} {-just r}}
  {column2 txt 40 {2 1 2} {-spf edw}}
}
```

#### `tabdef` Command

- **Syntax**: `tabdef table_name options...`
- **Required Parameters**:
  - `table_name`: Table name
- **Optional Parameters**:
  - `-focus`, `-foc`: Default focus field
  - `-fields`, `-f`: Field display definitions
  - `-display`, `-d`: Display options
  - `-sort`, `-s`: Default sort field(s)
  - `-subviews`, `-sv`: Child views
  - `-actions`, `-a`: Custom actions

#### Widget Types
- `ent`: Text entry
- `txt`: Multi-line text
- `chk`: Checkbox
- `cmb`: Combobox
- `rad`: Radio buttons
- `lst`: List
- `mlb`: Multi-line browser
- `dat`: Date picker
- `tim`: Time picker
- `num`: Numeric entry

#### Widget Options
- `-just`: Justification (l, r, c)
- `-spf`: Special formatting
- `-state`: Widget state
- `-enum`: Enumerated values

## WMI (Init) Files

WMI files are executable shell scripts that generate SQL statements for initializing tables with data. They are run during the database initialization phase.

### Structure and Usage

- **File Format**: Executable shell scripts (with appropriate shebang line)
- **Execution**: When Wyseman processes a .wmi file, it executes the script and captures its output as SQL
- **Output**: Must generate valid SQL statements to stdout
- **Purpose**: Typically used to populate reference/lookup tables, set default values, or perform other initialization steps

### Example WMI File

```bash
#!/bin/bash
# Example initialization script

# Generate SQL statements to stdout
cat << EOT
-- Initialize currency table
INSERT INTO schema.currency (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£');

-- Set default configuration
INSERT INTO schema.settings (key, value) VALUES
  ('default_currency', 'USD'),
  ('timezone', 'UTC');
EOT
```

### Capabilities

- Can use any shell commands or programming logic to generate SQL dynamically
- Can read from external files to populate tables
- Can check environment variables to customize initialization
- Commonly used for:
  - Loading reference data
  - Creating default records
  - Setting up initial system state
  - Running complex data transformations

[Prev](authoring.md) | [TOC](README.md) | [Next](command-reference.md)
# Schema Command Reference

[Prev](schema-files.md) | [TOC](README.md) | [Next](cli.md)

This is a comprehensive dictionary of all commands available in Wyseman schema files, providing detailed information about syntax, parameters, and options for each command.

> **Note**: For a tutorial on writing schema files, see [Schema Authoring](authoring.md).  
> For an overview of schema file types, see [Schema File Reference](schema-files.md).

## Object Definition Commands

| Command | Purpose | Required Parameters | Optional Parameters | Default Values |
|---------|---------|---------------------|---------------------|---------------|
| `table` | Define a database table | `name`, column definitions | `dependencies`, `-primary`/`-pkey`/`-key`, `-unique`, `-inherits`/`-inh`, `-create`, `-drop`, `-grant`, `-text`, `-post` | drop = "drop table if exists name" |
| `view` | Define a database view | `name`, SELECT query | `dependencies`, `-create`, `-drop`, `-grant`, `-text`, `-native`, `-primarykeys` | drop = "drop view if exists name" |
| `function` | Define a stored function | `name(params)`, function body | `dependencies`, `-create`, `-drop`, `-grant`, `-replace` | drop = "drop function if exists name" |
| `sequence` | Define a sequence | `name` | `dependencies`, `-create`, `-drop`, `-grant`, `-increment`/`-inc`, `-minvalue`/`-min`, `-maxvalue`/`-max`, `-start`, `-cache`, `-cycle` | drop = "drop sequence if exists name" |
| `index` | Define an index | `name`, definition | `dependencies`, `-create`, `-drop`, `-unique`, `-method`, `-table`, `-columns` | name = auto-generated based on table and columns |
| `trigger` | Define a trigger | `name`, trigger definition | `dependencies`, `-create`, `-drop`, `-table`, `-when`, `-event`, `-foreach`, `-function` | drop = "drop trigger if exists name on table" |
| `rule` | Define a rule | `name`, rule definition | `dependencies`, `-create`, `-drop`, `-table`, `-event`, `-condition`, `-action` | drop = "drop rule if exists name on table" |
| `schema` | Define a schema | `name` | `dependencies`, `-create`, `-drop`, `-grant` | drop = "drop schema if exists name" |
| `other` | Define any other object | `name`, `-create`, `-drop` | `dependencies` | none (explicit create/drop required) |

## Documentation Commands

| Command | Purpose | Required Parameters | Optional Parameters | Default Values |
|---------|---------|---------------------|---------------------|---------------|
| `tabtext` | Define text descriptions | table name, title | help text, column definitions, `-language` | language = "eng" |
| `tabdef` | Define display properties | table name | `-focus`, `-f` (fields), `-display`, `-sort`, `-subviews`, `-actions` | none |

## Organization Commands

| Command | Purpose | Parameters | Default Values |
|---------|---------|------------|---------------|
| `module` | Set the module name | module name | file rootname if none specified |
| `require` | Include another schema file | file path(s) | none |
| `define` | Define a macro | name, body | none |

## Permission Command

| Command | Purpose | Parameters | Default Values |
|---------|---------|------------|---------------|
| `grant` | Define permissions | group name, object permissions list | table/view: select; function: execute; schema: usage |

### Permission Syntax

```tcl
-grant {
  {group1 {permission1 permission2 ...}}
  {group2 {permission3 ...}}
}
```

### Available Permissions

| Permission | Abbreviation | Description |
|------------|--------------|-------------|
| `select` | `s` | Read access to tables/views |
| `insert` | `i` | Insert new records |
| `update` | `u` | Modify existing records |
| `delete` | `d` | Remove records |
| `execute` | `x` | Execute functions |
| `trigger` | `t` | Execute triggers |
| `usage` | `g` | Use objects (schemas, etc.) |
| `all` | `a` | All permissions |

**Note**: Permission names can be abbreviated to any unique prefix (e.g., 'sel' for 'select').

## TCL Evaluation Macros

| Macro | Purpose | Syntax | Example |
|-------|---------|--------|---------|
| `eval()` | Execute TCL code | `eval(tcl_code)` | `default eval(expr {rand() > 0.5})` |
| `expr()` | Evaluate TCL expression | `expr(expression)` | `limit expr(1000 * 3.5)` |
| `subst()` | Perform TCL substitution | `subst(text)` | `default subst('$variable')` |

## Display Definition Formats

### Traditional TCL Format (tabdef)

```tcl
tabdef table_name -focus column_name -f {
  {column1 ent 30 {1 1} {-just r}}
  {column2 txt 40 {2 1 2} {-spf edw}}
} -display {col1 col2} -sort {col1}
```

### YAML Format

Alternatively, you can define display properties using YAML format:

```yaml
---
schema.table_name:
  focus: field_name
  fields:
    - {col: column1, size: 30}
    - {col: column2, size: 40, spe: edw}
  display: [column1, column2]
  sort: [column1]
```

**Note**: YAML format is identified by a `---` marker at the beginning of the file and is the recommended approach for new display definitions.

## WMI Files (Initialization Scripts)

WMI files are executable shell scripts that generate SQL statements for database initialization:

```bash
#!/bin/bash
# Generate SQL to stdout
cat << EOT
-- SQL statements for initialization
INSERT INTO schema.table (column) VALUES ('value');
EOT
```

**Note**: WMI files must be executable and return valid SQL to stdout.

## Command Parameter Formats

### Table Command
```tcl
table name {dependencies} {
  column_definitions
} -primary {key_columns} -grant {...} -text {...}
```

### View Command
```tcl
view name {dependencies} {
  SELECT_query
} -native {...} -primarykeys {...} -grant {...} -text {...}
```

### Function Command
```tcl
function name {dependencies} {
  function_definition
} -grant {...}
```

### Tabtext Command
```tcl
tabtext table_name {title} {help} {
  {column title help}
  {column title help {value title help}}
} -language code
```

### Grant Command
```tcl
grant group_name {
  {object {perm_level1} {perm_level2}}
}
```

## Common Switches

| Switch | Usage | Valid For | Values |
|--------|-------|-----------|--------|
| `-dependency`, `-dep` | Define dependencies | all objects | List of object names |
| `-create` | Custom CREATE statement | all objects | SQL CREATE statement |
| `-drop` | Custom DROP statement | all objects | SQL DROP statement |
| `-grant` | Set permissions | table, view, function, schema, sequence | `{{group {perms1} {perms2}}}` |
| `-text` | Add description | table, view | Text description |
| `-primary`, `-pkey`, `-key` | Set primary key | table | List of column names |
| `-unique` | Define unique constraint | table, index | List of column names |
| `-inherits`, `-inh` | Set inheritance | table | Parent table name |
| `-post` | Post-creation SQL | table | SQL statements |
| `-native` | Set native formatting | view | `{column native [mapped_column]}` |
| `-primarykeys` | Set primary key | view | `{column1 column2 ...}` |
| `-increment`, `-inc` | Set increment value | sequence | Numeric value |
| `-minvalue`, `-min` | Set minimum value | sequence | Numeric value |
| `-maxvalue`, `-max` | Set maximum value | sequence | Numeric value |
| `-start` | Set start value | sequence | Numeric value |
| `-cache` | Set cache size | sequence | Numeric value |
| `-cycle` | Enable cycling | sequence | Boolean value |
| `-method` | Set index method | index | btree, hash, gist, gin, etc. |
| `-table` | Set table name | index, trigger, rule | Table name |
| `-columns` | Set index columns | index | List of column names |
| `-when` | Set trigger timing | trigger | BEFORE, AFTER, INSTEAD OF |
| `-event` | Set trigger event | trigger, rule | INSERT, UPDATE, DELETE, TRUNCATE |
| `-foreach` | Set trigger scope | trigger | ROW, STATEMENT |
| `-function` | Set trigger function | trigger | Function name |
| `-condition` | Set rule condition | rule | WHERE condition |
| `-action` | Set rule action | rule | INSTEAD, ALSO |
| `-language`, `-lang` | Set text language | tabtext | Language code (e.g., "en", "es") |
| `-focus`, `-foc` | Set default focus | tabdef | Column name |
| `-fields`, `-f` | Define field display | tabdef | Field definitions |
| `-display`, `-d` | Set displayed fields | tabdef | List of column names |
| `-sort`, `-s` | Set sort order | tabdef | List of column names |
| `-subviews`, `-sv` | Define subviews | tabdef | List of view names |
| `-actions`, `-a` | Define custom actions | tabdef | Action definitions |

[Prev](schema-files.md) | [TOC](README.md) | [Next](cli.md)
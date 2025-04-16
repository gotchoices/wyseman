# Schema Authoring

[Prev](concepts.md) | [TOC](README.md) | [Next](schema-files.md)

This chapter provides a tutorial on how to author schema definition files in Wyseman. It focuses on practical guidance and examples to help you get started with writing schema files.

> **Note**: For a complete reference of file types, see [Schema File Reference](schema-files.md).  
> For a comprehensive command dictionary, see [Schema Command Reference](command-reference.md).

## TCL Basics

Wyseman uses TCL (Tool Command Language) as its schema definition language. Here's a brief overview of TCL syntax:

### Basic TCL Syntax

1. **Commands**: The basic structure is `command arg1 arg2 arg3...`
2. **Lists**: Enclosed in braces `{item1 item2 item3}` or with quotes for simple items
3. **Variables**: Preceded with `$` (e.g., `$variable_name`)
4. **Comments**: Start with `#` and continue to the end of the line
5. **Command substitution**: Enclosed in square brackets `[command]`

### Quoting in TCL

TCL has several quoting mechanisms:
- **Braces** `{}`: No substitution occurs inside braces
- **Double quotes** `""`: Variables and command substitutions are processed
- **Backslash** `\`: Escapes special characters (e.g., `\n` for newline)

For more details on TCL, refer to the [official TCL tutorial](https://www.tcl-lang.org/man/tcl8.5/tutorial/tcltutorial.html).

## TCL Dynamic Lists

Wyseman schema files leverage TCL's dynamic list capabilities for flexible and concise schema definitions. The concept of "dynamic lists" is fundamental to understanding how to write Wyseman schema files.

### Dynamic List Structure

A dynamic list in Wyseman consists of:

1. **Positional parameters**: Values that appear in a specific order without explicit labels
2. **Switched parameters**: Key-value pairs where the key is prefixed with a dash `-`

In Wyseman, all parameters are fundamentally switched parameters, but certain commonly used parameters can be provided without their switches (in a specific order) for conciseness. This means:

- **Parameters can be provided in any order** if you explicitly include the switch name
- **Switch names can be abbreviated** to any unique prefix (e.g., `-dep` instead of `-dependency`)
- Parameters without switches become positional and must appear in the correct order

For example, in a table definition:

```tcl
table mytable {dependency1 dependency2} {
  column1 type1,
  column2 type2
} -grant {...} -primary {key1 key2}
```

Here:
- `mytable` is the first positional parameter (the table name)
- `{dependency1 dependency2}` is the second positional parameter (the dependency list)
- `{column1 type1, column2 type2}` is the third positional parameter (column definitions)
- `-grant {...}` and `-primary {key1 key2}` are switched parameters

### Parameter Rules

1. **Positional parameters** must appear in the correct order and cannot be omitted.
2. **Switched parameters** can appear in any order and are optional.
3. **Each object type** has its own set of valid positional and switched parameters.
4. The **context** determines which values need switches and which don't.

### Benefits of Dynamic Lists

This approach allows:
- Concise, readable schema definitions
- Flexible ordering of optional parameters
- Complex nested structures
- Schema files that closely resemble the actual SQL they generate

## Parsing Process

When Wyseman processes schema files, it:

1. Uses a TCL interpreter to read and parse the file
2. Processes each object definition and tracks dependencies
3. Generates SQL commands for database operations
4. Applies these commands to the database in the correct order

### Object Modification Process

When modifying existing objects, Wyseman follows a careful process to preserve data integrity:

1. **General process for all objects**:
   - The object and all its dependencies are identified
   - Dependencies are processed in the correct order (from least dependent to most dependent)
   - Each object and its dependencies are dropped
   - Objects are then rebuilt in reverse dependency order
   - All operations happen within a single transaction to ensure atomicity

2. **Special handling for tables**:
   - For any tables involved in the process, content is automatically saved to temporary storage
   - After the tables are rebuilt with the new schema, data is restored from temporary storage
   - This can involve multiple tables if they are part of the dependency chain

This unified approach allows schema changes to be applied to running databases with minimal disruption and without data loss, regardless of the object types involved in the modification.

## Schema File Keywords

Wyseman schema files support the following primary keywords (commands):

### Object Definition Keywords

| Keyword | Description | Required Parameters | Optional Parameters |
|---------|-------------|---------------------|---------------------|
| `table` | Define a database table | name, columns | dependency, create, drop, grant, text |
| `view` | Define a database view | name, query | dependency, create, drop, grant, text, native, primarykeys |
| `function` | Define a stored function | name, body | dependency, create, drop, grant |
| `sequence` | Define a sequence | name | dependency, create, drop, grant |
| `index` | Define an index | name | dependency, create, drop |
| `trigger` | Define a trigger | name | dependency, create, drop |
| `rule` | Define a rule | name | dependency, create, drop |
| `schema` | Define a schema | name | dependency, create, drop |
| `other` | Define any other database object | name, create, drop | dependency |

### SQL Syntax Generation

Each object type automatically generates the appropriate SQL syntax, saving you from having to write repetitive SQL boilerplate:

| Object Type | SQL Generation Behavior |
|-------------|-------------------------|
| `table` | Automatically adds `CREATE TABLE` syntax and handles column definitions. You only need to provide the column names, types, and constraints. |
| `view` | Adds `CREATE VIEW` or `CREATE OR REPLACE VIEW`, so you only provide the SELECT statement. |
| `function` | Adds `CREATE FUNCTION` syntax with appropriate parameter handling. You specify parameters, return type, and function body. |
| `sequence` | Generates complete `CREATE SEQUENCE` syntax. |
| `index` | Adds `CREATE INDEX` with appropriate table reference. |
| `trigger` | Generates `CREATE TRIGGER` with all necessary syntax. |
| `rule` | Wraps your rule definition in proper `CREATE RULE` syntax. |
| `schema` | Simply adds `CREATE SCHEMA` for the given name. |
| `other` | Provides no syntax help - you must supply the full SQL statements. |

This automatic SQL generation makes schema definitions much more concise while ensuring they follow PostgreSQL standards.

### Documentation Keywords

| Keyword | Description | Required Parameters | Optional Parameters |
|---------|-------------|---------------------|---------------------|
| `tabtext` | Define text descriptions for a table | table name, title | help, fields, language |
| `tabdef` | Define display properties for a table | table name | focus, fields, display, sort, subviews, actions |

### Organization Keywords

| Keyword | Description | Parameters |
|---------|-------------|------------|
| `module` | Define the module name for subsequent objects | module name |
| `require` | Include another schema file | file path |
| `define` | Define a macro for code reuse | name, body |

### Permission Keywords

| Keyword | Description | Parameters |
|---------|-------------|------------|
| `grant` | Define permissions for database objects | group, permissions list |

### Grant Syntax Details

The `-grant` parameter allows you to define access permissions for database objects. The syntax is:

```tcl
-grant {
  {group1 {permission1 permission2 ...}}
  {group2 {permission1 permission2 ...}}
  ...
}
```

Where:
- Each entry is a list containing a group name and a list of permissions
- Groups can be specific PostgreSQL roles/users or predefined groups like 'public'
- Permissions include: 'select', 'insert', 'update', 'delete', 'execute', 'trigger', 'usage', 'all'
- Unique abbreviations of permission names are allowed (e.g., 'sel' for 'select', 'ins' for 'insert')

#### Examples:

Basic table grants:
```tcl
table myschema.users {myschema} {
  id serial primary key,
  username text not null
} -grant {
  {public {select}}
  {admin {select insert update delete}}
}
```

Function grants:
```tcl
function myschema.calculate_total {myschema} {
  (user_id int)
  RETURNS numeric AS $$
    SELECT SUM(amount) FROM transactions WHERE user_id = $1;
  $$ LANGUAGE SQL
} -grant {
  {public {execute}}
}
```

Schema grants:
```tcl
schema myschema {} {
} -grant {
  {public {usage}}
}
```

You can also use variables to define reusable grant patterns:
```tcl
set std_access {
  {public {select}}
  {staff {select insert update}}
  {admin {all}}
}

table myschema.customers {myschema} {
  id serial primary key,
  name text not null
} -grant $std_access
```

These grant definitions are translated into appropriate PostgreSQL `GRANT` statements during schema application.

## Common Structure

Most object definitions follow this pattern:

```tcl
keyword name {dependencies} {
  definition_body
} -options...
```

## Example: Table Definition

```tcl
table myschema.mytable {myschema} {
  id        serial primary key,
  name      text not null,
  created   timestamp default now(),
  active    boolean default true
} -grant {
  {public {select}}
  {staff {select insert update}}
}
```

## Example: View Definition

```tcl
view myschema.myview {myschema.mytable} {
  SELECT id, name, created
  FROM myschema.mytable
  WHERE active = true
} -grant {
  {public {select}}
}
```

## TCL Macros and Preprocessing

### Custom Macros

Wyseman allows you to define custom macros using the `define` keyword:

```tcl
define standard_audit {
  created_at timestamp default now(),
  updated_at timestamp default now(),
  created_by text,
  updated_by text
}

table myschema.users {myschema} {
  id    serial primary key,
  name  text not null,
  email text unique,
  standard_audit()
}
```

The parser will expand `standard_audit()` to include the four columns defined in the macro.

### TCL Code Evaluation Within SQL

Wyseman provides powerful capabilities to execute TCL code directly within SQL statements using the following special macros:

#### eval() - Execute TCL Code

The `eval()` macro allows you to embed and execute arbitrary TCL code directly within your SQL:

```tcl
table myschema.regions {myschema} {
  id     serial primary key,
  active boolean default eval(expr {rand() > 0.5})
  # ... other columns
}
```

In this example, the `eval()` macro executes the TCL code, randomly setting the default value for `active` to either true or false.

#### expr() - Evaluate TCL Expressions

The `expr()` macro specifically evaluates TCL expressions, which is useful for calculations:

```tcl
function myschema.calculate_tax {myschema.tax_rates} {
  # ... function parameters and return type
  AS $$
    SELECT amount * rate FROM ...
  $$
  -- Set a limit of expr(1000 * 3.5) to the results
}
```

In this example, `expr(1000 * 3.5)` will be evaluated by TCL and replaced with `3500` in the resulting SQL.

#### subst() - Perform TCL Substitution

The `subst()` macro performs TCL variable and command substitution within the provided text:

```tcl
set table_prefix "inventory"
set item_types {{"Electronics" "E"} {"Books" "B"} {"Clothing" "C"}}

table myschema.${table_prefix}_categories {myschema} {
  # ... primary key and other columns
  types text[] default subst('{[join [lmap type $item_types {lindex $type 1}] ","]}')
}
```

This would expand the `types` default value to `'{E,B,C}'` by joining the second element of each item in the `$item_types` list.

### Important Notes on TCL Evaluation

1. **Security**: Be careful when using these macros, as they execute arbitrary TCL code during schema parsing.
2. **Context**: The code is executed in the TCL interpreter context, not in the database.
3. **Complex Logic**: You can use these macros for complex transformations that would be difficult to express in SQL alone.
4. **Debugging**: Use `puts` statements within the macros to debug complex TCL code during schema parsing.

## Special Parameters

### Dependencies

Dependencies are specified as a list in braces after the object name:

```tcl
table myschema.orders {myschema.customers myschema.products} {
  id          serial primary key,
  customer_id int references myschema.customers(id),
  product_id  int references myschema.products(id),
  quantity    int not null,
  order_date  date default now()
}
```

This tells Wyseman that the `orders` table depends on both the `customers` and `products` tables.

### Grants

Permissions are specified with the `-grant` parameter:

```tcl
-grant {
  {public {select}}
  {staff {select insert update}}
  {admin {select insert update delete}}
}
```

Each entry in the grant list contains a group name followed by the permissions to grant at different levels.

## Additional Schema File Types

In addition to `.wms` files for schema definitions, Wyseman uses several other file types for complete database schema management.

### WMD (Display) Files

WMD files define UI display properties for database objects. Wyseman supports two formats:

#### YAML Format (Recommended)

```yaml
---
schema.table_name:
  focus: field_name
  fields:
    - {col: column1, size: 30}
    - {col: column2, size: 40, spe: edw}
  display: [column1, column2]
```

#### TCL Format (Legacy)

```tcl
tabdef schema.table_name -focus field_name -f {
  {column1 ent 30 {1 1} {-just r}}
  {column2 txt 40 {2 1 2} {-spf edw}}
}
```

### WMI (Init) Files

WMI files are executable shell scripts that generate SQL for initializing database content:

```bash
#!/bin/bash
# Example initialization script

cat << EOT
-- Initialize reference data
INSERT INTO schema.my_table (id, name) VALUES
  (1, 'Default'),
  (2, 'Option A'),
  (3, 'Option B');
EOT
```

### WMT (Language) Files

WMT files define language strings for tables, columns, and values:

```tcl
tabtext schema.my_table {Table Title} {Table help text} {
  column1 {Column Title} {Column help text}
  column2 {Another Title} {More help text} {
    value1 {Value Title} {Value help text}
    value2 {Value Title} {Value help text}
  }
} -language en
```

## Research Tasks

- [ ] Document all macro processing capabilities
- [ ] Provide more examples of complex schema definitions
- [ ] Document object-specific parameters in detail
- [ ] Create a reference of switches and options for each object type

[Prev](concepts.md) | [TOC](README.md) | [Next](schema-files.md)
# Troubleshooting Wyseman

This guide provides solutions to common issues encountered when working with Wyseman. It's organized by the most common categories of problems you might face.

## Installation and Configuration Problems

### Missing Dependencies

**Symptoms**: Errors during installation or startup like "module not found" or "command not found"

**Solutions**:
- Verify Node.js installation with `node --version` (should be v10.0.0 or later)
- Check PostgreSQL installation with `psql --version` 
- Verify TCL installation with `tclsh`
- Ensure PostgreSQL and TCL are in your PATH

**Example Error**: `Error: Cannot find module 'pg'`  
**Fix**: Run `npm install pg pg-format` in your project directory

### Configuration Errors

**Symptoms**: Wyseman fails to connect or reports missing configuration

**Solutions**:
- Check for a valid `Wyseman.conf` file in project root
- Verify database credentials are correct
- Ensure the database user has appropriate permissions
- Check for any schema path issues

**Example Error**: `Error validating user: admin, token, error`  
**Fix**: Verify user credentials and configuration in Wyseman.conf

### Web Crypto API Issues

**Symptoms**: Error message about missing webcrypto.subtle library

**Solutions**:
- Make sure you're using a Node.js version that supports the Web Crypto API
- If running in a browser context, ensure you're using HTTPS (required for Web Crypto API)

**Example Error**: `Can't find webcrypt.subtle library`  
**Fix**: Update to a newer version of Node.js with Web Crypto API support

## Database Connection Issues

### Connection Failures

**Symptoms**: Errors like "connection refused" or "authentication failed"

**Solutions**:
- Verify PostgreSQL is running (`pg_isready`)
- Check database credentials in your configuration
- Ensure the database exists and is accessible
- Check network connectivity and firewall settings

**Example Error**: `Error: database "wyseman_test" does not exist`  
**Fix**: Create the database with `createdb wyseman_test`

### Connection Timeouts

**Symptoms**: Operation hangs or times out during database operations

**Solutions**:
- Check network connectivity between application and database
- Verify PostgreSQL server is running and not overloaded
- Check for connection pool exhaustion

**Example Error**: `DB connection error: timeout expired`  
**Fix**: Adjust connection timeout settings or investigate database performance issues

### PostgreSQL Restart Recovery

**Symptoms**: Connection drops during normal operation

**Solutions**:
- Implement robust reconnection logic in your application
- Check PostgreSQL logs for restart or maintenance operations
- Consider using connection pooling

**Example from Code**:
```javascript
// From dbclient.js
this.client.on('error', err => {
  this.log.trace("Unexpected error from database:", err.message)
  this.disconnect()                   // Is there a way to recover from this?
})
```

## Schema Management Issues

### Schema Building Errors

**Symptoms**: Errors during schema compilation or database object creation

**Solutions**:
- Check for syntax errors in schema files
- Verify all dependencies are properly defined
- Ensure your PostgreSQL version supports all features used

**Example Error**: `In schema (schema.json): syntax error at or near "with"`  
**Fix**: Correct the SQL syntax error in your schema definition

### Migration Problems

**Symptoms**: Errors during schema upgrades or data migration

**Solutions**:
- Check for constraints that prevent migration
- Verify delta operations are correctly defined
- Ensure database is in the expected state for migration

**Example Error**: `Can't update a development database: 1 2`  
**Fix**: Commit the current development state before updating

### Orphaned Objects

**Symptoms**: Database objects remain after they should be removed

**Solutions**:
- Use `wyseman check` to identify orphaned objects
- Manually drop objects if necessary
- Ensure correct dependency tracking in schema files

**Example Issue**: Objects remain in database after removal from schema definition  
**Fix**: Run `wyseman rebuild` to fully rebuild the schema

## Runtime API Issues

### Query Format Errors

**Symptoms**: Errors like "invalid where clause" or "invalid operator"

**Solutions**:
- Check JSON query format, especially the where clause structure
- Verify field names exist in the database
- Ensure operators are supported

**Example Error**: `empty where clause`  
**Fix**: Provide a valid where clause in your query:
```javascript
// Correct format
{where: {field: 'value'}}
// or
{where: [['field', '=', 'value']]}
```

### Field Type Errors

**Symptoms**: Issues with field data types, especially with JSON or binary data

**Solutions**:
- Ensure JSON is properly stringified for JSON/JSONB fields
- Use correct format for binary data (Buffer objects)
- Verify field types match schema definition

**Example Error**: `invalid input syntax for type json`  
**Fix**: Properly format JSON data:
```javascript
// From handler.js
let fVal = (type == 'jsonb' || type == 'json')
  ? JSON.stringify(fields[fld]) 
  : fields[fld]
```

### Metadata Cache Issues

**Symptoms**: Errors about missing metadata or incorrect column information

**Solutions**:
- Clear metadata cache and let it rebuild
- Verify database objects exist and are accessible
- Check for schema changes that weren't properly applied

**Example from Code**:
```javascript
// Using metadata cache refresh
LangCache.refresh(msg.language, view, msg.data)
MetaCache.refresh(view, msg.data)
```

## Authentication and Security Issues

### Token Authentication Problems

**Symptoms**: Authentication failures with error messages about invalid tokens

**Solutions**:
- Check token expiration dates
- Verify token is being correctly passed to server
- Ensure public key is correctly formatted

**Example Error**: `Invalid Login`  
**Fix**: Generate a new connection token with `wyclif/bin/admticket`

### Signature Validation Failures

**Symptoms**: Authentication failures with signed messages

**Solutions**:
- Check time synchronization between client and server
- Verify signature generation and verification methods
- Check key format and import process

**Example Error**: `Error validating signature`  
**Fix**: Verify your system time is correct and regenerate keys if necessary

### Origin Validation Issues

**Symptoms**: Connection refused with CORS errors

**Solutions**:
- Ensure origin header is properly set in client requests
- Configure server to accept connections from your client origin
- Check WebSocket protocol (ws vs wss) matches your security requirements

**Example from Code**:
```javascript
// From wyseman.js:
let orgUrl = Url.parse(origin ?? req.headers.host)
payload = req.WysemanPayload = {
  origin: `${orgUrl.protocol}//${orgUrl.hostname}:${this.uiPort}`
}
```

## Command Line Tool Issues

### Command Execution Failures

**Symptoms**: Command line tools fail with errors or unexpected results

**Solutions**:
- Check command syntax and parameters
- Verify the configuration file is accessible and valid
- Ensure schema files exist and are in the expected locations

**Example Error**: `Unknown command or option: -X`  
**Fix**: Use `wyseman --help` to see available options

### Schema File Parsing Issues

**Symptoms**: Errors about invalid schema files or syntax

**Solutions**:
- Check JSON syntax in schema files
- Validate TCL syntax in schema definition files
- Ensure file paths are correct

**Example Error**: `Error parsing schema file`  
**Fix**: Correct JSON syntax errors in schema files

## Performance Issues

### Slow Schema Operations

**Symptoms**: Schema builds or updates take unusually long

**Solutions**:
- Optimize schema definitions to reduce dependencies
- Split large schema files into smaller modules
- Use appropriate indexes for performance

**Performance Tip**: Use `wyseman` with targeted object specifications rather than rebuilding everything

### Runtime Performance Problems

**Symptoms**: Slow query execution or high memory usage

**Solutions**:
- Optimize where clauses for better SQL generation
- Use appropriate indexes in your schema
- Consider query result limits for large data sets

**Example**: Improve where clause efficiency
```javascript
// Inefficient
{where: [['field1', '=', 'value1'], ['field2', '=', 'value2'], ...]} // Many individual clauses

// More efficient
{where: {field1: 'value1', field2: 'value2', ...}} // Object format for equality checks
```

## Advanced Troubleshooting

### Enabling Debug Logging

To get more detailed information for troubleshooting:

```javascript
// Set environment variable for verbose logging
process.env.WYSEMAN_LOG_LEVEL = 'debug'

// Or configure in code
const wyseman = new Wyseman({
  database: 'mydb',
  log: {
    debug: console.debug,
    error: console.error,
    trace: console.trace,
    verbose: console.log,
    info: console.info
  }
})
```

### Common Error Codes

Wyseman uses error codes that start with `!wm.lang:` followed by a specific error identifier:

- `!wm.lang:badAction`: Unrecognized action requested
- `!wm.lang:badWhere`: Empty or invalid where clause
- `!wm.lang:badOperator`: Invalid operator in where clause
- `!wm.lang:badTuples`: Unexpected row count returned
- `!wm.lang:badInsert`: Empty insert operation attempted
- `!wm.lang:badUpdate`: Empty update operation attempted
- `!wm.lang:badDelete`: Unbounded delete operation attempted

### Database Connection Verification

To verify your database connection is working correctly:

```bash
# Test connection using psql
psql -U your_user -d your_database -c "SELECT 'Connection successful' as status;"

# Verify wyseman schema is installed correctly
wyseman-info
```

## Getting Help

If you encounter issues not covered in this guide:

1. Check the test directory for examples of correct usage
2. Look for similar issues in the [GitHub repository](https://github.com/gotchoices/wyseman)
3. Run with increased logging (`WYSEMAN_LOG_LEVEL=debug`) to get more information
4. Contact the maintainers through the GitHub issue tracker
# Runtime Support

[Prev](versioning.md) | [TOC](README.md) | [Next](connection-protocols.md)

Wyseman provides a comprehensive runtime environment for applications to interact with database schemas. This runtime layer connects client applications to PostgreSQL databases with a security-focused, feature-rich API.

## Architecture Overview

Wyseman's runtime system consists of several key components:

1. **Server-Side Components**:
   - `Wyseman`: Main server class that manages connections and authentication
   - `Handler`: Processes client requests and translates them to SQL
   - `DbClient`: Manages database connections and query execution

2. **Client-Side Components**:
   - `client_ws.js`: WebSocket-based connection client
   - `client_msg.js`: Message formatting and response handling
   - `dbclient.js`: Database client functionality

3. **Support Libraries**:
   - `lang_cache.js`: Caches language strings for UI elements
   - `meta_cache.js`: Caches metadata about tables and views

### Communication Flow

```
┌─────────────┐     WebSocket     ┌─────────────┐    SQL Queries   ┌───────────┐
│  Client App │<----------------->│  Wyseman    │<---------------->│ PostgreSQL│
│             │                   │  Server     │                  │  Database │
└─────────────┘                   └─────────────┘                  └───────────┘
    │                                   │                               │
    │                                   │                               │
    ▼                                   ▼                               ▼
┌─────────────┐                 ┌─────────────┐                 ┌───────────┐
│ client_ws.js│                 │  Handler.js │                 │ Bootstrap │
│client_msg.js│                 │  Schema.js  │                 │   Schema  │
└─────────────┘                 └─────────────┘                 └───────────┘
```

## Server-Side Runtime

The server-side components manage database connections, process client requests, and handle authentication.

### Wyseman Server

The `Wyseman` class is the main server component that:

1. Sets up WebSocket server to accept client connections
2. Validates client credentials
3. Creates database connections for authenticated clients
4. Routes client messages to the appropriate handlers

#### Initialization

```javascript
const wm = new Wyseman(dbConfig, socketConfig, adminConfig);
```

- `dbConfig`: Database connection settings
- `socketConfig`: WebSocket server settings
- `adminConfig`: Administrative database settings

### Handler System

The `Handler` class processes client requests and translates them to SQL:

1. Receives JSON-formatted requests from clients
2. Parses requests into SQL queries
3. Executes queries against the database
4. Returns results to clients

The handler supports these key operations:

- `tuple`: Retrieve a single record
- `select`: Retrieve multiple records
- `insert`: Create a new record
- `update`: Modify existing records
- `delete`: Remove records
- `lang`: Get language strings
- `meta`: Get metadata about objects

### Database Client

The `DbClient` class manages database connections and can:

1. Connect to PostgreSQL databases
2. Execute queries and return results
3. Initialize databases from schema files
4. Update databases to newer schema versions
5. Listen for notifications and relay them to clients

## Client-Side Runtime

The client-side components provide a simple API for applications to connect to and interact with Wyseman servers.

### WebSocket Client

The `ClientWS` class handles secure connections to the server:

1. Generates and manages client-side keys
2. Creates authentication signatures
3. Establishes WebSocket connections
4. Secures communication with the server

### Message Client

The `Message` class handles:

1. Formatting requests for the server
2. Managing request/response pairing
3. Handling asynchronous notifications
4. Error handling and retries

### Client API

Applications interact with the Wyseman client through a simple API:

```javascript
// Connect to a Wyseman server
const wyseman = new WysemanClient(credentials);

// Query a table
wyseman.request('request-id', 'select', {
  view: 'schema.table_name',
  fields: ['field1', 'field2'],
  where: {field1: 'value1'}
}, (response) => {
  // Handle response data
});

// Insert a record
wyseman.request('insert-id', 'insert', {
  view: 'schema.table_name',
  fields: {
    field1: 'value1',
    field2: 'value2'
  }
}, (response) => {
  // Handle insert response
});
```

## Authentication and Security

Wyseman implements several authentication methods:

### Connection Tokens

One-time tokens that are validated by the server:

```javascript
// Generate a token on the server
const token = await db.query("select token from base.token_login('username')");

// Connect with the token
const client = new WysemanClient({
  user: 'username',
  token: token.value,
  host: 'server.example.com',
  port: 1025
});
```

### Key-Based Authentication

Public/private key pairs for secure authentication:

1. Client generates a key pair
2. Public key is registered with the server
3. Client signs connection requests with private key
4. Server verifies signatures with public key

### Secure Connections

All communication is secured through:

1. WebSocket over TLS (wss://)
2. Message signing
3. Authentication challenges
4. Permission validation

## Data Operations

The Wyseman API supports standard CRUD operations:

### Querying Data

```javascript
// Simple query
client.request('query-id', 'select', {
  view: 'schema.table_name',
  fields: ['field1', 'field2', 'field3'],
  where: [{field1: 'value1'}, 'field2', '>', 'value2'],
  order: ['field1', {field: 'field2', asc: false}],
  limit: 100
}, callback);

// Single record query
client.request('get-id', 'tuple', {
  view: 'schema.table_name',
  fields: '*',
  where: {id: 'record_id'}
}, callback);
```

### Query Format and Where Clauses

Wyseman's query system translates JSON-formatted query objects into SQL statements. The `where` parameter is particularly flexible, supporting multiple syntax formats:

#### 1. Object Format (Simple Equality AND)

The simplest format is an object with field-value pairs, which creates equality conditions joined with AND:

```javascript
// WHERE username = 'user123' AND status = 'active'
{
  where: {
    username: 'user123',
    status: 'active'
  }
}
```

#### 2. Array Format (Custom Operators)

For more complex conditions with different operators, use an array of [field, operator, value] conditions:

```javascript
// WHERE age > 21 AND name = 'John'
{
  where: [
    ['age', '>', 21],
    ['name', '=', 'John']
  ]
}
```

Supported operators include:
- `=`, `!=` - Equality and inequality
- `<`, `<=`, `>`, `>=` - Comparison operators
- `~` - LIKE operator for pattern matching
- `diff` - IS DISTINCT FROM operator
- `in` - IN operator for set membership
- `isnull`, `notnull` - NULL checks
- `true` - Field itself as a boolean condition

```javascript
// Examples of different operators
{
  where: [
    ['name', '~', 'J%'],          // LIKE pattern match
    ['tags', 'in', ['A', 'B']],   // IN multiple values
    ['age', 'isnull'],            // IS NULL check
    ['active', 'true']            // Field as boolean
  ]
}
```

#### 3. Logic List Syntax (Complex AND/OR Logic)

For complex logic with nested conditions, use the logic list syntax:

```javascript
// (status = 'active' OR status = 'pending') AND age > 18
{
  where: {
    and: true,
    items: [
      {
        and: false,  // This means OR
        items: [
          {left: 'status', oper: '=', entry: 'active'},
          {left: 'status', oper: '=', entry: 'pending'}
        ]
      },
      {left: 'age', oper: '>', entry: 18}
    ]
  }
}
```

- `and: true` - Combines conditions with AND
- `and: false` - Combines conditions with OR
- `items` - Array of nested conditions

#### 4. Logic Clause Syntax (Single Condition with Options)

For a single condition with additional options:

```javascript
// WHERE NOT (field IN (1, 2, 3))
{
  where: {
    left: 'field',
    oper: 'in',
    entry: [1, 2, 3],
    not: true
  }
}
```

Special features:
- `not` - Negates the condition
- `entry` vs `right` - `entry` is for literal values, `right` for field references

#### 5. Special Case: Array Field Matching

For matching against array fields:

```javascript
// WHERE tags = ANY(ARRAY['tag1', 'tag2'])
{
  where: {
    left: 'item',
    oper: 'in',
    right: 'tags'  // references another field
  }
}
```

#### SQL Injection Prevention

All values in where clauses are automatically parameterized using prepared statements. The `buildWhere` function in Handler.js converts JSON conditions to secure SQL conditions with parameter placeholders ($1, $2, etc.).

#### Recommendations

- Use **Object Format** for simple equality conditions
- Use **Array Format** when you need different operators
- Use **Logic List Syntax** for complex AND/OR combinations
- Use **Logic Clause Syntax** for negations and special operators

### Modifying Data

```javascript
// Insert a record
client.request('insert-id', 'insert', {
  view: 'schema.table_name',
  fields: {
    field1: 'value1',
    field2: 'value2'
  }
}, callback);

// Update a record
client.request('update-id', 'update', {
  view: 'schema.table_name',
  fields: {
    field1: 'new_value'
  },
  where: {id: 'record_id'}
}, callback);

// Delete a record
client.request('delete-id', 'delete', {
  view: 'schema.table_name',
  where: {id: 'record_id'}
}, callback);
```

## Language and Metadata Support

Wyseman provides built-in support for internationalization and metadata:

### Language Strings

Applications can access language strings for tables, columns, and messages:

```javascript
client.request('lang-id', 'lang', {
  view: 'schema.table_name',
  language: 'eng'
}, (data) => {
  // data contains title, help, columns, and messages
});
```

### Metadata

Applications can retrieve metadata about database objects:

```javascript
client.request('meta-id', 'meta', {
  view: 'schema.table_name'
}, (data) => {
  // data contains pkey, cols, columns, styles, fkeys
});
```

## Real-Time Updates

Wyseman supports real-time database notifications:

1. Client registers to listen for specific channels
2. Server forwards PostgreSQL NOTIFY events to clients
3. Client receives notifications as they occur

```javascript
// On the server
db.query(`select pg_notify('channel_name', '{"data": "value"}')`)

// On the client (automatically registered)
// Notifications arrive as {action: 'notify', channel: 'channel_name', data: {data: 'value'}}
```

## Advanced Features

### 1. Caching

Wyseman implements caching for:

- Language strings (for UI elements)
- Metadata (for table structure)

This reduces database load and improves application performance.

### 2. Binary Data

Wyseman supports binary data fields:

```javascript
client.request('upload-id', 'insert', {
  view: 'schema.documents',
  fields: {
    name: 'Document.pdf',
    content: {
      _type_: 'binary',
      _data_: base64EncodedData,
      _name_: 'Document.pdf'
    }
  }
}, callback);
```

### 3. JSON Data

Native support for JSON/JSONB PostgreSQL data types:

```javascript
client.request('json-id', 'insert', {
  view: 'schema.config',
  fields: {
    settings: {
      theme: 'dark',
      fontSize: 14,
      features: ['notifications', 'autosave']
    }
  }
}, callback);
```

## Integration Examples

### Browser Client Example

```javascript
import { WysemanClient } from 'wyseman';

// Connect to server
const client = new WysemanClient({
  host: 'api.example.com',
  port: 8443,
  user: 'username',
  token: 'auth_token'
});

// Fetch user data
client.request('get-user', 'tuple', {
  view: 'app.users',
  where: {username: 'current_user'}
}, (response) => {
  if (response.error) {
    console.error('Error:', response.error);
  } else {
    console.log('User data:', response.data);
  }
});
```

### Node.js Server Example

```javascript
const { Wyseman } = require('wyseman');

// Create a Wyseman server
const server = new Wyseman(
  { database: 'myapp', user: 'postgres' },  // DB config
  { websock: { port: 8443 } },              // Socket config
  { user: 'admin' }                         // Admin config
);

// Server is now listening for connections
console.log('Wyseman server running on port 8443');
```

## Error Handling

Wyseman provides standardized error handling:

1. SQL errors are captured and formatted
2. Error codes follow the format `!wm.lang:error_code`
3. Error messages include details from PostgreSQL

```javascript
client.request('invalid-id', 'update', {
  view: 'schema.table',
  fields: { field: 'value' },
  // Missing where clause
}, (response) => {
  if (response.error) {
    console.error('Code:', response.error.code);
    console.error('Message:', response.error.message);
    console.error('Detail:', response.error.detail);
  }
});
```

## Best Practices

1. **Use Prepared Statements**: Wyseman parameters are automatically prepared, preventing SQL injection

2. **Implement Connection Pooling**: For high-traffic applications, implement connection pooling

3. **Handle Reconnections**: Implement client-side reconnection logic for network interruptions

4. **Cache Metadata and Language**: Use the built-in caching for language strings and metadata

5. **Secure Credentials**: Store connection keys securely; use one-time tokens when possible

6. **Limit Query Results**: Use the `limit` parameter to prevent excessive data transfer

7. **Implement Proper Error Handling**: Always check for errors in responses

[Prev](versioning.md) | [TOC](README.md) | [Next](connection-protocols.md)
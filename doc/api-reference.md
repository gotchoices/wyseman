# API Reference

[Prev](security-connections.md) | [TOC](README.md) | [Next](future-development.md)

This document provides a reference for clients and servers interacting with wyseman.

## JavaScript API

### Server-Side API

#### Wyseman Class

The `Wyseman` class serves as the primary server-side component that manages the connection between user interfaces and the backend database. It creates and manages WebSocket connections, handles authentication, and dispatches requests to the appropriate handlers.

```javascript
/**
 * Creates a new Wyseman server instance
 * @param {Object} dbConf - Database configuration for client connections
 * @param {Object} dbConf.database - Database name
 * @param {Object} dbConf.user - Database user (optional, defaults to connection user)
 * @param {Object} dbConf.password - Database password (optional)
 * @param {Object} dbConf.host - Database host (optional, defaults to localhost)
 * @param {Object} dbConf.port - Database port (optional, defaults to 5432)
 * @param {Object} dbConf.log - Logger object (optional)
 * 
 * @param {Object} sockConf - Socket configuration
 * @param {Object} sockConf.websock - WebSocket configuration
 * @param {Number} sockConf.websock.port - WebSocket port number
 * @param {Object} sockConf.websock.credentials - HTTPS credentials (optional for secure connections)
 * @param {Number} sockConf.websock.delta - Maximum time delta for signature verification (optional, defaults to 60000ms)
 * @param {Number} sockConf.websock.uiPort - UI port number (optional, defaults to websock.port - 1)
 * @param {Object} sockConf.actions - Custom action handlers (optional)
 * @param {Function} sockConf.dispatch - Custom dispatch function (optional)
 * @param {Object} sockConf.expApp - Express application (optional)
 * @param {Object} sockConf.log - Logger object (optional)
 * 
 * @param {Object} adminConf - Admin connection configuration
 * @param {Array} adminConf.listen - PostgreSQL channels to listen for notifications (optional, defaults to ['wyseman'])
 * @param {Object} adminConf.log - Logger object (optional)
 * 
 * @returns {Wyseman} A new Wyseman instance
 */
constructor(dbConf, sockConf, adminConf)
```

**Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `server` | `Server` | The HTTP or HTTPS server that the WebSocket server uses |
| `log` | `Object` | The logger object used for logging messages |
| `adminDB` | `DbClient` | Database client for administrative operations |
| `wss` | `WebSocket.Server` | The WebSocket server instance |
| `maxDelta` | `Number` | Maximum allowed time difference for signature verification |
| `uiPort` | `Number` | The UI port number (typically websocket port - 1) |

**Methods**:

```javascript
/**
 * Closes the Wyseman server instance and all associated connections
 * Terminates the WebSocket server, HTTP/HTTPS server, and disconnects from the database
 */
close()
```

```javascript
/**
 * Validates a user connection token
 * @param {String} user - Username 
 * @param {String} token - One-time connection token
 * @param {String} pub - Public key in JSON format
 * @param {Array} listen - PostgreSQL notification channels to listen on
 * @param {Object} payload - Object to store connection information
 * @param {Function} cb - Callback function(valid) with boolean result
 */
validateToken(user, token, pub, listen, payload, cb)
```

```javascript
/**
 * Validates a user signature for authentication
 * @param {String} user - Username
 * @param {String} sign - Base64-encoded signature
 * @param {String} message - Message that was signed
 * @param {Array} listen - PostgreSQL notification channels to listen on
 * @param {Object} payload - Object to store connection information
 * @param {Function} cb - Callback function(valid) with boolean result
 */
validateSignature(user, sign, message, listen, payload, cb)
```

```javascript
/**
 * Verifies a client connection request
 * Checks for token or signature-based authentication
 * @param {Object} info - Connection information object
 * @param {Function} cb - Callback function(accepted, code, message)
 */
verifyClient(info, cb)
```

**Events**:

The Wyseman class sets up the following event handlers:

- **WebSocket 'connection'**: Handles new WebSocket connections
- **WebSocket 'close'**: Handles WebSocket disconnections
- **WebSocket 'message'**: Processes incoming messages from clients

**Example Usage**:

```javascript
const Wyseman = require('wyseman').Wyseman;

// Database configuration
const dbConf = {
  database: 'mydb',
  log: myLogger
};

// Socket configuration
const sockConf = {
  websock: {
    port: 8080,
    credentials: sslCredentials // Optional for secure connections
  }
};

// Admin configuration
const adminConf = {
  listen: ['wyseman', 'custom_channel']
};

// Create Wyseman server
const wm = new Wyseman(dbConf, sockConf, adminConf);

// To shut down the server
wm.close();
```

#### Handler Class

The `Handler` class translates JSON action objects to SQL and executes them in the backend database. It processes incoming requests from clients, constructs appropriate SQL queries, and handles results and errors.

```javascript
/**
 * Creates a new Handler instance
 * @param {Object} options - Configuration options
 * @param {DbClient} options.db - Database client instance for executing queries
 * @param {Object} options.control - Custom control object (optional)
 * @param {Object} options.actions - Custom actions (optional)
 * @param {Function} options.dispatch - Dispatch function for custom actions
 * @param {Object} options.dConfig - Dispatch configuration
 * @param {Object} options.dConfig.db - Database client for dispatch
 * @param {Object} options.dConfig.expApp - Express application (optional)
 * @param {Object} options.dConfig.actions - Custom actions (optional)
 * @param {String} options.dConfig.origin - Origin for cross-origin requests
 * @param {Object} options.dConfig.log - Logger object for dispatch
 * @param {Object} options.log - Logger object
 * @returns {Handler} A new Handler instance
 */
constructor({db, control, actions, dispatch, dConfig, log})
```

**Methods**:

```javascript
/**
 * Creates and returns an error object with consistent formatting
 * @param {String} msg - Error message
 * @param {String|Object} err - Error code or object (default: 'unknown')
 * @returns {Object} Formatted error object with message, detail, code, and pgCode properties
 */
error(msg, err = 'unknown')
```

```javascript
/**
 * Handles an incoming packet from a client
 * Processes various action types and executes appropriate database queries
 * @param {Object} msg - The message packet to handle
 * @param {String} msg.id - Unique identifier for the message
 * @param {String} msg.view - The database view or table to operate on
 * @param {String} msg.action - The action to perform (select, tuple, insert, update, delete, lang, meta)
 * @param {Function} sender - Callback function to send response
 * @param {Boolean} recursive - Flag indicating recursive call (internal use)
 */
handle(msg, sender, recursive = false)
```

```javascript
/**
 * Builds a SELECT SQL query
 * @param {Object} res - Result object to populate with query and parameters
 * @param {Object} spec - Query specification
 * @param {Array|String} spec.fields - Fields to select
 * @param {String} spec.table - Table or view name
 * @param {Array} spec.argtypes - Parameter type specifications for functions
 * @param {Array} spec.params - Parameters for function calls
 * @param {Object} spec.where - Where clause specification
 * @param {Array|Object} spec.order - Order by specification
 * @param {Number} spec.limit - Limit result count
 */
buildSelect(res, spec)
```

```javascript
/**
 * Builds an INSERT SQL query
 * @param {Object} res - Result object to populate with query and parameters
 * @param {Object} fields - Fields to insert (field name -> value)
 * @param {String} table - Table name
 */
buildInsert(res, fields, table)
```

```javascript
/**
 * Builds an UPDATE SQL query
 * @param {Object} res - Result object to populate with query and parameters
 * @param {Object} fields - Fields to update (field name -> value)
 * @param {String} table - Table name
 * @param {Object} where - Where clause specification
 */
buildUpdate(res, fields, table, where)
```

```javascript
/**
 * Builds a DELETE SQL query
 * @param {Object} res - Result object to populate with query and parameters
 * @param {String} table - Table name
 * @param {Object} where - Where clause specification
 */
buildDelete(res, table, where)
```

```javascript
/**
 * Builds a WHERE clause from a JSON structure
 * @param {Object|Array} logic - Where clause specification in various formats
 * @param {Object} res - Result object to populate with parameters
 * @returns {String} SQL WHERE clause
 */
buildWhere(logic, res)
```

```javascript
/**
 * Builds an ORDER BY clause from a JSON structure
 * @param {Object|Array} order - Order by specification
 * @param {Object} res - Result object to populate with any parameters
 * @returns {String} SQL ORDER BY clause
 */
buildOrder(order, res)
```

**Supported Actions**:

The Handler class supports the following standard actions:

| Action | Description |
|--------|-------------|
| `tuple` | Fetches a single record from a table or view |
| `select` | Fetches multiple records from a table or view |
| `insert` | Inserts a new record into a table |
| `update` | Updates existing records in a table |
| `delete` | Deletes records from a table |
| `lang` | Retrieves language/internationalization data |
| `meta` | Retrieves metadata about tables and views |

It also supports custom actions via the `control` object and `dispatch` function.

**Where Clause Formats**:

The Handler supports several formats for specifying WHERE clauses:

1. **Object Format**: Simple key-value pairs for equality conditions
   ```javascript
   { field1: 'value1', field2: 42 }  // Translates to: WHERE field1 = 'value1' AND field2 = 42
   ```

2. **Array Format**: Each element is a condition with field, operator, and value
   ```javascript
   [ 
     ['field1', '=', 'value1'], 
     ['field2', '>', 42] 
   ]  // Translates to: WHERE field1 = 'value1' AND field2 > 42
   ```

3. **Logic List Syntax**: For complex AND/OR combinations
   ```javascript
   { 
     and: true,  // or false for OR
     items: [
       { left: 'field1', oper: '=', entry: 'value1' },
       { left: 'field2', oper: '>', entry: 42 }
     ]
   }
   ```

4. **Logic Clause Syntax**: For a single condition with optional negation
   ```javascript
   {
     left: 'field1',
     oper: '=',
     entry: 'value1',
     not: false  // true to negate the condition
   }
   ```

**Example Usage**:

```javascript
const Handler = require('wyseman').Handler;
const DbClient = require('wyseman').dbClient;

// Create a database client
const db = new DbClient({ database: 'mydb' });

// Create a handler instance
const handler = new Handler({ 
  db, 
  log: console
});

// Handle a select request
handler.handle({
  id: 'request-123',
  action: 'select',
  view: 'schema.table_name',
  fields: ['field1', 'field2'],
  where: { status: 'active' },
  order: [{ field: 'created_at', asc: false }],
  limit: 100
}, (response) => {
  console.log('Response:', response);
});
```

#### DbClient Class

The `DbClient` class provides a low-level connection to a PostgreSQL database. It handles connecting to the database, executing queries, and managing notifications. If the specified database doesn't exist, it can create it and initialize it with a schema.

```javascript
/**
 * Creates a new database client
 * @param {Object} conf - Configuration object
 * @param {String} conf.database - Database name
 * @param {String} conf.user - Database user (optional)
 * @param {String} conf.password - Database password (optional)
 * @param {String} conf.host - Database host (optional, defaults to localhost)
 * @param {String} conf.port - Database port (optional, defaults to 5432)
 * @param {Boolean} conf.connect - Whether to connect immediately (optional, defaults to false)
 * @param {Boolean} conf.update - Whether to check for schema updates (optional, defaults to false)
 * @param {String} conf.schema - Path to schema file (optional)
 * @param {Array|String} conf.listen - PostgreSQL channels to listen on (optional)
 * @param {Object} conf.log - Logger object (optional)
 * @param {Number} conf.retry - Retry count for connection (internal use)
 * @param {Function} notifyCB - Callback for notifications from PostgreSQL
 * @param {Function} connectCB - Callback when connection is established
 * @returns {DbClient} A new DbClient instance
 */
constructor(conf, notifyCB, connectCB)
```

**Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `log` | `Object` | Logger object |
| `config` | `Object` | Configuration object (private copy) |
| `client` | `pg.Client` | PostgreSQL client instance |
| `notifyCB` | `Function` | Callback for notifications |
| `connectCB` | `Function` | Callback for connection events |
| `queryQue` | `Array` | Queue of queries waiting for DB to connect |
| `connecting` | `Boolean` | Flag indicating if a connection attempt is in progress |

**Methods**:

```javascript
/**
 * Disconnects from the database if connected
 */
disconnect()
```

```javascript
/**
 * Creates a new PostgreSQL client instance
 * Sets up event handlers for notifications and errors
 */
newClient()
```

```javascript
/**
 * Connects to the database
 * If the database doesn't exist, it will create it
 * If the schema doesn't exist, it will initialize it
 * @param {Function} cb - Callback function called when connection is established
 */
connect(cb)
```

```javascript
/**
 * Executes a database query
 * If not connected, queues the query until connected
 * @param {...*} args - Arguments passed to pg.Client.query
 *   Typically: (queryText, params, callback)
 * @returns {Promise|undefined} Query result promise (if pg.Client.query returns one)
 */
query(...args)
```

```javascript
/**
 * Executes a database query wrapped in a transaction
 * Automatically adds BEGIN and COMMIT statements
 * @param {...*} args - Arguments passed to query()
 */
t(...args)
```

```javascript
/**
 * Executes a database query and returns a promise with the result rows
 * @param {...*} args - Arguments passed to pg.Client.query
 * @returns {Promise<Array>} Promise resolving to result rows
 */
async pquery(...args)
```

```javascript
/**
 * Checks the running database and compares to schema
 * If updates are needed and conf.update is true, applies them
 * @param {Function} cb - Callback function called when update check/apply is complete
 */
update(cb)
```

**Events**:

The DbClient attaches event handlers to the underlying pg.Client:

- **'notification'**: Fires when a notification is received from PostgreSQL
- **'error'**: Fires when an error occurs with the database connection

**Example Usage**:

```javascript
const DbClient = require('wyseman').dbClient;

// Basic connection
const db = new DbClient({
  database: 'mydb',
  user: 'dbuser',
  password: 'dbpass',
  connect: true
}, 
(channel, message, fromOwnQuery) => {
  // Handle PostgreSQL notification
  console.log(`Notification on ${channel}:`, message);
},
() => {
  console.log('Connected to database');
});

// Execute a query
db.query('SELECT * FROM users WHERE id = $1', [123], (err, result) => {
  if (err) {
    console.error('Query error:', err);
    return;
  }
  console.log('User:', result.rows[0]);
});

// Using promises
async function getUser(id) {
  const rows = await db.pquery('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

// Execute a transaction
db.t('INSERT INTO logs (message) VALUES ($1); UPDATE stats SET count = count + 1', 
   ['New log entry'], 
   (err, result) => {
     if (err) console.error('Transaction error:', err);
   }
);

// Disconnect when done
db.disconnect();
```

### Client-Side API

#### ClientWS Class

The `ClientWS` class provides WebSocket-based communication with the Wyseman backend server. It handles connection authentication, key management, and signature generation for secure connections.

```javascript
/**
 * Creates a new WebSocket client
 * @param {Object} resource - Resource object providing platform services
 * @param {Object} resource.webcrypto - Web Crypto API implementation
 * @param {Number} resource.httpPort - HTTP port for client info requests
 * @param {Function} resource.debug - Debug logging function
 * @param {Function} resource.fetch - Function to fetch resources (like window.fetch)
 * @param {Function} resource.saveKey - Function to save generated keys
 * @returns {ClientWS} A new ClientWS instance
 */
constructor(resource)
```

**Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `res` | `Object` | Resource object providing platform services |
| `httpPort` | `Number` | HTTP port for client info requests |
| `webcrypto` | `Object` | Web Crypto API implementation |
| `subtle` | `Object` | Subtle crypto API for cryptographic operations |

**Methods**:

```javascript
/**
 * Access a resource from the resource object
 * @param {String} res - Resource name
 * @param {...*} args - Arguments to pass to the resource
 * @returns {*} Result from the resource function
 */
resource(res, ...args)
```

```javascript
/**
 * Log debug information
 * @param {...*} msgs - Messages to log
 */
debug(...msgs)
```

```javascript
/**
 * Builds a WebSocket URI for connecting to the server
 * @param {Object} credentials - Connection credentials
 * @param {String} credentials.proto - Protocol (ws or wss)
 * @param {String} credentials.host - Server hostname
 * @param {Number} credentials.port - Server port
 * @param {String} credentials.user - Username
 * @param {String} credentials.token - Connection token (for token-based auth)
 * @param {Object} credentials.key - Connection key (for key-based auth)
 * @param {Function} cb - Optional callback function(uri)
 * @returns {Promise<String>|undefined} Promise resolving to the WebSocket URI or undefined if using callback
 */
uri(credentials, cb)
```

```javascript
/**
 * Checks and prepares connection credentials
 * @param {Object} creds - Connection credentials
 * @param {Function} cb - Optional callback function(error)
 * @returns {Promise<void>|undefined} Promise or undefined if using callback
 */
credCheck(creds, cb)
```

```javascript
/**
 * Makes sure a valid crypto key is available in credentials
 * @param {Object} creds - Connection credentials
 * @param {Function} cb - Optional callback function(error)
 * @returns {Promise<void>|undefined} Promise or undefined if using callback
 */
keyCheck(creds, cb)
```

```javascript
/**
 * Adds a current signature with the connection key
 * @param {Object} creds - Connection credentials
 * @param {Function} cb - Optional callback function(error)
 * @returns {Promise<void>|undefined} Promise or undefined if using callback
 */
signCheck(creds, cb)
```

**Authentication Methods**:

The ClientWS class supports two authentication methods:

1. **Token-based authentication**
   - Used for initial connections
   - Requires `user`, `token`, and `pub` (public key) in credentials
   - Public key is stored on the server for future connections

2. **Key-based authentication**
   - Used for subsequent connections
   - Requires `user`, `key` (private key), and signature generated with `signCheck`
   - More secure than token-based auth

**Example Usage**:

```javascript
const ClientWS = require('wyseman').ClientWS;
const WebSocket = require('ws'); // In Node.js

// Set up resources
const resources = {
  webcrypto: require('crypto').webcrypto,
  httpPort: 8080,
  debug: console.debug,
  fetch: require('node-fetch'),
  saveKey: (key) => {
    // Save the key for future connections
    fs.writeFileSync('connection.key', JSON.stringify(key));
  }
};

// Create client
const client = new ClientWS(resources);

// Connect with a token (first connection)
const tokenCredentials = {
  proto: 'wss',
  host: 'example.com',
  port: 8081,
  user: 'username',
  token: 'one-time-token'
};

client.uri(tokenCredentials)
  .then(uri => {
    const ws = new WebSocket(uri);
    ws.on('open', () => console.log('Connected!'));
    ws.on('message', (data) => console.log('Received:', data));
  })
  .catch(err => console.error('Connection error:', err));

// Connect with a key (subsequent connections)
const keyCredentials = {
  proto: 'wss',
  host: 'example.com',
  port: 8081,
  user: 'username',
  key: JSON.parse(fs.readFileSync('connection.key', 'utf8'))
};

client.uri(keyCredentials)
  .then(uri => {
    const ws = new WebSocket(uri);
    // Handle the connection...
  });
```

#### Message Class

The `Message` class handles client-side message tracking and processing. It manages communication between the application and the Wyseman backend, tracks pending requests, and caches metadata and language information.

```javascript
/**
 * Creates a new Message instance
 * @param {Object} localStore - Storage object for persistence
 * @param {Function} localStore.get - Function to retrieve stored data
 * @param {Function} localStore.set - Function to store data
 * @param {Object} config - Configuration object
 * @param {Function} config.debug - Debug logging function (optional)
 * @param {String} config.language - Default language code (optional, defaults to 'eng')
 * @returns {Message} A new Message instance
 */
constructor(localStore, config)
```

**Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `localStore` | `Object` | Storage object for persistence |
| `debug` | `Function` | Debug logging function |
| `language` | `String` | Current language code |
| `sender` | `Function` | Function to send data to backend |
| `address` | `String` | Current connection address |
| `sendQue` | `Array` | Queue of pending outbound requests |
| `handlers` | `Object` | Callbacks waiting for responses |
| `langCache` | `Object` | Cache of language data by language and view |
| `metaCache` | `Object` | Cache of metadata by view |
| `pending` | `Object` | Pending metadata and language requests |
| `callbacks` | `Object` | Callbacks for metadata updates |
| `listens` | `Object` | Callbacks for asynchronous notifications |
| `localCache` | `Object` | Temporary cache for data from local storage |

**Methods**:

```javascript
/**
 * Called when WebSocket connection is closed
 * Notifies listeners of disconnection
 */
onClose()
```

```javascript
/**
 * Called when WebSocket connection is opened
 * @param {String} address - Connection address
 * @param {Function} sender - Function to send data to backend
 */
onOpen(address, sender)
```

```javascript
/**
 * Processes messages received from the server
 * @param {String} msg - JSON message from server
 */
async onMessage(msg)
```

```javascript
/**
 * Processes queued outbound messages
 */
procQueue()
```

```javascript
/**
 * Processes column data from metadata or language responses
 * Reorganizes columns array into a column object
 * @param {Object} data - Data object containing columns array
 */
procColumns(data)
```

```javascript
/**
 * Processes message data from language responses
 * Reorganizes messages array into a message object
 * @param {Object} data - Data object containing messages array
 */
procMessages(data)
```

```javascript
/**
 * Links language data to metadata
 * @param {String} view - View name
 */
linkLang(view)
```

```javascript
/**
 * Creates default language objects from defaults
 * @param {Object} langObj - Language object to populate
 * @param {Object} defaults - Default language values
 * @returns {Object} Language object with defaults
 */
langDefs(langObj, defaults)
```

```javascript
/**
 * Sends a request to the backend
 * @param {String} id - Unique identifier for the request
 * @param {String} action - Action to perform (connect, select, tuple, insert, update, delete, lang, meta)
 * @param {Object|String} opt - Options or view name
 * @param {Function} cb - Callback function for response
 */
async request(id, action, opt, cb)
```

```javascript
/**
 * Notifies listeners about connection status
 * @param {String} addr - Connection address or null if disconnected
 */
notify(addr)
```

```javascript
/**
 * Registers a callback for metadata updates
 * @param {String} id - Unique identifier
 * @param {String} view - View name
 * @param {Function} cb - Callback function
 */
register(id, view, cb)
```

```javascript
/**
 * Registers a callback for asynchronous notifications
 * @param {String} id - Unique identifier
 * @param {String} chan - Channel name
 * @param {Function} cb - Callback function
 */
listen(id, chan, cb)
```

```javascript
/**
 * Changes the current language
 * @param {String} language - Language code
 */
newLanguage(language)
```

**Request Actions**:

The Message class supports the following actions:

| Action | Description |
|--------|-------------|
| `connect` | Request connection status |
| `tuple` | Fetch a single record |
| `select` | Fetch multiple records |
| `insert` | Insert a new record |
| `update` | Update existing records |
| `delete` | Delete records |
| `lang` | Fetch language data |
| `meta` | Fetch metadata |
| `action` | Custom action (dispatched to server) |

**Example Usage**:

```javascript
const Message = require('wyseman').ClientMessage;
const WebSocket = require('ws');

// Create storage interface
const storage = {
  async get(key) {
    return JSON.parse(localStorage.getItem(key));
  },
  async set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// Create message handler
const msg = new Message(storage, {
  debug: console.debug,
  language: 'eng'
});

// Connect to server
const ws = new WebSocket('wss://example.com:8081/');

ws.onopen = () => {
  msg.onOpen('example.com:8081', (data) => {
    ws.send(data);
  });
};

ws.onmessage = (event) => {
  msg.onMessage(event.data);
};

ws.onclose = () => {
  msg.onClose();
};

// Request data
msg.request('request-123', 'select', {
  view: 'schema.table_name',
  fields: ['field1', 'field2'],
  where: { status: 'active' }
}, (data, error) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Data:', data);
});

// Register for metadata updates
msg.register('reg-123', 'schema.table_name', (metadata) => {
  console.log('Metadata updated:', metadata);
});

// Listen for notifications
msg.listen('listen-123', 'table_changes', (data) => {
  console.log('Table changed:', data);
});

// Change language
msg.newLanguage('fra');
```

### Schema API

The Schema API is covered in detail in the [Schema File Reference](schema-files.md) and [Versioning](versioning.md) documentation.

## Request and Response Formats

The Wyseman API uses JSON-based request and response formats for all interactions between clients and the backend. All requests and responses use a consistent format described below.

### Common Request Format

All requests to the Wyseman server follow this general structure:

```javascript
{
  id: "request-id",        // Unique identifier for the request
  action: "action-name",   // Action to perform (select, tuple, insert, update, delete, lang, meta)
  view: "schema.table",    // The database view or table to operate on
  
  // Additional parameters specific to the action type
  // ...
}
```

### Common Response Format

All responses from the Wyseman server follow this general structure:

```javascript
{
  id: "request-id",        // Same ID as in the request
  action: "action-name",   // Same action as in the request
  
  // For successful requests:
  data: [...],             // Response data (structure depends on action type)
  
  // For failed requests:
  error: {                 // Error details (only present on error)
    message: "Error message",
    code: "error-code",
    detail: "Detailed info",
    pgCode: "PostgreSQL error code"
  }
}
```

### Action Types

Wyseman supports several standard action types for database operations. These request/response formats have been documented in detail in the [Runtime Support](runtime.md) document, but are summarized here for reference.

#### select

The `select` action retrieves multiple records from a table or view.

```javascript
// Request format
{
  id: 'request-id',
  action: 'select',
  view: 'schema.table_name',   // The table or view to query
  fields: ['field1', 'field2'], // Fields to return (optional, defaults to all)
  where: {                     // Where clause (optional)
    field1: 'value1',          // Simple equality format
    // Or other supported formats (see Handler.buildWhere)
  },
  order: [                     // Order by clause (optional)
    { field: 'created_at', asc: false },
    'field2'                   // Simple field name (ascending)
  ],
  limit: 100                   // Limit result count (optional)
}

// Response format
{
  id: 'request-id',
  action: 'select',
  data: [                      // Array of record objects
    { field1: 'value1', field2: 42 },
    { field1: 'value2', field2: 43 },
    // ...
  ]
}
```

#### tuple

The `tuple` action retrieves a single record from a table or view. It uses the same parameters as `select` but returns a single record object rather than an array.

```javascript
// Request format
{
  id: 'request-id',
  action: 'tuple',
  view: 'schema.table_name',
  fields: ['field1', 'field2'], // Optional
  where: {                     // Where clause to uniquely identify the record
    id: 123
  }
}

// Response format
{
  id: 'request-id',
  action: 'tuple',
  data: {                      // Single record object
    field1: 'value1',
    field2: 42
  }
}
```

#### insert

The `insert` action creates a new record in a table.

```javascript
// Request format
{
  id: 'request-id',
  action: 'insert',
  view: 'schema.table_name',
  fields: {                    // Fields to insert
    field1: 'value1',
    field2: 42
  }
}

// Response format
{
  id: 'request-id',
  action: 'insert',
  data: {                      // The newly created record
    id: 456,                   // Including any generated fields
    field1: 'value1',
    field2: 42
  }
}
```

#### update

The `update` action modifies existing records in a table.

```javascript
// Request format
{
  id: 'request-id',
  action: 'update',
  view: 'schema.table_name',
  fields: {                    // Fields to update
    field1: 'new-value',
    field2: 43
  },
  where: {                     // Where clause to identify records to update
    id: 456
  }
}

// Response format
{
  id: 'request-id',
  action: 'update',
  data: {                      // The updated record
    id: 456,
    field1: 'new-value',
    field2: 43
  }
}
```

#### delete

The `delete` action removes records from a table.

```javascript
// Request format
{
  id: 'request-id',
  action: 'delete',
  view: 'schema.table_name',
  where: {                     // Where clause to identify records to delete
    id: 456
  }
}

// Response format
{
  id: 'request-id',
  action: 'delete',
  data: null                   // No data is returned for delete operations
}
```

#### lang

The `lang` action retrieves language/internationalization data for a table or view.

```javascript
// Request format
{
  id: 'request-id',
  action: 'lang',
  view: 'schema.table_name',
  language: 'eng'              // Language code (optional, defaults to 'eng')
}

// Response format
{
  id: 'request-id',
  action: 'lang',
  data: {                      // Language data
    title: 'Table Title',      // Table title in the requested language
    help: 'Table help text',   // Table help text in the requested language
    columns: [                 // Column language data
      {
        col: 'field1',
        title: 'Field 1',
        help: 'Help text for field 1'
      },
      // ...
    ],
    messages: [                // Message language data
      {
        code: 'message_code',
        title: 'Message title',
        help: 'Message help text'
      },
      // ...
    ],
    // Additional properties added by the client
    col: { ... },              // Columns indexed by name
    msg: { ... }               // Messages indexed by code
  }
}
```

#### meta

The `meta` action retrieves metadata about a table or view.

```javascript
// Request format
{
  id: 'request-id',
  action: 'meta',
  view: 'schema.table_name'
}

// Response format
{
  id: 'request-id',
  action: 'meta',
  data: {                      // Metadata
    obj: 'schema.table_name',  // Full object name
    pkey: ['id'],              // Primary key column(s)
    cols: ['id', 'field1', 'field2'], // All columns
    columns: [                 // Column metadata
      {
        col: 'id',
        type: 'integer',
        notnull: true,
        primary: true
      },
      {
        col: 'field1',
        type: 'text',
        notnull: false
      },
      // ...
    ],
    styles: { ... },           // Display styles
    fkeys: [ ... ],            // Foreign key relationships
    // Additional properties added by the client
    col: { ... }               // Columns indexed by name
  }
}
```

#### notify

The `notify` action is sent from the server to clients when a PostgreSQL notification is received. It is not sent by clients.

```javascript
// Response format (server to client only)
{
  action: 'notify',
  channel: 'channel_name',
  data: { ... }                // JSON data from the notification
}
```

### Error Formats

When an error occurs during request processing, Wyseman returns an error object instead of data. The error object contains information about what went wrong and may include localized error messages.

```javascript
// Error response format
{
  id: 'request-id',
  action: 'action-name',
  error: {
    message: 'Error message',           // Human-readable error message
    code: '!wm.lang:errorCode',         // Error code with language tag
    detail: 'Detailed error information', // Additional details (if available)
    pgCode: 'PostgreSQL error code',    // Original PostgreSQL error code (if from database)
    lang: 'Localized error message'     // Translated error message (if available)
  }
}
```

The `code` field often follows a pattern of `!schema.view:code`, which indicates that the error message can be found in the language data for the specified view. The client can use this to automatically translate error messages.

**Common Error Codes**:

| Error Code | Description |
|------------|-------------|
| `badAction` | The requested action is not recognized |
| `badMessage` | The request message is malformed |
| `noResult` | The query did not return any results |
| `badTuples` | The query returned an unexpected number of rows |
| `badWhere` | The WHERE clause is empty or invalid |
| `badInsert` | The INSERT operation is invalid (e.g., no fields specified) |
| `badUpdate` | The UPDATE operation is invalid (e.g., no fields specified) |
| `badDelete` | The DELETE operation is too broad (missing WHERE clause) |
| `badLeft` | Invalid left hand side in a WHERE condition |
| `badOperator` | Invalid operator in a WHERE condition |
| `badRight` | Invalid right hand side in a WHERE condition |
| `badLogic` | The WHERE logic structure is invalid |
| `badFieldName` | Invalid field name |

In addition to these wyseman-specific error codes, PostgreSQL error codes may also be included in the `pgCode` field.

## Legacy APIs

> Note: The TCL and Ruby APIs are deprecated and not documented here. The JavaScript API is the recommended interface for all new development.

## Integration Examples

### Browser Integration

This example shows how to integrate Wyseman in a browser environment:

```javascript
// Import necessary modules (using a module bundler like webpack)
import { ClientWS, ClientMessage } from 'wyseman';

// Create local storage interface
const storage = {
  async get(key) {
    return JSON.parse(localStorage.getItem(key));
  },
  async set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// Create resource object for ClientWS
const resource = {
  webcrypto: window.crypto,
  httpPort: 8080,
  debug: console.debug,
  fetch: window.fetch,
  saveKey: (key) => {
    localStorage.setItem('wyseman_key', JSON.stringify(key));
  }
};

// Create client instances
const clientWS = new ClientWS(resource);
const msgHandler = new ClientMessage(storage, { debug: console.debug });

// Connect to server
let websocket;

// Get stored key or use token authentication
const credentials = {
  proto: 'wss',
  host: 'example.com',
  port: 8081,
  user: 'username'
};

// Try to use stored key
const storedKey = localStorage.getItem('wyseman_key');
if (storedKey) {
  credentials.key = JSON.parse(storedKey);
} else {
  // Use token-based authentication
  credentials.token = 'one-time-token'; // Get this from your server
}

// Connect
async function connect() {
  try {
    const uri = await clientWS.uri(credentials);
    websocket = new WebSocket(uri);
    
    websocket.onopen = () => {
      msgHandler.onOpen('connected', (data) => {
        websocket.send(data);
      });
      
      // Fetch metadata for tables we need
      msgHandler.request('app-meta', 'meta', 'schema.users', (data) => {
        console.log('Users metadata:', data);
      });
      
      // Fetch user list
      msgHandler.request('app-users', 'select', {
        view: 'schema.users',
        fields: ['id', 'username', 'email'],
        order: [{ field: 'username', asc: true }]
      }, (data, error) => {
        if (error) {
          console.error('Error fetching users:', error);
          return;
        }
        console.log('Users:', data);
      });
      
      // Listen for changes
      msgHandler.listen('app-listen', 'schema.users', (data) => {
        console.log('Users table changed:', data);
        // Refresh data
      });
    };
    
    websocket.onmessage = (event) => {
      msgHandler.onMessage(event.data);
    };
    
    websocket.onclose = () => {
      msgHandler.onClose();
      // Attempt reconnect after delay
      setTimeout(connect, 5000);
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      websocket.close();
    };
  } catch (error) {
    console.error('Connection error:', error);
    // Attempt reconnect after delay
    setTimeout(connect, 5000);
  }
}

// Start connection
connect();
```

### Node.js Integration

This example shows how to integrate Wyseman in a Node.js application:

```javascript
const { ClientWS, ClientMessage } = require('wyseman');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Create storage interface using file system
const storage = {
  async get(key) {
    try {
      const data = fs.readFileSync(path.join(__dirname, 'cache', `${key}.json`), 'utf8');
      return JSON.parse(data);
    } catch (err) {
      return undefined;
    }
  },
  async set(key, value) {
    try {
      if (!fs.existsSync(path.join(__dirname, 'cache'))) {
        fs.mkdirSync(path.join(__dirname, 'cache'), { recursive: true });
      }
      fs.writeFileSync(
        path.join(__dirname, 'cache', `${key}.json`),
        JSON.stringify(value),
        'utf8'
      );
    } catch (err) {
      console.error('Error saving to storage:', err);
    }
  }
};

// Create resource object
const resource = {
  webcrypto: require('crypto').webcrypto,
  httpPort: 8080,
  debug: console.debug,
  fetch: require('node-fetch'),
  saveKey: (key) => {
    fs.writeFileSync(
      path.join(__dirname, 'connection.key'),
      JSON.stringify(key),
      'utf8'
    );
  }
};

// Create client instances
const clientWS = new ClientWS(resource);
const msgHandler = new ClientMessage(storage, { debug: console.debug });

// Connect to server
let websocket;

// Get stored key or use token authentication
const credentials = {
  proto: 'wss',
  host: 'example.com',
  port: 8081,
  user: 'username'
};

// Try to use stored key
try {
  const keyData = fs.readFileSync(path.join(__dirname, 'connection.key'), 'utf8');
  credentials.key = JSON.parse(keyData);
} catch (err) {
  // Use token-based authentication
  credentials.token = process.env.WYSEMAN_TOKEN; // Get from environment or other source
}

// Connect and use the API
async function main() {
  try {
    const uri = await clientWS.uri(credentials);
    websocket = new WebSocket(uri);
    
    websocket.on('open', () => {
      msgHandler.onOpen('connected', (data) => {
        websocket.send(data);
      });
      
      // Start using the API
      loadData();
    });
    
    websocket.on('message', (data) => {
      msgHandler.onMessage(data.toString());
    });
    
    websocket.on('close', () => {
      msgHandler.onClose();
      console.log('Connection closed. Reconnecting...');
      setTimeout(main, 5000);
    });
    
    websocket.on('error', (error) => {
      console.error('WebSocket error:', error);
      websocket.close();
    });
  } catch (error) {
    console.error('Connection error:', error);
    setTimeout(main, 5000);
  }
}

// Example data loading function
function loadData() {
  // Insert a new record
  msgHandler.request('app-insert', 'insert', {
    view: 'schema.tasks',
    fields: {
      title: 'New task',
      description: 'Task description',
      status: 'pending',
      due_date: new Date().toISOString()
    }
  }, (data, error) => {
    if (error) {
      console.error('Error creating task:', error);
      return;
    }
    console.log('Created task:', data);
    
    // Update the record
    msgHandler.request('app-update', 'update', {
      view: 'schema.tasks',
      fields: {
        status: 'in_progress'
      },
      where: {
        id: data.id
      }
    }, (updateData, updateError) => {
      if (updateError) {
        console.error('Error updating task:', updateError);
        return;
      }
      console.log('Updated task:', updateData);
    });
  });
}

// Start the application
main();
```

## API Best Practices

### Performance Considerations

1. **Cache Metadata and Language Data**
   - The Message class automatically caches metadata and language information
   - Use this cache instead of repeatedly requesting the same metadata

2. **Use Targeted Queries**
   - Request only the fields you need with the `fields` parameter
   - Use appropriate WHERE clauses to limit result sets
   - Set a reasonable LIMIT to avoid fetching too many records

3. **Minimize Round Trips**
   - Combine related operations when possible
   - Use PostgreSQL notifications for real-time updates instead of polling

4. **Connection Management**
   - Reuse connections rather than creating new ones
   - Maintain and reuse authentication keys
   - Implement reconnection with exponential backoff for reliability

### Error Handling

1. **Check for Errors in All Responses**
   - Every response may contain an error object
   - Handle errors appropriately based on their code and context

2. **Use Localized Error Messages**
   - The error.lang property contains a localized error message when available
   - Fall back to error.message for technical errors

3. **Implement Retries**
   - Implement retry logic for transient errors
   - Use backoff strategies to avoid overwhelming the server

### Security Best Practices

1. **Always Use HTTPS/WSS in Production**
   - Use secure WebSocket (wss://) and HTTPS for all production deployments
   - Never send sensitive data over unencrypted connections

2. **Manage Connection Keys Securely**
   - Store connection keys securely
   - Don't expose keys in client-side code in browser environments
   - Consider using key rotation for sensitive applications

3. **Validate All User Input**
   - Never directly insert user-provided strings into queries
   - Use parameterized queries (the Handler does this automatically)

4. **Implement Proper Authentication**
   - Use key-based authentication for persistent connections
   - Securely deliver one-time tokens for initial connections

### Additional Recommendations

1. **Listen for Notifications**
   - Use the Message.listen method to subscribe to PostgreSQL notifications
   - Update your UI when notifications arrive rather than polling

2. **Handle Connection State**
   - Register for connection status updates with the 'connect' action
   - Implement reconnection logic for network interruptions

3. **Implement Proper Cleanup**
   - Close WebSocket connections when done
   - Unregister listeners when components unmount in UI frameworks

[Prev](security-connections.md) | [TOC](README.md) | [Next](future-development.md)
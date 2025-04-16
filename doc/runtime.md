# Runtime Support

[Prev](versioning.md) | [TOC](README.md) | [Next](api-reference.md)

This document describes the runtime components of Wyseman, which provide support for both backend server applications and client applications to interact with the database schema.

## Overview

Wyseman provides several runtime components:

- Backend server integration
- Client application integration
- Database access and query handling
- Data dictionary access
- Asynchronous notifications

## Backend Server Integration

### The Wyseman Server Class

The core of the backend runtime support is the `Wyseman` class, which provides:

- WebSocket server for client connections
- Client authentication and verification
- Database connection management
- Message routing

### Server Configuration

```javascript
// Example server configuration
const wyseman = new Wyseman(
  // Database configuration
  {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    user: 'postgres'
  },
  // Socket configuration
  {
    websock: {
      port: 54321,       // WebSocket port
      credentials: ssl,  // Optional SSL configuration
      delta: 60000       // Max time delta for signature validation
    },
    actions: {           // Custom action handlers
      myCustomAction: (db, data, context) => { /* ... */ }
    }
  },
  // Admin configuration
  {
    listen: ['wyseman', 'myapp']  // Channels to listen for updates
  }
);
```

### Handler System

The Handler module processes incoming client requests and routes them to the appropriate database operations:

- Parses JSON messages from clients
- Translates them into SQL queries
- Executes queries against the database
- Returns results to clients

## Client Integration

### Client Modules

Wyseman provides several client-side modules:

- `client_ws.js`: WebSocket connection handling
- `client_msg.js`: Message handling and data caching
- `client_np.js`: (Placeholder for future noise protocol support)

### Authentication Methods

Clients can authenticate using:

1. One-time connection tokens
2. Public key cryptography with signatures

### Message Structure

Client-server communication uses JSON messages with a standardized format:

```javascript
{
  id: "unique-request-id",    // Unique identifier for this request
  action: "action-type",      // The operation to perform (select, insert, update, etc.)
  view: "table-name",         // The database object to interact with
  fields: {                   // Data fields for the operation
    field1: "value1",
    field2: "value2"
  },
  where: "field1=$1",         // SQL WHERE clause (for select/update/delete)
  values: ["value1"]          // Parameter values for the WHERE clause
}
```

## Data Dictionary Access

### Meta Data Cache

Wyseman caches data dictionary information for efficient access:

- Table and column definitions
- Field constraints and relationships
- Display preferences
- Language strings

### Language Support

Multiple languages are supported through:

- Language text files (.wmt)
- Runtime language switching
- Translation of field names, help text, and messages

## Database Interaction

### Database Client

The DbClient module provides:

- Connection pooling
- Query execution
- Transaction management
- Asynchronous notification support

### Query Building

Converting client requests to SQL queries:

- SELECT queries with conditions
- INSERT operations with field validation
- UPDATE operations with optimistic locking
- DELETE operations with constraint checking

## Asynchronous Notifications

### Notification System

PostgreSQL LISTEN/NOTIFY is used to:

- Propagate data changes to connected clients
- Update cached metadata when schema changes
- Trigger application-specific events

### Implementation

```javascript
// Server-side notification listening
db.query('LISTEN channel_name');

// Client-side subscription
client.listen('myid', 'channel_name', (data) => {
  // Handle notification data
});
```

## Example Usage

### Backend Server Example

```javascript
const { Wyseman } = require('wyseman');
const https = require('https');
const fs = require('fs');

// SSL configuration (optional)
const ssl = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
};

// Create Wyseman server
const wyseman = new Wyseman(
  {
    host: 'localhost',
    database: 'myapp'
  },
  {
    websock: {
      port: 54321,
      credentials: ssl
    }
  }
);

// Your application can use the same database connection
// for its own operations
```

### Client-Side Example

```javascript
const { Wyseman } = require('wyseman');

// Create a client
const wm = new Wyseman({
  host: 'myserver.com',
  port: 54321,
  user: 'myuser',
  database: 'myapp'
});

// Connect to the server
wm.connect()
  .then(() => {
    // Query data
    return wm.request('myQuery', 'select', {
      view: 'my_table',
      fields: ['id', 'name', 'description'],
      where: 'active=$1',
      values: [true]
    });
  })
  .then(result => {
    console.log('Query result:', result);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

## Integration with Other Systems

### Express.js Integration

Wyseman can be integrated with Express.js applications:

```javascript
const express = require('express');
const app = express();
const { Wyseman } = require('wyseman');

// Create Express app
app.use(express.json());

// Create Wyseman server
const wyseman = new Wyseman(/* config */);

// Add routes that use Wyseman
app.post('/api/data', (req, res) => {
  // Use Wyseman to handle database operations
  // ...
});

// Start the Express server
app.listen(3000);
```

## Research Tasks

- [ ] Document detailed API of all runtime modules
- [ ] Provide complete examples of common usage patterns
- [ ] Test with different Node.js and PostgreSQL versions
- [ ] Add code examples for Vue.js integration

[Prev](versioning.md) | [TOC](README.md) | [Next](api-reference.md)
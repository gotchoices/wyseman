# Security and Connection Protocols

[Prev](runtime.md) | [TOC](README.md) | [Next](api-reference.md)

This document details the security architecture and connection protocols used in Wyseman, with a particular focus on the technical implementation of the authentication mechanism.

## Security Architecture

Wyseman implements a robust security model based on asymmetric cryptography for client authentication. The system is designed to protect both the initial connection process and ongoing communication between client applications and the database server.

Key security features include:

- **Asymmetric cryptography** using ECDSA with P-521 curve
- **Multiple authentication methods** - token-based and key-based
- **Time-bound message signing** to prevent replay attacks
- **TLS encryption** for all WebSocket traffic (when using WSS protocol)
- **Origin validation** to prevent cross-site request forgery
- **Database-level permission system** that builds on PostgreSQL's security model

## WebSocket Connection Protocol

The current implementation uses WebSocket for client-server communication, with a sophisticated authentication process to ensure secure connections.

### Connection Establishment Sequence

The WebSocket connection process follows this sequence:

1. **Credential Preparation**:
   - Client generates or loads ECDSA key pair
   - Public key is formatted for transmission
   - Connection parameters are assembled

2. **Connection Request**:
   - Client constructs WebSocket URL with authentication parameters
   - Client initiates WebSocket connection to server
   - Server validates credentials before accepting connection
   - Upon successful authentication, connection is established

3. **Connection Maintenance**:
   - Client and server exchange JSON-formatted messages
   - Server forwards PostgreSQL notifications to relevant clients
   - Client handles disconnection and reconnection as needed

### Authentication Flow: Token-Based Method

Token-based authentication is typically used for initial connection:

1. **Token Generation** (on server side):
   ```javascript
   const token = await db.query("select token, expires from base.ticket_login(base.user_id($1))", [username]);
   ```

2. **Key Generation** (on client side):
   ```javascript
   const keyPair = await subtle.generateKey(KeyConfig, true, ['sign','verify']);
   const pubKey = await subtle.exportKey('jwk', keyPair.publicKey);
   const encodedPub = B64u(JSON.stringify(pubKey));
   ```

3. **Connection Request**:
   - Client connects with URL parameters: `user`, `token`, and `pub` (encoded public key)
   - Example URL: `wss://server.example.com:1025/?user=admin&token=a1b2c3&pub=eyJrZXk...`

4. **Server Validation**:
   ```javascript
   // Server validates token and stores public key
   this.adminDB.query('select base.token_valid($1,$2,$3) as valid', [user, token, pub], (err, res) => {
     let valid = (!err && res?.rows?.length >= 1) ? res.rows[0].valid : false;
     // Allow or reject connection based on result
   });
   ```
### Connection Token Generation

The backend can generate connection tokens for client use through the `base.ticket_login` function. The following is an example based on the `adminticket` utility found in wyclif:

```javascript
// Example from wyclif/bin/adminticket utility
const Wyseman = require('wyseman')
const Fs = require('fs')

// Read configuration file
const config = JSON.parse(Fs.readFileSync('./config.json'))

// Create database connection
const db = new Wyseman.DbClient(config)

// Generate token for a specific user
db.query("select * from base.token_v_ticket where token in (select token from base.ticket_login($1))", 
  ['admin'], (err, res) => {
    if (err) {
      console.error("Error generating token:", err)
      return
    }
    
    // Format token with connection information
    const ticket = {
      host: res.rows[0].host,
      port: res.rows[0].port,
      token: res.rows[0].token,
      user: 'admin',
      expires: res.rows[0].expires
    }
    
    console.log(JSON.stringify(ticket, null, 2))
    db.disconnect()
  }
)
```

This creates a one-time token that a client can use to establish their initial connection, after which they can use key-based authentication for subsequent connections.

### Authentication Flow: Key-Based Method

For subsequent connections, key-based authentication is used:

1. **Client Challenge Request**:
   ```javascript
   // Client requests a challenge message from the HTTP endpoint
   const response = await fetch(`https://server.example.com:1024/clientinfo`);
   const info = await response.json();
   ```

2. **Challenge Message Format**:
   ```javascript
   // The server returns a JSON object with client-specific information
   {
     "ip": "192.168.1.100",
     "cookie": "session=a1b2c3",
     "userAgent": "Wyseman Websocket Client API",
     "date": "2023-01-01T12:00:00.000Z"
   }
   ```

3. **Message Signing**:
   ```javascript
   // Client recreates the message in exact format for signing
   const message = JSON.stringify({ip, cookie, userAgent, date});
   
   // Sign the message with private key
   const signature = await subtle.sign(SignConfig, privateKey, encoder.encode(message));
   const encodedSign = B64u(signature);
   ```

4. **Connection Request**:
   - Client connects with URL parameters: `user`, `sign` (encoded signature), and `date`
   - Example URL: `wss://server.example.com:1025/?user=admin&sign=MIGIAkIB...&date=2023-01-01T12:00:00.000Z`

5. **Server Verification**:
   ```javascript
   // Server retrieves user's stored public key
   this.adminDB.query('select conn_pub from base.ent_v where username = $1', [user], (err, res) => {
     const pubKey = (!err && res?.rows?.length >= 1) ? res.rows[0].conn_pub : null;
     
     // Verify the signature matches the message
     Subtle.importKey('jwk', pubKey, KeyConfig, true, ['verify']).then(pub => {
       let rawSig = Buffer.from(sign, 'base64');
       let rawMsg = Buffer.from(message);
       return Subtle.verify(SignConfig, pub, rawSig, rawMsg);
     }).then(valid => {
       // Allow or reject connection based on result
     });
   });
   ```

### Cryptographic Implementation Details

The cryptographic operations use the Web Crypto API with the following configuration:

```javascript
// Key generation configuration
const KeyConfig = {
  name: 'ECDSA',
  namedCurve: 'P-521'
};

// Signature configuration
const SignConfig = {
  name: 'ECDSA',
  hash: {name: 'SHA-384'}
};
```

Key features of the cryptographic implementation:

- **ECDSA P-521 curve** provides strong security with efficient performance
- **SHA-384 hash algorithm** for message digesting before signing
- **JWK (JSON Web Key) format** for key storage and transmission
- **Base64URL encoding** for binary data transmission in URLs

### Time Synchronization and Security

To prevent replay attacks, the WebSocket authentication protocol includes time validation:

```javascript
// On the server side, current time is compared with the signature timestamp
let now = new Date();
let msgDate = new Date(date);

// Reject if time difference exceeds the configured maximum (default: 60000ms or 1 minute)
if (this.maxDelta && Math.abs(now - msgDate) > this.maxDelta)
  cb(false, 400, 'Invalid Date Stamp');
```

This mechanism has two important implications:

1. **Time synchronization** is required between client and server systems
2. **Signature expiration** means authentication attempts are only valid for a short time

## Security Considerations

### TLS Recommendations

While Wyseman supports both insecure (ws://) and secure (wss://) WebSocket connections, production deployments should always use wss:// with proper TLS certificates for several reasons:

1. **Connection data confidentiality** - prevents eavesdropping on database queries and results
2. **Authentication credential protection** - prevents signature capture and potential replay attacks
3. **Origin validation** - adds additional protection against cross-site request forgery attacks

### Key Management

The client-side key management has several important aspects:

1. **Key Storage**: Private keys can be stored by the application through the `saveKey` callback
2. **Key Rotation**: The API supports regenerating keys when needed
3. **Multi-device Usage**: The same user can have different keys on different devices
### Key Storage Model in the Database

The Wyseman key management system has the following characteristics:

1. **Key Registration**: Each user's connection key is stored in the `conn_pub` field of the `base.ent` table. This field is a JSONB type that can store various formats of public key data.

2. **Key Replacement**: When a user connects with a token and a new public key, the existing key in the database is replaced. The replacement happens in the `base.token_valid()` function:

   ```sql
   -- From base.token_valid() function:
   if (pub->'tag') notnull and (pub->'key') notnull then
     update base.ent set conn_pub[tag] = (pub->'key') where id = trec.token_ent;  -- Key with ID tag
   else
     update base.ent set conn_pub = pub where id = trec.token_ent;  -- Lone key or array of keys
   endif;
   ```

3. **Multiple Keys Per User**: The structure of the `conn_pub` field allows for two approaches:
   - A single key per user (default behavior when connecting with standard token)
   - Multiple tagged keys when the public key JSON includes a `tag` property

   This design supports scenarios like:
   - Different devices with their own connection keys
   - Different applications with separate keys for the same user
   - Key rotation while maintaining backward compatibility

4. **Key Rotation Process**: To rotate keys, a client must:
   - Obtain a new connection token (typically through an administrative channel)
   - Connect using this token along with their newly generated public key
   - The server will update the stored key(s) accordingly

It's important to note that tagged keys (using the `pub.tag` property) must be explicitly supported by client applications. Standard clients will simply replace the entire public key object when reconnecting with a token.

### Database User Integration

Wyseman's authentication system is tightly integrated with PostgreSQL's user management:

1. **Database Users as Core Identity**: Each Wyseman client connection corresponds to a database user (PostgreSQL role). These users are not managed by Wyseman itself but exist as entities within the database.

2. **User-Privilege Mapping**: The schema objects in `base.ent` and `base.priv` tables (defined in wyselib) manage the relationship between:
   - Entity records (people or organizations) with usernames
   - Database roles with specific permission levels
   - Connection privileges and public key storage

3. **Database-Level Permission Flow**:
   - When a user authenticates via WebSocket, their identity is verified
   - The connection uses their PostgreSQL role for all database operations
   - All SQL queries inherit the permissions of that database role
   - Database privileges control what tables, views, and functions the user can access

4. **Implementation Details**:
   - `base.ent` table stores entity information including usernames and public keys (`conn_pub`)
   - `base.priv` table tracks role memberships and privilege levels for each user
   - `base.token` table manages temporary connection tokens
   - Triggers automatically maintain PostgreSQL roles when entities and privileges change
   - Functions like `base.token_valid()` validate connections and update stored public keys

5. **Role-Based Access Control**:
   - Privileges are implemented as PostgreSQL roles with naming convention: `privilege_level`
   - When a privilege is granted to a user in `base.priv`, the corresponding role is granted to the PostgreSQL user
   - Example: A user with `priv='admin'` and `level=5` is granted the PostgreSQL role `admin_5`
   - Database objects (tables, views, functions) have permissions assigned to these roles
   - This provides a clean separation between authentication (who you are) and authorization (what you can do)

6. **Privilege Hierarchy**:
   - The `level` field in `base.priv` allows for numeric privilege levels (1-9)
   - Higher numbers typically indicate greater privileges
   - The `base.priv_role()` function handles privilege checking with level comparison
   - A user with level 5 of a privilege can perform actions requiring level 3, but not level 7
   - Common levels include:
     - Level 1: Basic read-only access
     - Level 5: Standard user operations
     - Level 9: Administrative capabilities

### Authentication and Authorization Flow

The complete authentication and authorization process follows this sequence:

1. **Client Authentication**:
   - Client connects to WebSocket server with credentials (token or signature)
   - Wyseman validates identity using `base.token_valid()` or signature verification
   - Upon success, the connection is established using the validated database username

2. **PostgreSQL Session Establishment**:
   - Wyseman creates a new PostgreSQL connection using the authenticated username
   - The database session inherits all roles granted to this user via `base.priv`
   - The `DbClient` instance is bound to this specific database session

3. **Request Authorization**:
   - Each SQL query runs with the privileges of the connected user
   - PostgreSQL's native permission system controls access to database objects
   - Additional application-level authorization may be implemented in database functions
   - The `base.priv_has()` function can be used in SQL to check privilege levels

4. **Automatic Role Management**:
   - When users are created in `base.ent`, corresponding database roles are created
   - When privileges are granted in `base.priv`, role grants occur automatically
   - When privileges are removed or users deleted, roles are revoked
   
This integration allows for a seamless security model where database permissions directly control what operations clients can perform through the Wyseman API.

## Planned libp2p Implementation

The next generation of Wyseman will support libp2p for peer-to-peer connections, offering several advantages:

1. **Multi-transport flexibility** - supporting TCP, WebSockets, WebRTC, and more
2. **NAT traversal capabilities** - enabling direct peer-to-peer connections
3. **Multi-addressing** - more flexible network addressing
4. **Content-addressed discovery** - finding resources by content, not location

### Design Considerations for libp2p Integration

Based on the current Wyseman authentication architecture, the libp2p implementation should consider the following:

1. **Authentication Preservation**:
   - Maintain the same two-stage authentication model (token-based initial connection, key-based subsequent connections)
   - Continue using the existing database tables (`base.ent`, `base.priv`, `base.token`) for storing user credentials and permissions
   - Adapt the challenge-response mechanism to work over libp2p protocols

2. **Key Material Integration**:
   - Utilize the existing key storage in the `conn_pub` field of `base.ent`
   - Consider using the libp2p PeerId as a key tag to support multiple connections
   - Enable migration path from WebSocket connections to libp2p connections

3. **Connection Flow Adaptation**:
   - Replace the WebSocket URL parameter authentication with libp2p connection handshake
   - Implement equivalent of `/clientinfo` endpoint for generating challenge messages
   - Support both direct connections and relayed connections through libp2p infrastructure

4. **PostgreSQL Integration**:
   - Maintain the mapping between libp2p peer identities and PostgreSQL users
   - Continue to use the PostgreSQL notification system for real-time updates
   - Ensure the same security boundary where each connection has its own database session

5. **Multiaddress Support**:
   - Generate connection tokens that include multiaddress information instead of host/port
   - Support both traditional and libp2p addressing in configuration files
   - Implement address resolution and connection prioritization logic

6. **Connection Security**:
   - Leverage libp2p's built-in transport encryption (currently libp2p-secio)
   - Continue to use ECDSA (P-521) for identity verification compatible with existing key storage
   - Incorporate libp2p's authentication capabilities with Wyseman's role-based access model

7. **Backward Compatibility**:
   - Maintain WebSocket connections for legacy clients
   - Design a unified API that abstracts the underlying transport mechanism
   - Support gradual migration of clients from WebSocket to libp2p

### Implementation Architecture

The libp2p implementation will likely involve:

```javascript
// Proposed client-side structure
class ClientP2P extends ClientBase {
  constructor(resource) {
    super(resource)
    this.libp2p = new Libp2p(libp2pOptions)
    // Initialize libp2p node with appropriate transports and security
  }
  
  // Authenticate using existing token mechanism but over libp2p
  authenticate(credentials) {
    // Similar flow to the WebSocket version, but using libp2p protocols
  }
  
  // Handle challenge-response over libp2p
  signChallenge(challenge) {
    // Similar to existing WebSocket implementation
  }
}

// Server-side handler
class WysemanP2P extends Wyseman {
  constructor(dbConf, p2pConf, adminConf) {
    super(dbConf, null, adminConf) // Don't initialize WebSocket
    
    // Initialize libp2p node
    this.node = new Libp2p(p2pOptions)
    
    // Set up protocol handlers
    this.node.handle('/wyseman/query', this.handleQuery.bind(this))
    this.node.handle('/wyseman/auth', this.handleAuth.bind(this))
    
    // Start listening
    this.node.start()
  }
  
  // Maintain same authentication and verification logic as WebSocket version
  verifyClient(peerInfo, authData) {
    // Similar to WebSocket verifyClient but adapted for libp2p
  }
}
```

This architecture preserves the security model while taking advantage of libp2p's capabilities.

> **Implementation Note**: While this approach maintains consistency with our current WebSocket authentication model, libp2p's built-in authentication mechanisms might provide alternatives that could simplify our implementation. As we move forward with implementing libp2p support, we should evaluate whether some components of our current authentication flow (like challenge-response or token-based auth) might be replaced by libp2p's native capabilities, while still maintaining the connection to our PostgreSQL role-based permission system. The goal should be to leverage libp2p's strengths while preserving the security and permission model that integrates with our database architecture.

## API and Implementation Examples

### Client-side Connection Example

```javascript
// Configure the Wyseman client
const config = {
  webcrypto: window.crypto,  // Use the browser's Web Crypto API
  httpPort: 443,             // HTTPS port for challenge requests
  listen: ['wylib'],         // PostgreSQL channels to listen to
  
  // Save the generated key
  saveKey: (keyData) => {
    localStorage.setItem('wyseman_key', JSON.stringify(keyData));
  },
  
  // Custom fetch implementation (with headers)
  fetch: (url) => {
    return fetch(url, {
      headers: {
        'User-Agent': 'Custom Client/1.0'
      }
    });
  }
};

// Create the Wyseman client and connect
const client = new ClientWS(config);
const connectionUrl = await client.uri({
  proto: 'wss',
  host: 'example.com',
  port: 5433,
  user: 'admin'
});

const ws = new WebSocket(connectionUrl);
```

### Testing Connection Security

To verify that a Wyseman WebSocket connection is properly secured:

1. **Test token validation**:
   ```bash
   # Generate an invalid token and attempt connection
   wscat -c "wss://server.example.com:1025/?user=admin&token=invalid&pub=eyJrZXk..."
   # Expected result: Connection refused (403 Invalid Login)
   ```

2. **Test timestamp validation**:
   ```bash
   # Modify the date parameter to be outside the acceptable range
   wscat -c "wss://server.example.com:1025/?user=admin&sign=MIGIAkIB...&date=2020-01-01T00:00:00.000Z"
   # Expected result: Connection refused (400 Invalid Date Stamp)
   ```

3. **Test signature validation**:
   ```bash
   # Tamper with the signature
   wscat -c "wss://server.example.com:1025/?user=admin&sign=Invalid...&date=2023-01-01T12:00:00.000Z"
   # Expected result: Connection refused (403 Invalid Login)
   ```

## Error Handling and Troubleshooting

### Common Authentication Errors

| Error Message | Possible Causes | Solutions |
|---------------|-----------------|-----------|
| Invalid Login | - Incorrect username<br>- Invalid token or signature<br>- Public key not registered | - Verify username<br>- Generate new token<br>- Reconnect with token to register key |
| Invalid Date Stamp | - Client/server time mismatch<br>- Expired signature | - Synchronize system time<br>- Request new challenge and sign again |
| No login credentials | - Missing required parameters | - Ensure URL includes all required authentication parameters |
| Error validating user | - Database error<br>- User account issues | - Check database logs<br>- Verify user exists in database |

[Prev](runtime.md) | [TOC](README.md) | [Next](api-reference.md)
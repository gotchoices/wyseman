# Security and Connection Protocols

[Prev](api-reference.md) | [TOC](README.md) | [Next](examples.md)

This document describes the connection protocols used by Wyseman for secure communication between clients and the server. It covers both the current WebSocket implementation and the planned future libp2p implementation.

## WebSocket Connection Protocol

Wyseman uses a secure WebSocket connection with public key cryptography to establish authenticated connections between clients and the server. This section explains the protocol in detail.

### Overview

The connection process involves:

1. Key generation and management
2. Authentication via token or signature
3. Establishing a secure WebSocket connection
4. Message handling and data transfer

### Server-Side Implementation

The Wyseman server sets up a WebSocket server that:

- Listens on a configurable port
- Validates client connections
- Manages database connections for authenticated users
- Routes messages between clients and the database

#### Server Initialization

```javascript
// Simplified example of server setup
const wyseman = new Wyseman(dbConfig, {
  websock: {
    port: 54321,               // WebSocket port
    credentials: sslOptions,   // Optional SSL credentials
    delta: 60000               // Max time delta for signatures (milliseconds)
  }
});
```

#### Client Verification

When a client attempts to connect, the server verifies the client's identity using one of two methods:

1. **Token-based authentication**: For new clients or password resets
2. **Signature-based authentication**: For established clients with saved keys

The verification process is triggered by the `verifyClient` method, which:

1. Extracts connection parameters from the URL query string
2. Validates the token or signature against the database
3. Associates user information with the connection if authentication succeeds

### Client-Side Implementation

The client establishes a connection through these steps:

1. **Key management**: Generate or load existing keys
2. **Authentication**: Create a signature or use a token
3. **Connection establishment**: Open a WebSocket with authentication data
4. **Message handling**: Send/receive messages over the connection

#### Key Management

For new clients, Wyseman generates an asymmetric key pair:

```javascript
// Key generation (simplified)
this.subtle.generateKey(KeyConfig, true, ['sign','verify']).then(keyPair => {
  // Store private key locally
  // Export public key for server registration
});
```

#### Connection Authentication

The client can authenticate using:

1. **One-time token**: Used for initial connection or key rotation
   ```
   wss://host:port/?user=username&token=oneTimeToken&pub=base64EncodedPublicKey
   ```

2. **Signature**: Used for regular connections
   ```
   wss://host:port/?user=username&sign=base64EncodedSignature&date=timestamp
   ```

The signature is created by:
1. Fetching client information from the server (IP, cookies, user agent)
2. Creating a JSON message with this information and a timestamp
3. Signing the message with the client's private key

#### Message Exchange

Once connected, client and server exchange JSON messages with standardized format:

```javascript
{
  id: "unique-request-id",    // UI element or message identifier
  action: "action-type",      // e.g., select, insert, update, meta
  view: "table-or-view-name", // Database object to interact with
  ...additional parameters    // Varies by action type
}
```

### Security Features

The WebSocket implementation includes several security measures:

1. **SSL/TLS encryption**: When HTTPS credentials are provided
2. **Public key authentication**: Using asymmetric cryptography
3. **Time-limited signatures**: Preventing replay attacks
4. **Token expiration**: One-time use tokens
5. **Cryptographic verification**: Of all client connections

### Data Flow

1. Client generates connection URI with authentication parameters
2. Server validates client credentials
3. WebSocket connection established
4. Client sends SQL queries as JSON
5. Server processes queries through Handler
6. Database results returned to client
7. Asynchronous notifications delivered via the same connection

## Future Implementation: libp2p Protocol

This section outlines the planned implementation of libp2p as an alternative connection protocol for Wyseman. This represents future work and serves as a placeholder in the documentation.

### Overview of libp2p

[libp2p](https://libp2p.io/) is a modular networking stack and protocol suite that allows developers to build peer-to-peer applications. It provides:

- A collection of protocols and mechanisms for different aspects of peer-to-peer networking
- Transport agnostic operation (TCP, WebSockets, QUIC, etc.)
- Built-in encryption, authentication, and peer discovery
- NAT traversal and relay capabilities

### Advantages for Wyseman

Replacing the current WebSocket implementation with libp2p would offer several benefits:

1. **Peer-to-peer communication**: Direct connections between nodes without central servers
2. **Multiple transport protocols**: Not limited to WebSockets
3. **Built-in security**: Encryption and authentication as first-class features
4. **Addressing flexibility**: Content addressing rather than location addressing
5. **NAT traversal**: Simplified connections through firewalls and NATs
6. **Resilient connectivity**: Connection relaying when direct connections aren't possible

### Planned Implementation

The libp2p implementation would:

1. Replace the current WebSocket server with a libp2p node
2. Implement secure communication channels using built-in libp2p protocols
3. Maintain the same message format for compatibility
4. Use libp2p's built-in public key infrastructure

#### Server-Side Changes

```javascript
// Conceptual server-side implementation with libp2p
const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const MPLEX = require('libp2p-mplex')
const { NOISE } = require('libp2p-noise')
const MDNS = require('libp2p-mdns')

// Create a node with the appropriate modules
const node = await Libp2p.create({
  addresses: {
    listen: ['/ip4/0.0.0.0/tcp/54321']
  },
  modules: {
    transport: [TCP],
    streamMuxer: [MPLEX],
    connEncryption: [NOISE],
    peerDiscovery: [MDNS]
  }
})

// Start listening
await node.start()

// Handle new connections
node.connectionManager.on('peer:connect', (connection) => {
  // Authenticate and establish a connection to the database
})
```

#### Client-Side Changes

```javascript
// Conceptual client-side implementation with libp2p
const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const MPLEX = require('libp2p-mplex')
const { NOISE } = require('libp2p-noise')

// Create a client node
const node = await Libp2p.create({
  modules: {
    transport: [TCP],
    streamMuxer: [MPLEX],
    connEncryption: [NOISE]
  }
})

// Connect to the server node
await node.dial('/ip4/server-address/tcp/54321/p2p/QmServerPeerId')

// Open a stream for communication
const stream = await node.dialProtocol(serverPeerId, '/wyseman/1.0.0')

// Send and receive messages over the stream
```

### Migration Path

To ensure backward compatibility during migration:

1. Both WebSocket and libp2p protocols would be supported simultaneously
2. Clients would attempt libp2p connection first, falling back to WebSockets
3. Configuration options would allow administrators to enable/disable specific protocols
4. The message format would remain the same to preserve API compatibility

### Security Considerations

libp2p offers several security advantages:

1. **Transport security**: All connections are encrypted by default
2. **Peer authentication**: Based on public key cryptography
3. **Protocol negotiation**: Secure protocol selection and version negotiation
4. **Private networking**: Support for private network overlays

### Timeline and Milestones

The implementation of libp2p in Wyseman is planned as follows:

1. Research and prototype implementation
2. Basic client-server communication
3. Authentication and security implementation
4. API compatibility layer
5. Testing and performance optimization
6. Production rollout with backward compatibility
7. Deprecation of WebSocket protocol (far future)

## Comparison of Protocols

| Feature | WebSocket | libp2p |
|---------|-----------|--------|
| Connection type | Client-server | Peer-to-peer |
| Transport protocols | WebSocket only | Multiple (TCP, WebSockets, QUIC, etc.) |
| Encryption | Application-level | Protocol-level |
| Authentication | Custom implementation | Built-in |
| NAT traversal | Limited | Built-in |
| Addressing | Location-based | Content-based |
| Connection recovery | Manual reconnection | Automatic with alternatives |
| Implementation status | Complete | Planned |

## Conclusion

The current WebSocket implementation provides a secure and reliable connection protocol for Wyseman, while the planned libp2p implementation will offer additional flexibility and resilience for future use cases. Both protocols maintain the same message format and security guarantees, ensuring a smooth transition path as development continues.

[Prev](api-reference.md) | [TOC](README.md) | [Next](examples.md)
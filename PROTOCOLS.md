# Wire Protocol

Everything that goes over the WebSocket connection — framing, serialization, message types, and RPC patterns.

---

## Overview

Every message across the wire is:

1. **Framed** by WebSocket binary frames (one message = one frame).
2. **Serialized** with [MsgPack](https://msgpack.org/) (a compact binary JSON alternative).
3. **Structured** as a 2-element array: `[FQCN, props]`.

```
  [ "PhpWebsocketRpc\\Rpc\\Contract\\ContractInvocation", { "id": "...", "service": "...", "method": "...", "params": [...] } ]
  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  Element 0: Fully-qualified class name                    Element 1: Properties (associative object)
  identifies the message type                              contains the payload data
```

Both PHP and TypeScript sides use the same format — no translation layer, no schema negotiation.

---

## 1. Message Framing

- **Transport:** WebSocket (RFC 6455).
- **Frame type:** Binary (opcode `0x02`).
- **One message per frame:** Each binary WebSocket message contains exactly one complete MsgPack-encoded payload. The WebSocket layer handles reassembly if a frame is fragmented.
- **No custom framing:** No length prefixes, no headers, no chunking.

**PHP** (`FramedConnection`):
```php
$connection->send($payload);           // encode → sendBinary
$payload = $connection->receive();     // receive → decode
```

**TypeScript** (`Connection`):
```typescript
connection.send(payload);              // encode → ws.send
const msg = await connection.receive();// ws.onmessage → decode
```

---

## 2. Serialization

**PHP** uses `msgpack_pack()` / `msgpack_unpack()`.

**TypeScript** uses the `@msgpack/msgpack` library.

Both sides agree on the same wire format: a MsgPack-encoded 2-element array.

---

## 3. The Base Format: `[FQCN, props]`

Every message is a pair of:

| Index | Type | Description |
|---|---|---|
| `0` | `string` | Fully-qualified class name identifying the message type |
| `1` | `object` | Properties as key-value pairs |

### Nested objects

If a property value is itself a typed object (like a `User` value object), it is recursively encoded as `[FQCN, props]`:

```json
["PhpWebsocketRpc\\Rpc\\Contract\\ContractResponse", {
    "id": "...",
    "result": ["PhpWebsocketRpc\\Rpc\\Auth\\User", {
        "id": "alice",
        "roles": ["customer"]
    }]
}]
```

### ID generation

Every message carries a unique 32-character hex string ID (`bin2hex(random_bytes(16))`), used to correlate requests with responses.

---

## 4. Message Types

### 4a. ContractInvocation — Call & Notify

**FQCN:** `PhpWebsocketRpc\Rpc\Contract\ContractInvocation`

Used for both **call** (expects a response) and **notify** (fire-and-forget).

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique message ID (32 hex chars) |
| `service` | `string` | Service name (short name, not FQCN) |
| `method` | `string` | Method name |
| `params` | `array` | Method arguments |

```
["PhpWebsocketRpc\\Rpc\\Contract\\ContractInvocation", {
    "id": "a1b2c3d4e5f67890fedcba0987654321",
    "service": "MathService",
    "method": "add",
    "params": [10, 5]
}]
```

### 4b. ContractResponse — Call Response (Success)

**FQCN:** `PhpWebsocketRpc\Rpc\Contract\ContractResponse`

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Matches the request ID |
| `result` | `mixed` | Return value |

```
["PhpWebsocketRpc\\Rpc\\Contract\\ContractResponse", {
    "id": "a1b2c3d4e5f67890fedcba0987654321",
    "result": 15
}]
```

### 4c. RpcResponse — Call Response (Envelope)

**FQCN:** `PhpWebsocketRpc\Rpc\Payload\RpcResponse`

Wraps success or error responses. The server sends this when an error occurs, and may also wrap success responses.

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Matches the request ID |
| `payload` | `[FQCN, props] \| null` | The success payload, if any |
| `error` | `[code, message, data, exceptionClass] \| null` | Error details, if any |

**Success:**
```
["PhpWebsocketRpc\\Rpc\\Payload\\RpcResponse", {
    "id": "a1b2c3d4e5f67890fedcba0987654321",
    "payload": ["PhpWebsocketRpc\\Rpc\\Contract\\ContractResponse", {
        "result": 15
    }],
    "error": null
}]
```

**Error:**
```
["PhpWebsocketRpc\\Rpc\\Payload\\RpcResponse", {
    "id": "a1b2c3d4e5f67890fedcba0987654321",
    "payload": null,
    "error": [-32603, "Internal error", null, "RuntimeException"]
}]
```

### 4d. ContractStreamInvocation — Open a Stream / Subscribe

**FQCN:** `PhpWebsocketRpc\Rpc\Contract\ContractStreamInvocation`

Opens a stream or subscription. The server responds with multiple `ContractStreamValue` messages and one `ContractStreamClose`.

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique message ID |
| `service` | `string` | Service name |
| `method` | `string` | Method name |
| `params` | `array` | Method arguments |
| `channelName` | `string` | Auto-generated channel ID (prefix `ctr:`) |

```
["PhpWebsocketRpc\\Rpc\\Contract\\ContractStreamInvocation", {
    "id": "c3d4e5f67890fedcba0987654321a2b3",
    "service": "NumberStreamService",
    "method": "count",
    "params": [10],
    "channelName": "ctr:d4e5f67890fedcba"
}]
```

### 4e. ContractStreamValue — Stream Data

**FQCN:** `PhpWebsocketRpc\Rpc\Contract\ContractStreamValue`

A single value yielded by a stream or subscription.

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique message ID |
| `value` | `mixed` | The stream value |
| `channelName` | `string` | Matches the stream's channel |

```
["PhpWebsocketRpc\\Rpc\\Contract\\ContractStreamValue", {
    "id": "...",
    "value": 0,
    "channelName": "ctr:d4e5f67890fedcba"
}]
```

### 4f. ContractStreamClose — Stream End

**FQCN:** `PhpWebsocketRpc\Rpc\Contract\ContractStreamClose`

Signals that a stream has ended (no more values).

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique message ID |
| `channelName` | `string` | Matches the stream's channel |

```
["PhpWebsocketRpc\\Rpc\\Contract\\ContractStreamClose", {
    "id": "...",
    "channelName": "ctr:d4e5f67890fedcba"
}]
```

### 4g. ContractPublish — Publish to a Channel

**FQCN:** `PhpWebsocketRpc\Rpc\Contract\ContractPublish`

Publishes data to a named channel (e.g., chat room). The server broadcasts to subscribers.

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique message ID |
| `service` | `string` | Service name |
| `method` | `string` | Method name |
| `data` | `mixed` | The published data |
| `channelName` | `string` | The channel name (e.g., `"chat"`) |

```
["PhpWebsocketRpc\\Rpc\\Contract\\ContractPublish", {
    "id": "e5f67890fedcba0987654321a2b3c4d5",
    "service": "ChatService",
    "method": "send",
    "data": "Hello!",
    "channelName": "chat"
}]
```

---

## 5. RPC Patterns

### 5a. Call (Request → Response)

```
Client                              Server
  │                                   │
  │ [ContractInvocation, {...}]       │
  │──────────────────────────────────>│
  │                                   │  dispatch → handler
  │                                   │
  │ [ContractResponse, {result}]      │
  │<──────────────────────────────────│
  │                                   │
```

- Client sends a `ContractInvocation`.
- Server dispatches to the registered handler.
- Server sends back `ContractResponse` (or `RpcResponse` on error).
- Client matches response to request by `id`.

### 5b. Notify (Fire-and-Forget)

```
Client                              Server
  │                                   │
  │ [ContractInvocation, {...}]       │
  │──────────────────────────────────>│
  │                                   │  dispatch → handler
  │                                   │  (no reply)
```

- Client sends a `ContractInvocation`.
- Server processes it but sends **no response**.
- The `id` is generated but never correlated.

### 5c. Stream

```
Client                              Server
  │                                   │
  │ [ContractStreamInvocation, {...}] │
  │──────────────────────────────────>│
  │                                   │  start generator
  │ [ContractStreamValue, {...}]      │
  │<──────────────────────────────────│
  │ [ContractStreamValue, {...}]      │
  │<──────────────────────────────────│
  │ ...                               │
  │ [ContractStreamClose, {...}]      │
  │<──────────────────────────────────│
```

- Client sends `ContractStreamInvocation` with an auto-generated `channelName`.
- Server yields values, each as a `ContractStreamValue` with the same `channelName`.
- Server closes with `ContractStreamClose`.
- Client correlates by `channelName`.

### 5d. Subscribe

Same wire format as Stream. The difference is semantic:

- **Stream:** Method returns `\Iterator` — values are yielded synchronously from a PHP generator.
- **Subscribe:** Method has a `callable` parameter annotated with `#[RpcSubscribe]` — the server pushes values to the callback asynchronously.

### 5e. Publish

```
Client                              Server
  │                                   │
  │ [ContractPublish, {...}]          │
  │──────────────────────────────────>│
  │                                   │  broadcast to subscribers
```

- Client sends `ContractPublish` with a `channelName`.
- Server receives it on that channel and broadcasts to all subscribers on the same channel.

---

## 6. Error Encoding

Errors are encoded as a 4-element array:

```json
[code, message, data, exceptionClass]
```

| Index | Type | Description |
|---|---|---|
| `0` | `int` | Error code (JSON-RPC compatible) |
| `1` | `string` | Human-readable message |
| `2` | `array \| null` | Optional additional data |
| `3` | `string \| null` | PHP exception FQCN (for client-side reconstruction) |

### Standard Error Codes

| Constant | Code | Meaning |
|---|---|---|
| `PARSE_ERROR` | -32700 | Failed to decode msgpack payload |
| `INVALID_REQUEST` | -32600 | Payload has unexpected structure |
| `METHOD_NOT_FOUND` | -32601 | No handler registered for this method |
| `INVALID_PARAMS` | -32602 | Type validation failed |
| `INTERNAL_ERROR` | -32603 | Handler threw an unexpected exception |
| `TIMEOUT` | -32000 | Client-side timeout waiting for response |
| `STREAM_CLOSED` | -32001 | Stream channel was closed unexpectedly |
| `AUTHENTICATION_FAILED` | -32010 | Auth token invalid/expired |
| `AUTHORIZATION_FAILED` | -32011 | Insufficient permissions |
| `TOO_MANY_REQUESTS` | -32005 | Rate limit exceeded |

### Example Error Response

```
["PhpWebsocketRpc\\Rpc\\Payload\\RpcResponse", {
    "id": "a1b2c3d4e5f67890fedcba0987654321",
    "payload": null,
    "error": [-32010, "Authentication failed", null, "PhpWebsocketRpc\\Rpc\\Exception\\AuthenticationException"]
}]
```

The TypeScript client reads the `exceptionClass` field and reconstructs the matching `RpcError` subclass with the same code.

---

## 7. Authentication Protocol

Authentication is handled through the built-in `AuthService` contract, which every client can call without authentication.

### Authenticate

**Request:**
```
["PhpWebsocketRpc\\Rpc\\Contract\\ContractInvocation", {
    "id": "f67890fedcba0987654321a2b3c4d5e6",
    "service": "PhpWebsocketRpc\\Rpc\\Contract\\AuthService",
    "method": "authenticate",
    "params": ["tok-alice"]
}]
```

**Success response:**
```
["PhpWebsocketRpc\\Rpc\\Contract\\ContractResponse", {
    "id": "f67890fedcba0987654321a2b3c4d5e6",
    "result": ["PhpWebsocketRpc\\Rpc\\Auth\\User", {
        "id": "alice",
        "roles": ["customer"]
    }]
}]
```

**Failure response:**
```
["PhpWebsocketRpc\\Rpc\\Payload\\RpcResponse", {
    "id": "f67890fedcba0987654321a2b3c4d5e6",
    "payload": null,
    "error": [-32010, "Authentication failed", null, "PhpWebsocketRpc\\Rpc\\Exception\\AuthenticationException"]
}]
```

### Logout

**Request:**
```
["PhpWebsocketRpc\\Rpc\\Contract\\ContractInvocation", {
    "id": "0987654321a2b3c4d5e6f67890fedcba",
    "service": "PhpWebsocketRpc\\Rpc\\Contract\\AuthService",
    "method": "logout",
    "params": []
}]
```

**Response:** None (void return).

### Authorization

Methods annotated with `#[NeedAuthorization]` (or `#[NeedAuthorization(roles: ['admin'])])` are checked server-side before dispatch. If the user is not authenticated, the server returns code **-32010**. If authenticated but lacks required roles, code **-32011**.

---

## 8. Message Type Summary

| FQCN | Used For | Direction |
|---|---|---|
| `PhpWebsocketRpc\Rpc\Contract\ContractInvocation` | Call request, notify | Client → Server |
| `PhpWebsocketRpc\Rpc\Contract\ContractResponse` | Call success result | Server → Client |
| `PhpWebsocketRpc\Rpc\Payload\RpcResponse` | Call result (envelope) or error | Server → Client |
| `PhpWebsocketRpc\Rpc\Contract\ContractStreamInvocation` | Open stream/subscribe | Client → Server |
| `PhpWebsocketRpc\Rpc\Contract\ContractStreamValue` | Stream value | Server → Client |
| `PhpWebsocketRpc\Rpc\Contract\ContractStreamClose` | Stream end | Server → Client |
| `PhpWebsocketRpc\Rpc\Contract\ContractPublish` | Publish to channel | Client → Server |

---

## 9. Quick Reference

### Wire format at a glance

```
WebSocket Binary Frame
  └─ MsgPack bytes
       └─ [string $fqcn, object $props]
            ├─ "id": string       (always present)
            ├─ ...type-specific props
            └─ nested objects as [fqcn, props]
```

### Common patterns

```
Call:    Client sends [ContractInvocation]  →  Server replies [ContractResponse | RpcResponse]
Notify:  Client sends [ContractInvocation]  →  No reply
Stream:  Client sends [ContractStreamInvocation]  →  Server sends 0+ [ContractStreamValue] → [ContractStreamClose]
Sub:     Client sends [ContractStreamInvocation]  →  Server sends 0+ [ContractStreamValue] → [ContractStreamClose]
Publish: Client sends [ContractPublish]  →  No reply (server broadcasts)
```

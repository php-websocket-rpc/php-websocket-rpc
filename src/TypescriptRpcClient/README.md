# @php-websocket-rpc/client

TypeScript/JavaScript RPC client for [php-websocket-rpc](https://github.com/php-websocket-rpc). Works in browsers and Node.js.

## Install

```bash
npm install @php-websocket-rpc/client
```

## Quick Start

```typescript
import { RpcClient } from '@php-websocket-rpc/client';

const client = await RpcClient.connect('ws://127.0.0.1:9502/rpc');

// ─── Call/Response ───

const math = client.createProxy({ service: 'MathService' });
const sum = await math.add(10, 5);   // 15

// ─── Notification ───

math.log('Hello!');

// ─── Streaming ───

const numbers = client.createProxy({
    service: 'NumberStreamService',
    stream: ['count'],
});

for await (const n of numbers.count(10)) {
    console.log(n); // 0, 1, 2, ... 9
}

// ─── Subscribe ───

const events = client.createProxy({
    service: 'EventService',
    subscribe: ['onEvent'],
    channel: 'events',
});

events.onEvent((event: string) => {
    console.log('Received:', event);
});

// ─── Publish ───

const chat = client.createProxy({
    service: 'ChatService',
    subscribe: ['onMessage'],
    publish: ['send'],
    channel: 'chat',
});

chat.onMessage((msg: string) => console.log(msg));
chat.send('Hello!');
```

## Browser Usage

Load the IIFE bundle directly:

```html
<script src="node_modules/@php-websocket-rpc/client/dist/browser.js"></script>
<script>
const { RpcClient } = PhpWebsocketRpc;

async function main() {
    const client = await RpcClient.connect('ws://127.0.0.1:9502/rpc');
    const math = client.createProxy({ service: 'MathService' });
    console.log(await math.add(10, 5)); // 15
}
main();
</script>
```

## Proxy Options

```typescript
interface ProxyOptions {
    /** Server-side service name (matches PHP interface name) */
    service: string;

    /** Methods that return AsyncIterable (stream pattern) */
    stream?: string[];

    /** Methods with a callback parameter (subscribe pattern) */
    subscribe?: string[];

    /** Methods that publish data (publish pattern) */
    publish?: string[];

    /** Fire-and-forget methods (notify pattern) */
    notify?: string[];

    /** Named channel for subscribe/stream/publish */
    channel?: string;

    /** Object deserialization: maps PHP FQCN → factory function */
    classMap?: Record<string, (data: Record<string, unknown>) => unknown>;
}
```

## Node.js

Install the `ws` package and pass it via options:

```typescript
import { WebSocket } from 'ws';
import { RpcClient } from '@php-websocket-rpc/client';

const client = await RpcClient.connect('wss://example.com/rpc', {
    wsImplementation: WebSocket,
    key: '...',   // mTLS client key
    cert: '...',  // mTLS client cert
    ca: '...',    // CA certificate
});
```

## Build

```bash
npm install
npm run build
```

Outputs three formats:
- `dist/index.mjs` — ES module
- `dist/index.cjs` — CommonJS
- `dist/browser.js` — IIFE (msgpack inlined, no dependencies)

## API

| Method | Description |
|--------|-------------|
| `RpcClient.connect(uri, options?)` | Connect to a WebSocket RPC server |
| `client.createProxy<T>(options)` | Create a typed proxy for a service contract |
| `client.call(service, method, params)` | Low-level RPC call |
| `client.notify(service, method, params)` | Fire-and-forget notification |
| `client.subscribe(service, method, params)` | Subscribe to a stream (returns AsyncIterable) |
| `client.publish(service, method, data, channel)` | Publish data to a channel |
| `client.close()` | Close the connection |

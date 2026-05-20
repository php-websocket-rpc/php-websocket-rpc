# @php-websocket-rpc/codegen

Generates typed TypeScript interfaces and proxy configs from PHP RPC contract interfaces annotated with `#[RpcStream]`, `#[RpcSubscribe]`, and `#[RpcPublish]`.

## Install

```bash
npm install --save-dev @php-websocket-rpc/codegen
```

## Quick Start

```bash
npx php-rpc-codegen --input src/Contracts/ --output src/generated/rpc-types.ts
```

Then use the generated types in your app:

```typescript
import { RpcClient } from '@php-websocket-rpc/client';
import { ChatServiceProxy, ChatServiceConfig } from './generated/rpc-types';

const client = await RpcClient.connect('ws://127.0.0.1:9502/rpc');
const chat = client.createProxy<ChatServiceProxy>(ChatServiceConfig);

chat.onMessage((msg) => console.log(msg));
chat.send('Hello!');
```

## CLI

```
Usage: php-rpc-codegen [options]

Options:
  -V, --version       output the version number
  -i, --input <paths...>  Input PHP file(s) or directory/glob patterns (required)
  -o, --output <path>     Output TypeScript file (required)
  -w, --watch             Watch mode — re-generate on file changes
  --no-banner             Omit the auto-generated header comment
  -h, --help              display help for command
```

## npm Scripts

```json
{
    "scripts": {
        "gen:rpc": "php-rpc-codegen --input src/Contracts/ --output src/generated/rpc-types.ts",
        "build": "npm run gen:rpc && tsc"
    }
}
```

## Input / Output

Given this PHP file:

```php
use PhpWebsocketRpc\Rpc\Contract\Attribute\RpcPublish;
use PhpWebsocketRpc\Rpc\Contract\Attribute\RpcStream;
use PhpWebsocketRpc\Rpc\Contract\Attribute\RpcSubscribe;

interface MathService
{
    public function add(int $a, int $b): int;
    public function log(string $message): void;
}

interface NumberStreamService
{
    #[RpcStream]
    public function count(int $limit): \Iterator;
}

interface EventService
{
    #[RpcSubscribe(channel: 'events', type: 'string')]
    public function onEvent(callable $callback): void;
}

interface ChatService
{
    #[RpcSubscribe('chat')]
    public function onMessage(callable $callback): void;

    #[RpcPublish('chat')]
    public function send(string $message): void;
}
```

Produces:

```typescript
import type { ProxyOptions } from '@php-websocket-rpc/client';

export interface MathServiceProxy {
    add(a: number, b: number): Promise<number>;
    log(message: string): void;
}

export interface NumberStreamServiceProxy {
    count(limit: number): AsyncIterable<number>;
}

export interface EventServiceProxy {
    onEvent(callback: (value: string) => void): void;
}

export interface ChatServiceProxy {
    onMessage(callback: (value: unknown) => void): void;
    send(message: string): void;
}

export const MathServiceConfig = {
    service: 'MathService',
    notify: ['log'],
} satisfies ProxyOptions;

export const NumberStreamServiceConfig = {
    service: 'NumberStreamService',
    stream: ['count'],
} satisfies ProxyOptions;

export const EventServiceConfig = {
    service: 'EventService',
    subscribe: ['onEvent'],
    channel: 'events',
} satisfies ProxyOptions;

export const ChatServiceConfig = {
    service: 'ChatService',
    subscribe: ['onMessage'],
    publish: ['send'],
    channel: 'chat',
} satisfies ProxyOptions;
```

## Pattern Detection

| PHP Signature | Detected Pattern | TS Return Type |
|---|---|---|
| `function f(...): T` (no attribute) | `call` | `Promise<T>` |
| `function f(...): void` (no attribute) | `notify` | `void` |
| `#[RpcStream] function f(...): \Iterator` | `stream` | `AsyncIterable<T>` |
| `#[RpcSubscribe] function f(callable): void` | `subscribe` | `void` (callback-driven) |
| `#[RpcPublish] function f(...): void` | `publish` | `void` |

## Type Mapping

| PHP | TypeScript |
|-----|-----------|
| `int` / `float` | `number` |
| `string` | `string` |
| `bool` | `boolean` |
| `void` | `void` |
| `mixed` / `object` | `unknown` |
| `array` | `unknown[]` |
| `?Type` | `Type \| null` |
| `callable` | `(...args: unknown[]) => unknown` |
| custom class | `Record<string, unknown>` |

## How It Works

The codegen uses [php-parser](https://www.npmjs.com/package/php-parser) to build a full AST from your PHP files, then walks the AST looking for interface declarations with methods. It reads PHP 8.5 attributes (`#[RpcStream]`, `#[RpcSubscribe]`, `#[RpcPublish]`) to detect the RPC pattern for each method, maps PHP types to TypeScript types, and emits ready-to-use interface definitions and config objects.

Only interface declarations are processed — class bodies, functions, and non-interface code is ignored.

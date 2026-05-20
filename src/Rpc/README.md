# php-websocket-rpc/rpc

Shared data model, serialization, middleware pipeline, and contract system for RPC over WebSocket.

This is the foundation library — both `rpc-client` and `rpc-server` depend on it.

## Install

```bash
composer require php-websocket-rpc/rpc
```

Requires PHP 8.5+ and the `msgpack` extension.

## Features

- **Payload model** — base class and kind interfaces (request, response, notification, stream open/close/data)
- **Contract system** — `ContractInvocation`, `ContractResponse`, `ContractStreamInvocation`, `ContractStreamValue`, `ContractStreamClose`, `ContractPublish`
- **PHP Attributes** — `#[RpcSubscribe]`, `#[RpcStream]`, `#[RpcPublish]` for declaring RPC patterns directly on interfaces
- **Serialization** — `ContractSerializer` encodes/decodes values for wire transmission using `[FQCN, props]` format
- **Middleware pipeline** — `MiddlewarePipeline` for chaining request/response processors
- **Stream interfaces** — `StreamChannelAware`, `StreamSubscribable` for streaming and pub/sub

## Key Classes

| Class | Purpose |
|-------|---------|
| `PhpWebsocketRpc\Rpc\Payload\Payload` | Base class for all wire payloads |
| `PhpWebsocketRpc\Rpc\Serialization\Serializer` | Msgpack serialization |
| `PhpWebsocketRpc\Rpc\Contract\ContractSerializer` | Object encoding/decoding for contract data |
| `PhpWebsocketRpc\Rpc\Contract\Attribute\RpcSubscribe` | Mark a method as subscribe pattern |
| `PhpWebsocketRpc\Rpc\Contract\Attribute\RpcStream` | Mark a method as stream pattern |
| `PhpWebsocketRpc\Rpc\Contract\Attribute\RpcPublish` | Mark a method as publish pattern |
| `PhpWebsocketRpc\Rpc\Middleware\MiddlewarePipeline` | Middleware chain |

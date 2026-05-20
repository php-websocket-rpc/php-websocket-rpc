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
- **PHP Attributes** — `#[RpcSubscribe]`, `#[RpcStream]`, `#[RpcPublish]`, `#[NeedAuthorization]` for declaring RPC patterns on interfaces
- **Serialization** — `ContractSerializer` encodes/decodes values for wire transmission using `[FQCN, props]` format
- **Middleware pipeline** — `MiddlewarePipeline` for chaining request/response processors
- **Stream interfaces** — `StreamChannelAware`, `StreamSubscribable` for streaming and pub/sub
- **Authentication** — `AuthService` contract, `WebsocketUserInterface`, `User` value object, typed auth exceptions

## Contract Attributes

| Attribute | Target | Purpose |
|-----------|--------|---------|
| `#[RpcSubscribe]` | Method | Subscribe to a named channel (receives push data) |
| `#[RpcStream]` | Method | Stream data as an async iterable |
| `#[RpcPublish]` | Method | Publish data to a named channel |
| `#[NeedAuthorization]` | Method/Class | Require authentication to access a method or entire interface |

## Authentication

### AuthService Contract

A built-in contract that all clients can use to authenticate:

```php
use PhpWebsocketRpc\Rpc\Contract\AuthService;

$auth = $client->createProxy(AuthService::class);
$user = $auth->authenticate('jwt-token-here');
// $user instanceof PhpWebsocketRpc\Rpc\Auth\User
// $user->id, $user->roles
```

### WebsocketUserInterface

```php
interface WebsocketUserInterface
{
    public function getUniqueIdentifier(): string;
    public function getRoles(): array;
}
```

### User (built-in value object)

```php
$user = new User('user-42', ['admin', 'customer']);
echo $user->id;          // 'user-42'
echo $user->roles;       // ['admin', 'customer']
```

### Error Codes

| Exception | Code | Meaning |
|-----------|------|---------|
| `AuthenticationException` | -32010 | Invalid/expired/missing token |
| `AuthorizationException` | -32011 | Insufficient permissions |

Both extend `RpcDispatchException` and carry the error code in `getRpcCode()`.

## Key Classes

| Class | Purpose |
|-------|---------|
| `PhpWebsocketRpc\Rpc\Payload\Payload` | Base class for all wire payloads |
| `PhpWebsocketRpc\Rpc\Serialization\Serializer` | Msgpack serialization |
| `PhpWebsocketRpc\Rpc\Contract\ContractSerializer` | Object encoding/decoding for contract data |
| `PhpWebsocketRpc\Rpc\Contract\Attribute\RpcSubscribe` | Mark a method as subscribe pattern |
| `PhpWebsocketRpc\Rpc\Contract\Attribute\RpcStream` | Mark a method as stream pattern |
| `PhpWebsocketRpc\Rpc\Contract\Attribute\RpcPublish` | Mark a method as publish pattern |
| `PhpWebsocketRpc\Rpc\Contract\Attribute\NeedAuthorization` | Mark a method/interface as requiring auth |
| `PhpWebsocketRpc\Rpc\Contract\AuthService` | Built-in authentication contract |
| `PhpWebsocketRpc\Rpc\Auth\WebsocketUserInterface` | Interface for authenticated user data |
| `PhpWebsocketRpc\Rpc\Auth\User` | Value object implementing WebsocketUserInterface |
| `PhpWebsocketRpc\Rpc\Exception\AuthenticationException` | Auth failure (-32010) |
| `PhpWebsocketRpc\Rpc\Exception\AuthorizationException` | Forbidden (-32011) |
| `PhpWebsocketRpc\Rpc\Middleware\MiddlewarePipeline` | Middleware chain |

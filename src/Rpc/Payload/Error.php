<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Payload;

/**
 * Error value object for RPC error responses.
 *
 * Follows JSON-RPC error conventions with custom code ranges:
 *
 *   -32700  ParseError         — Failed to decode msgpack payload
 *   -32600  InvalidRequest     — Payload has unexpected structure
 *   -32601  MethodNotFound     — No handler registered
 *   -32602  InvalidParams      — Type validation failed
 *   -32603  InternalError      — Handler threw unexpected exception
 *   -32000  Timeout            — Request timed out on the client
 *   -32001  StreamClosed       — Stream channel was closed
 *   -32005  TooManyRequests    — Rate limit exceeded
 *   -32099 … -32002            — Reserved for application-specific errors
 *
 * Wire format: [code, message, data|null, exceptionClass|null]
 * The exceptionClass field carries the FQCN of the original exception
 * thrown on the server, allowing the client to reconstruct and throw
 * the matching exception type instead of a generic RpcException.
 */
final class Error
{
    public const PARSE_ERROR = -32700;
    public const INVALID_REQUEST = -32600;
    public const METHOD_NOT_FOUND = -32601;
    public const INVALID_PARAMS = -32602;
    public const INTERNAL_ERROR = -32603;
    public const TIMEOUT = -32000;
    public const STREAM_CLOSED = -32001;
    public const TOO_MANY_REQUESTS = -32005;

    public function __construct(
        public readonly int $code,
        public readonly string $message,
        public readonly ?array $data = null,
        public readonly ?string $exceptionClass = null,
    ) {}

    /**
     * Format: [int code, string message, array|null data, string|null exceptionClass]
     *
     * @return array{int, string, array|null, string|null}
     */
    public function toArray(): array
    {
        return [$this->code, $this->message, $this->data, $this->exceptionClass];
    }

    public static function fromArray(array $data): self
    {
        return new self($data[0], $data[1], $data[2] ?? null, $data[3] ?? null); // exceptionClass (optional, added in v2)
    }
}

<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Exception;



/**
 * Thrown when authentication fails (invalid/expired/missing token).
 *
 * Carries RPC error code -32010 so the client can distinguish
 * auth failures from other errors.
 */
final class AuthenticationException extends RpcDispatchException
{
    public function __construct(
        string $message = 'Authentication failed',
        int $rpcCode = -32_010,
        ?array $data = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $rpcCode, $data, $previous);
    }
}

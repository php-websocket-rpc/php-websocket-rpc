<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Exception;



/**
 * Thrown when a user is authenticated but lacks the required permissions.
 *
 * Carries RPC error code -32011 so the client can distinguish
 * authorization failures from other errors.
 */
final class AuthorizationException extends RpcDispatchException
{
    public function __construct(
        string $message = 'Forbidden',
        int $rpcCode = -32_011,
        ?array $data = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $rpcCode, $data, $previous);
    }
}

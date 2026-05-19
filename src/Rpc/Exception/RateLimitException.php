<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Exception;

use PhpWebsocketRpc\Rpc\Payload\Error;

final class RateLimitException extends RpcDispatchException
{
    public function __construct(
        string $message = 'Too many requests',
        int $rpcCode = Error::TOO_MANY_REQUESTS,
        ?array $data = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $rpcCode, $data, $previous);
    }
}

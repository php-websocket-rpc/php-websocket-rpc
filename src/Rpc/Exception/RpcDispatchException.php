<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Exception;

use PhpWebsocketRpc\Rpc\Payload\Error;

class RpcDispatchException extends \DomainException
{
    public function __construct(
        string $message = '',
        private readonly int $rpcCode = Error::INTERNAL_ERROR,
        private readonly ?array $data = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function getRpcCode(): int
    {
        return $this->rpcCode;
    }

    public function getErrorData(): ?array
    {
        return $this->data;
    }
}

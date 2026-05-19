<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Payload;

final class RpcResponse extends Payload implements Kind\RpcResponse
{
    public function __construct(
        string $id,
        public readonly ?Payload $payload = null,
        public readonly ?Error $error = null,
    ) {
        parent::__construct();
        $this->initWithId($id);
    }

    public function isSuccess(): bool
    {
        return $this->error === null;
    }

    public function getPayload(): ?Payload
    {
        return $this->payload;
    }

    public function getError(): ?Error
    {
        return $this->error;
    }
}

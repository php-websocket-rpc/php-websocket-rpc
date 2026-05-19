<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Payload;

final class StreamClose extends Payload implements Kind\StreamClose
{
    public function __construct(
        public readonly string $channel,
    ) {
        parent::__construct();
    }

    public function channel(): string
    {
        return $this->channel;
    }
}

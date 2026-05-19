<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Stream;

interface StreamChannelAware
{
    public function channel(): string;
}

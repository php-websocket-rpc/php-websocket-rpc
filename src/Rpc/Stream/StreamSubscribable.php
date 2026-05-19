<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Stream;

use PhpWebsocketRpc\Rpc\Payload\Payload;

interface StreamSubscribable extends StreamChannelAware
{
    /**
     * The FQCN of the typed payload expected in stream data messages.
     *
     * @return class-string<Payload>
     */
    public static function streamDataClass(): string;
}

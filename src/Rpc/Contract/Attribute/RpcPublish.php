<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract\Attribute;

/**
 * Marks a contract method as a publish action.
 *
 * When called, the method arguments are sent to the server
 * as a StreamData message on the specified channel.
 *
 * Usage:
 *   #[RpcPublish('chat')]
 *   public function send(string $message): void;
 *
 * @param string $channel The named channel to publish to
 */
#[\Attribute(\Attribute::TARGET_METHOD)]
final class RpcPublish
{
    public function __construct(
        public readonly string $channel,
    ) {}
}

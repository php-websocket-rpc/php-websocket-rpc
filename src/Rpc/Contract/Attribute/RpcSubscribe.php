<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract\Attribute;

/**
 * Marks a contract method as a subscription.
 *
 * The method must have a single callable parameter and void return.
 * The callable receives data pushed from the server.
 *
 * Usage:
 *   #[RpcSubscribe(channel: 'events', type: StockPrice::class)]
 *   public function onEvent(callable $callback): void;
 *
 * @param string  $channel  Named channel ('' = auto-generated unique channel)
 * @param string|null $type Expected type of data the callback receives
 *                          (null = scalar/auto-detect from wire format)
 */
#[\Attribute(\Attribute::TARGET_METHOD)]
final class RpcSubscribe
{
    public function __construct(
        public readonly string $channel = '',
        public readonly ?string $type = null,
    ) {}
}

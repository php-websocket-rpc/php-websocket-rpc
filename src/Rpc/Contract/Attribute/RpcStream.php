<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract\Attribute;

/**
 * Marks a contract method as a streaming response.
 *
 * The method must return \Iterator (or \Generator, \Traversable, iterable).
 * Each yielded value is sent to the client as a stream message.
 *
 * Usage:
 *   #[RpcStream(type: StockPrice::class)]
 *   public function priceStream(): \Iterator;
 *
 * @param string|null $type Expected type of each yielded value
 *                          (null = scalar/auto-detect from wire format)
 */
#[\Attribute(\Attribute::TARGET_METHOD)]
final class RpcStream
{
    public function __construct(
        public readonly ?string $type = null,
    ) {}
}

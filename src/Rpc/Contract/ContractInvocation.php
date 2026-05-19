<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract;

use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;

/**
 * Wire payload for a contract-based RPC call or notification.
 *
 * Sent from client → server to invoke a method on a registered service.
 *
 * @see ContractResponse for the matching response payload.
 */
final class ContractInvocation extends Payload implements Kind\RpcRequest, Kind\Notification
{
    public function __construct(
        /** Fully qualified class name of the service interface. */
        public readonly string $service,
        /** Method name to invoke. */
        public readonly string $method,
        /** Positional arguments (scalars, arrays, or serialized objects). */
        public readonly array $params = [],
    ) {
        parent::__construct();
    }

    /**
     * @return class-string<ContractResponse>
     */
    public static function responseClass(): string
    {
        return ContractResponse::class;
    }
}

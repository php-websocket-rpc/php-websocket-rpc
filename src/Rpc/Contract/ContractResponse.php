<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract;

use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;

/**
 * Wire payload for a contract-based RPC response.
 *
 * Sent from server → client as the result of a ContractInvocation call.
 */
final class ContractResponse extends Payload implements Kind\RpcResponse
{
    public function __construct(/** The return value of the method call (may be serialized). */
        public readonly mixed $result = null,
    ) {
        parent::__construct();
    }
}

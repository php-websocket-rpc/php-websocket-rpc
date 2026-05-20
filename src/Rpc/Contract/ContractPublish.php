<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract;

use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;

/**
 * Wire payload for a contract-based publish action (client → server).
 *
 * Implements Kind\StreamData so it is routed through the existing
 * streaming infrastructure on the server side.
 *
 * Sent when a #[RpcPublish('channel')] method is called on the client proxy.
 */
final class ContractPublish extends Payload implements Kind\StreamData
{
    /**
     * The channel name to publish to.
     * Public so Payload::toArray() includes it for wire transmission.
     */
    public string $channelName = '';

    public function __construct(
        /** Fully qualified service interface name. */
        public readonly string $service,
        /** Method name to invoke on the server. */
        public readonly string $method,
        /** Encoded method arguments. */
        public readonly mixed $data = null,
        string $channelName = '',
    ) {
        parent::__construct();
        $this->channelName = $channelName;
    }

    public function channel(): string
    {
        return $this->channelName;
    }

    public static function fromArray(array $data): static
    {
        $instance = new self(
            service: $data['service'] ?? throw new \RuntimeException('ContractPublish missing service'),
            method: $data['method'] ?? throw new \RuntimeException('ContractPublish missing method'),
            data: $data['data'] ?? null,
            channelName: $data['channelName'] ?? '',
        );

        if (\array_key_exists('id', $data)) {
            $instance->initWithId($data['id']);
        }

        return $instance;
    }
}

<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract;

use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;
use PhpWebsocketRpc\Rpc\Stream\StreamSubscribable;

/**
 * Wire payload for a contract-based stream / subscribe request.
 *
 * This is sent from client → server to initiate a streaming response
 * (Iterator return type) or a subscription (callable parameter).
 * Unlike ContractInvocation (which uses Kind\RpcRequest),
 * this uses Kind\StreamOpen + StreamSubscribable to hook into
 * the existing streaming infrastructure.
 *
 * Each instance gets a unique channel name so concurrent calls
 * to the same method do not interfere.
 */
final class ContractStreamInvocation extends Payload implements Kind\StreamOpen, StreamSubscribable
{
    /**
     * Unique channel for this specific stream.
     * Public so toArray() includes it for wire transmission.
     */
    public string $channelName = '';

    public function __construct(
        /** Fully qualified class name of the service interface. */
        public readonly string $service,
        /** Method name to invoke. */
        public readonly string $method,
        /** Positional arguments (without the callable param, if any). */
        public readonly array $params = [],
    ) {
        parent::__construct();
        $this->channelName = 'ctr:' . \bin2hex(\random_bytes(8));
    }

    public function channel(): string
    {
        return $this->channelName;
    }

    /**
     * Set the channel name (used by the proxy when #[RpcSubscribe] specifies a named channel).
     */
    public function setChannel(string $channel): void
    {
        $this->channelName = $channel;
    }

    /**
     * @return class-string<ContractStreamValue>
     */
    public static function streamDataClass(): string
    {
        return ContractStreamValue::class;
    }

    /**
     * Override deserialization to preserve the client-generated channel name.
     *
     * The channel name is set by the client and must be preserved so
     * that streamed data is routed back to the correct subscription.
     */
    public static function fromArray(array $data): static
    {
        $instance = new self(
            service: $data['service'] ?? throw new \RuntimeException('ContractStreamInvocation missing service'),
            method: $data['method'] ?? throw new \RuntimeException('ContractStreamInvocation missing method'),
            params: $data['params'] ?? [],
        );

        if (isset($data['id'])) {
            $instance->initWithId($data['id']);
        }

        // Preserve the client-generated channel name for routing
        if (isset($data['channelName'])) {
            $instance->channelName = $data['channelName'];
        }

        return $instance;
    }
}

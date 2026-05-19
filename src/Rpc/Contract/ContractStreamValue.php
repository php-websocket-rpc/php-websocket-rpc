<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract;

use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;

/**
 * Wire payload for a single yielded/pushed value in a contract stream.
 *
 * Sent from server → client as part of an Iterator stream or subscription.
 *
 * channelName is a public property so Payload::toArray() includes it
 * for wire transmission; on the receiving end, fromArray() restores it.
 */
final class ContractStreamValue extends Payload implements Kind\StreamData
{
    /**
     * The channel this value belongs to.
     * Public so toArray() serializes it.
     */
    public string $channelName = '';

    public function __construct(
        /** The yielded/pushed value (scalar, array, or serialized object). */
        public readonly mixed $value = null,
    ) {
        parent::__construct();
    }

    /**
     * Set the channel name (called by ContractRegistry when dispatching).
     */
    public function setChannel(string $channel): void
    {
        $this->channelName = $channel;
    }

    public function channel(): string
    {
        return $this->channelName;
    }

    /**
     * Override deserialization to restore channelName from wire data.
     */
    public static function fromArray(array $data): static
    {
        $instance = new self(
            value: $data['value'] ?? null,
        );

        if (isset($data['id'])) {
            $instance->initWithId($data['id']);
        }

        if (isset($data['channelName'])) {
            $instance->channelName = $data['channelName'];
        }

        return $instance;
    }
}

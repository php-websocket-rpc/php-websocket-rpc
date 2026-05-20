<?php

declare(strict_types=1);

namespace PhpWebsocketRpc\Rpc\Contract;

use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;

/**
 * Wire payload signaling the end of a contract stream.
 *
 * Sent from server → client when an Iterator is exhausted or
 * a subscription is terminated.
 *
 * channelName is public so Payload::toArray() includes it for routing.
 */
final class ContractStreamClose extends Payload implements Kind\StreamClose
{
    /**
     * The channel being closed.
     * Public so toArray() serializes it for client-side routing.
     */
    public string $channelName = '';

    public function __construct()
    {
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
        $instance = new self();

        if (\array_key_exists('id', $data)) {
            $instance->initWithId($data['id']);
        }

        if (\array_key_exists('channelName', $data)) {
            $instance->channelName = $data['channelName'];
        }

        return $instance;
    }
}

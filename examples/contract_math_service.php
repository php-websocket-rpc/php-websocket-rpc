<?php

/**
 * Contract-based RPC example — shared service interface and implementation.
 *
 * This file defines the interfaces and implementations used by both
 * server and client examples.
 *
 * Uses PHP attributes to declare channel names and types for
 * subscribe, stream, and publish patterns.
 */

use PhpWebsocketRpc\Rpc\Contract\Attribute\RpcPublish;
use PhpWebsocketRpc\Rpc\Contract\Attribute\RpcStream;
use PhpWebsocketRpc\Rpc\Contract\Attribute\RpcSubscribe;

// ─── Service Interfaces (Contracts) ──────────────────────────────

interface MathService
{
    public function add(int $a, int $b): int;
    public function sub(int $a, int $b): int;
    public function mul(int $a, int $b): int;

    /** Fire-and-forget: no return value */
    public function log(string $message): void;
}

interface NumberStreamService
{
    #[RpcStream]
    public function count(int $limit): \Iterator;
}

interface EventService
{
    #[RpcSubscribe(channel: 'events', type: 'string')]
    public function onEvent(callable $callback): void;
}

interface ChatService
{
    #[RpcSubscribe('chat')]
    public function onMessage(callable $callback): void;

    #[RpcPublish('chat')]
    public function send(string $message): void;
}

// ─── Service Implementations ─────────────────────────────────────

class MathServiceImpl implements MathService
{
    private array $log = [];

    public function add(int $a, int $b): int
    {
        return $a + $b;
    }

    public function sub(int $a, int $b): int
    {
        return $a - $b;
    }

    public function mul(int $a, int $b): int
    {
        return $a * $b;
    }

    public function log(string $message): void
    {
        $this->log[] = $message;
        echo "[MathService] Log: $message\n";
    }

    public function getLog(): array
    {
        return $this->log;
    }
}

class NumberStreamServiceImpl implements NumberStreamService
{
    /**
     * @return \Iterator<int>
     */
    public function count(int $limit): \Iterator
    {
        for ($i = 0; $i < $limit; $i++) {
            yield $i;
        }
    }
}

class EventServiceImpl implements EventService
{
    /** @var array<callable> */
    private array $callbacks = [];

    public function onEvent(callable $callback): void
    {
        $id = \count($this->callbacks);
        $this->callbacks[] = $callback;
        echo "[EventService] Subscriber #$id registered\n";
    }

    /**
     * Simulate events by pushing to all registered callbacks.
     */
    public function trigger(string $event): void
    {
        echo "[EventService] Triggering event: $event\n";
        foreach ($this->callbacks as $callback) {
            $callback($event);
        }
    }

    public function subscriberCount(): int
    {
        return \count($this->callbacks);
    }
}

class ChatServiceImpl implements ChatService
{
    /** @var array<callable> */
    private array $messageCallbacks = [];

    /** @var array<string> */
    private array $messages = [];

    public function onMessage(callable $callback): void
    {
        $this->messageCallbacks[] = $callback;
        echo "[ChatService] Client subscribed to chat\n";
    }

    public function send(string $message): void
    {
        $this->messages[] = $message;
        echo "[ChatService] Received publish: $message\n";

        // Broadcast to all subscribers
        foreach ($this->messageCallbacks as $push) {
            $push("Echo: $message");
        }
    }

    /** @return array<string> */
    public function getMessages(): array
    {
        return $this->messages;
    }

    public function subscriberCount(): int
    {
        return \count($this->messageCallbacks);
    }
}

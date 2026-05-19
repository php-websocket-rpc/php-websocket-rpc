<?php

/**
 * Contract-based RPC client example.
 *
 * Demonstrates all 5 patterns:
 *   1. Call/Response  ($math->add, $math->sub, $math->mul)
 *   2. Notification   ($math->log)
 *   3. Streaming      ($numbers->count)
 *   4. Subscribe      ($events->onEvent)
 *   5. Publish        ($chat->send) + Subscribe ($chat->onMessage)
 *
 * Run after starting contract_server.php:
 *   php examples/contract_client.php
 */

declare(strict_types=1);

use PhpWebsocketRpc\RpcClient\Client\RpcClient;

require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/contract_math_service.php';

try {
    // ─── Connect ──────────────────────────────────────────────

    echo "Connecting to ws://127.0.0.1:9502/rpc...\n";
    $client = RpcClient::connect('ws://127.0.0.1:9502/rpc');
    echo "✓ Connected\n\n";

    // ─── 1. Call/Response ─────────────────────────────────────

    echo "═══ Call/Response Pattern ═══\n";
    $math = $client->createProxy(MathService::class);

    $result = $math->add(10, 5);
    echo "math->add(10, 5) = $result\n";
    \assert($result === 15, 'add(10, 5) should be 15');

    $result = $math->sub(10, 5);
    echo "math->sub(10, 5) = $result\n";
    \assert($result === 5, 'sub(10, 5) should be 5');

    $result = $math->mul(3, 4);
    echo "math->mul(3, 4) = $result\n";
    \assert($result === 12, 'mul(3, 4) should be 12');

    echo "\n";

    // ─── 2. Notification ──────────────────────────────────────

    echo "═══ Notification Pattern ═══\n";
    $math->log('Hello from client!');
    $math->log('This is a fire-and-forget notification');
    echo "Notified (no response expected)\n\n";

    // ─── 3. Streaming ─────────────────────────────────────────

    echo "═══ Streaming Pattern ═══\n";
    $numbers = $client->createProxy(NumberStreamService::class);

    $collected = [];
    foreach ($numbers->count(10) as $value) {
        $collected[] = $value;
        echo "  Received: $value\n";
    }
    echo "Collected: [" . \implode(', ', $collected) . "]\n";
    \assert($collected === [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'Should get numbers 0-9');
    echo "✓ Stream complete\n\n";

    // ─── 4. Subscription ──────────────────────────────────────

    echo "═══ Subscription Pattern ═══\n";
    $events = $client->createProxy(EventService::class);

    $received = [];
    $events->onEvent(function (string $event) use (&$received): void {
        $received[] = $event;
        echo "  Callback received: $event\n";
    });

    // Wait for some events to arrive
    echo "Waiting for events (5 seconds)...\n";
    \Amp\delay(5.0);

    echo "Received " . \count($received) . " events: [" . \implode(', ', $received) . "]\n";
    echo "✓ Subscription complete\n\n";

    // ─── 5. Publish + Subscribe (Chat) ────────────────────────

    echo "═══ Chat: Publish + Subscribe ═══\n";
    $chat = $client->createProxy(ChatService::class);

    $chatMessages = [];
    $chat->onMessage(function (string $msg) use (&$chatMessages): void {
        $chatMessages[] = $msg;
        echo "  Chat received: $msg\n";
    });

    // Publish a message — server echoes it back to all subscribers
    $chat->send('Hello via publish!');

    // Wait for the echo to arrive
    echo "Waiting for chat echo...\n";
    \Amp\delay(1.0);

    echo "Chat messages received: " . \count($chatMessages) . "\n";
    foreach ($chatMessages as $msg) {
        echo "  - $msg\n";
    }
    echo "✓ Chat complete\n\n";

    // ─── Cleanup ──────────────────────────────────────────────

    $client->close();
    echo "✓ Connection closed\n";
    echo "\nAll contract patterns verified successfully!\n";

} catch (\Throwable $e) {
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}

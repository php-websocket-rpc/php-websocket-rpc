<?php

declare(strict_types=1);

/**
 * Example: RPC WebSocket Client
 *
 * Run with:
 *   php examples/client.php
 *
 * This shows:
 *   - Typed async RPC calls (call returns Future, user awaits)
 *   - Fire-and-forget notifications
 *   - Stream subscription (server push)
 *   - Stream publish (chat broadcast)
 */

use PhpWebsocketRpc\RpcClient\Client\RpcClient;
use PhpWebsocketRpc\RpcClient\Client\ClientException;
use PhpWebsocketRpc\Rpc\Payload\Error;
use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;
use PhpWebsocketRpc\Rpc\Stream\StreamChannelAware;
use PhpWebsocketRpc\Rpc\Stream\StreamSubscribable;

require __DIR__ . '/../vendor/autoload.php';

// ─── Domain Exceptions (shared, must match server) ───────────

/**
 * Must match the server's DivisionByZeroException exactly (same FQCN).
 * The framework reconstructs this exception on the client from the
 * error response, allowing typed catch blocks.
 *
 * Uses the same constructor signature pattern as RpcException:
 *   (string $message, int $code, ?array $data)
 */
class DivisionByZeroException extends \RuntimeException
{
    public function __construct(
        string $message = '',
        private readonly int $rpcCode = 0,
        private readonly ?array $data = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function getRpcCode(): int { return $this->rpcCode; }
    public function getErrorData(): ?array { return $this->data; }
}

// ─── 1. Define Domain Classes (same as server for demo) ─────

class MathAddRequest extends Payload implements Kind\RpcRequest
{
    public function __construct(
        public readonly int $a,
        public readonly int $b,
    ) {
        parent::__construct();
    }

    public static function responseClass(): string
    {
        return MathAddResponse::class;
    }
}

class MathAddResponse extends Payload implements Kind\RpcResponse
{
    public function __construct(public readonly int $sum)
    {
        parent::__construct();
    }
}

class MathDivideRequest extends Payload implements Kind\RpcRequest
{
    public function __construct(
        public readonly float $x,
        public readonly float $y,
    ) {
        parent::__construct();
    }

    public static function responseClass(): string
    {
        return MathDivideResponse::class;
    }
}

class MathDivideResponse extends Payload implements Kind\RpcResponse
{
    public function __construct(public readonly float $result)
    {
        parent::__construct();
    }
}

class UserLoggedIn extends Payload implements Kind\Notification
{
    public function __construct(
        public readonly int $userId,
        public readonly string $username,
    ) {
        parent::__construct();
    }
}

class SubscribeOrders extends Payload implements Kind\StreamOpen, StreamSubscribable
{
    public function __construct(?string $filter = null)
    {
        parent::__construct();
    }

    public static function channel(): string { return 'orders'; }
    public static function streamDataClass(): string { return OrderEvent::class; }
}

class OrderEvent extends Payload implements Kind\StreamData, StreamChannelAware
{
    public function __construct(
        public readonly int $orderId,
        public readonly string $status,
        public readonly float $amount,
    ) {
        parent::__construct();
    }

    public static function channel(): string { return 'orders'; }
}

class ChatMessage extends Payload implements Kind\StreamData, StreamChannelAware
{
    public function __construct(
        public readonly string $user,
        public readonly string $text,
    ) {
        parent::__construct();
    }

    public static function channel(): string { return 'chat'; }
}

// ─── 2. Connect ──────────────────────────────────────────────

echo "Connecting to ws://127.0.0.1:9501/rpc...\n";
$client = RpcClient::connect('ws://127.0.0.1:9501/rpc');
echo "Connected.\n\n";

// ─── 3. Async RPC Call ──────────────────────────────────────

echo "=== Async RPC: math.add ===\n";
$future = $client->call(new MathAddRequest(a: 40, b: 2));

// Do other work while waiting...
echo "Doing other work while waiting for result...\n";

$response = $future->await();
\assert($response instanceof MathAddResponse);
echo "40 + 2 = {$response->sum}\n\n";

// ─── 4. Another Async RPC Call ──────────────────────────────

echo "=== Async RPC: math.divide ===\n";
$future = $client->call(new MathDivideRequest(x: 100, y: 7));

echo "Doing other work while waiting for result...\n";

$response = $future->await();
\assert($response instanceof MathDivideResponse);
echo "100 / 7 = {$response->result}\n\n";

// ─── 5. Error Handling ──────────────────────────────────────

echo "=== Error Handling: division by zero ===\n";
try {
    $client->call(new MathDivideRequest(x: 10, y: 0))->await();
} catch (DivisionByZeroException $e) {
    // We caught the exact exception type that was thrown on the server!
    echo "Typed exception caught: DivisionByZeroException\n";
    echo "  Message: {$e->getMessage()}\n";
    echo "  RPC Code: {$e->getRpcCode()}\n";
    echo "  Data: " . \json_encode($e->getErrorData()) . "\n";
} catch (ClientException $e) {
    // Fallback for older clients or if the exception class doesn't match
    echo "RPC Error [{$e->getRpcCode()}]: {$e->getMessage()}\n";
    if ($e->getErrorData() !== null) {
        echo "Error data: " . \json_encode($e->getErrorData()) . "\n";
    }
}
echo "\n";

// ─── 6. Notification (fire-and-forget) ──────────────────────

echo "=== Notification: user.logged_in ===\n";
$client->notify(new UserLoggedIn(userId: 42, username: 'alice'));
echo "Notification sent (no response expected).\n\n";

// ─── 7. Subscribe to Server Stream ──────────────────────────

echo "=== Subscribe to orders stream ===\n";
$orders = $client->subscribe(new SubscribeOrders(filter: 'active'));

// Listen for order events in a separate fiber
\Amp\async(function () use ($orders): void {
    $count = 0;
    foreach ($orders as $event) {
        \assert($event instanceof OrderEvent);
        echo "[Stream] Order #{$event->orderId}: {$event->status} \${$event->amount}\n";
        $count++;

        if ($count >= 3) {
            echo "[Stream] Got 3 events, unsubscribing.\n";
            $orders->complete();
            break;
        }
    }
});

// ─── 8. Publish to Chat Stream ──────────────────────────────

echo "\n=== Publishing chat messages ===\n";
$client->publish(new ChatMessage(user: 'alice', text: 'Hello from RPC WebSocket!'));
$client->publish(new ChatMessage(user: 'alice', text: 'This is fully typed PHP objects over msgpack.'));

// ─── 9. Wait a bit for stream data to arrive ────────────────

echo "\nWaiting for stream data...\n";
\Amp\delay(7.0);

// ─── 10. Close ──────────────────────────────────────────────

echo "\nClosing client...\n";
$client->close();
echo "Done.\n";

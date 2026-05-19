<?php

declare(strict_types=1);

/**
 * Example: RPC WSS (Secure WebSocket) Client
 *
 * Run with:
 *   php examples/client_wss.php
 *
 * Connects to the WSS server with a custom connector that
 * disables SSL certificate verification for self-signed certs.
 *
 * The server must be running:
 *   php examples/server_wss.php
 */

use Amp\Http\Client\Connection\DefaultConnectionFactory;
use Amp\Http\Client\Connection\UnlimitedConnectionPool;
use Amp\Http\Client\HttpClientBuilder;
use Amp\Socket\ClientTlsContext;
use Amp\Socket\ConnectContext;
use Amp\Websocket\Client\Rfc6455Connector;
use PhpWebsocketRpc\RpcClient\Client\RpcClient;
use PhpWebsocketRpc\RpcClient\Client\ClientException;
use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;
use PhpWebsocketRpc\Rpc\Stream\StreamChannelAware;
use PhpWebsocketRpc\Rpc\Stream\StreamSubscribable;

require __DIR__ . '/../vendor/autoload.php';

// ─── Domain Exceptions (shared, must match server) ───────────

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

// ─── 1. Define Domain Classes (same as client.php) ───────────

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

// ─── 2. Create Custom WSS Connector ───────────────────────────

/**
 * Create a WebsocketConnector that skips SSL certificate verification.
 *
 * This is necessary for self-signed certificates. In production with
 * properly-signed certificates from a trusted CA, you would NOT
 * disable verification — just use RpcClient::connect('wss://...').
 */
function createInsecureWssConnector(): \Amp\Websocket\Client\WebsocketConnector
{
    // Disable SSL peer verification (accept self-signed certs)
    $tlsContext = (new ClientTlsContext(''))
        ->withoutPeerVerification();

    $connectContext = (new ConnectContext())
        ->withTlsContext($tlsContext);

    // Create an HTTP connection factory with the custom TLS context
    $connectionFactory = new DefaultConnectionFactory(
        connectContext: $connectContext,
    );

    // Build an HTTP client using that connection pool
    $pool = new UnlimitedConnectionPool($connectionFactory);
    $httpClient = (new HttpClientBuilder())
        ->usingPool($pool)
        ->build();

    // Create the WebSocket connector with the custom HTTP client
    return new Rfc6455Connector(
        httpClient: $httpClient,
    );
}

// ─── 3. Connect via WSS ──────────────────────────────────────

echo "Connecting to wss://127.0.0.1:9504/rpc (self-signed cert)...\n";
$connector = createInsecureWssConnector();
$client = RpcClient::connect('wss://127.0.0.1:9504/rpc', $connector);
echo "Connected securely via WSS.\n\n";

// ─── 4. Async RPC Call ───────────────────────────────────────

echo "=== Async RPC: math.add ===\n";
$response = $client->call(new MathAddRequest(a: 40, b: 2))->await();
\assert($response instanceof MathAddResponse);
echo "40 + 2 = {$response->sum}\n\n";

// ─── 5. Another Async RPC Call ──────────────────────────────

echo "=== Async RPC: math.divide ===\n";
$future = $client->call(new MathDivideRequest(x: 100, y: 7));

echo "Doing other work while waiting for result...\n";
$response = $future->await();
\assert($response instanceof MathDivideResponse);
echo "100 / 7 = {$response->result}\n\n";

// ─── 6. Error Handling ──────────────────────────────────────

echo "=== Error Handling: division by zero ===\n";
try {
    $client->call(new MathDivideRequest(x: 10, y: 0))->await();
} catch (DivisionByZeroException $e) {
    echo "Typed exception caught: DivisionByZeroException\n";
    echo "  Message: {$e->getMessage()}\n";
    echo "  RPC Code: {$e->getRpcCode()}\n";
    echo "  Data: " . \json_encode($e->getErrorData()) . "\n";
} catch (ClientException $e) {
    echo "RPC Error [{$e->getRpcCode()}]: {$e->getMessage()}\n";
    if ($e->getErrorData() !== null) {
        echo "Error data: " . \json_encode($e->getErrorData()) . "\n";
    }
}
echo "\n";

// ─── 7. Notification ─────────────────────────────────────────

echo "=== Notification: user.logged_in ===\n";
$client->notify(new UserLoggedIn(userId: 42, username: 'alice'));
echo "Notification sent (no response expected).\n\n";

// ─── 8. Subscribe to Server Stream ───────────────────────────

echo "=== Subscribe to orders stream ===\n";
$orders = $client->subscribe(new SubscribeOrders(filter: 'active'));

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

// ─── 9. Publish to Chat Stream ───────────────────────────────

echo "\n=== Publishing chat messages ===\n";
$client->publish(new ChatMessage(user: 'alice', text: 'Hello over WSS!'));
$client->publish(new ChatMessage(user: 'alice', text: 'This is fully typed PHP objects over encrypted msgpack.'));

// ─── 10. Wait for stream data ────────────────────────────────

echo "\nWaiting for stream data...\n";
\Amp\delay(7.0);

// ─── 11. Close ───────────────────────────────────────────────

echo "\nClosing client...\n";
$client->close();
echo "Done.\n";

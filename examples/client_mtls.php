<?php

declare(strict_types=1);

/**
 * Example: mTLS (Mutual TLS) RPC WebSocket Client
 *
 * Run with:
 *   php examples/client_mtls.php
 *
 * Connects to the mTLS server using:
 *   1. Client certificate signed by the trusted CA
 *   2. Verifies the server certificate against the same CA
 *
 * The server must be running:
 *   php examples/server_mtls.php
 */

use Amp\Http\Client\Connection\DefaultConnectionFactory;
use Amp\Http\Client\Connection\UnlimitedConnectionPool;
use Amp\Http\Client\HttpClientBuilder;
use Amp\Socket\Certificate;
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

// ─── 1. Certificate Paths ───────────────────────────────────

$certDir = __DIR__ . '/certs/mtls';
$caCert     = "$certDir/ca.crt";
$clientCert = "$certDir/client.crt";
$clientKey  = "$certDir/client.key";

foreach ([$caCert, $clientCert, $clientKey] as $f) {
    if (!\file_exists($f)) {
        \fwrite(\STDERR, "ERROR: Missing certificate: $f\n");
        \fwrite(\STDERR, "Run: bash examples/certs/mtls/generate.sh\n");
        exit(1);
    }
}

// ─── 2. Define Domain Classes ───────────────────────────────

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

// ─── 3. Create mTLS Connector ───────────────────────────────

/**
 * Create a WebsocketConnector that:
 *  - Presents the client certificate for mTLS authentication
 *  - Verifies the server certificate against the trusted CA
 *
 * In production, replace with your real CA-signed certificates.
 */
function createMtlsConnector(): \Amp\Websocket\Client\WebsocketConnector
{
    global $caCert, $clientCert, $clientKey;

    // Configure client TLS:
    //   1. Present client certificate for mutual auth
    //   2. Verify server cert against our CA (not self-signed)
    $tlsContext = (new ClientTlsContext('localhost'))
        ->withCertificate(new Certificate($clientCert, $clientKey))
        ->withCaFile($caCert)           // Trust server certs signed by CA
        ->withPeerNameVerification(true) // Verify server CN matches
        ->withPeerVerification(true);    // Verify server certificate

    $connectContext = (new ConnectContext())
        ->withTlsContext($tlsContext);

    $connectionFactory = new DefaultConnectionFactory(
        connectContext: $connectContext,
    );

    $pool = new UnlimitedConnectionPool($connectionFactory);
    $httpClient = (new HttpClientBuilder())
        ->usingPool($pool)
        ->build();

    return new Rfc6455Connector(
        httpClient: $httpClient,
    );
}

// ─── 4. Connect via mTLS ───────────────────────────────────

$uri = 'wss://127.0.0.1:9505/rpc';
echo "Connecting to {$uri} (mTLS)...\n";

$connector = createMtlsConnector();
$client = RpcClient::connect($uri, $connector);

echo "Connected with mutual TLS authentication.\n\n";

// ─── 5. Verify mTLS Client Identity on Server ──────────────

echo "=== Async RPC (math.add) — server sees client CN ===\n";
$response = $client->call(new MathAddRequest(a: 40, b: 2))->await();
\assert($response instanceof MathAddResponse);
echo "40 + 2 = {$response->sum}\n\n";

// ─── 6. Another Async RPC ─────────────────────────────────

echo "=== Async RPC: math.divide ===\n";
$future = $client->call(new MathDivideRequest(x: 100, y: 7));
echo "Doing other work while waiting...\n";
$response = $future->await();
\assert($response instanceof MathDivideResponse);
echo "100 / 7 = {$response->result}\n\n";

// ─── 7. Error Handling ────────────────────────────────────

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

// ─── 8. Notification ──────────────────────────────────────

echo "=== Notification: user.logged_in ===\n";
$client->notify(new UserLoggedIn(userId: 42, username: 'alice'));
echo "Notification sent.\n\n";

// ─── 9. Subscribe / Publish ───────────────────────────────

echo "=== Subscribe to orders stream ===\n";
$orders = $client->subscribe(new SubscribeOrders(filter: 'active'));

\Amp\async(function () use ($orders): void {
    $count = 0;
    foreach ($orders as $event) {
        \assert($event instanceof OrderEvent);
        echo "[Stream] Order #{$event->orderId}: {$event->status} \${$event->amount}\n";
        if (++$count >= 3) {
            echo "[Stream] Got 3 events, unsubscribing.\n";
            $orders->complete();
            break;
        }
    }
});

echo "\n=== Publishing chat messages ===\n";
$client->publish(new ChatMessage(user: 'alice', text: 'Hello over mTLS!'));
$client->publish(new ChatMessage(user: 'alice', text: 'Both sides are verified.'));
$client->publish(new ChatMessage(user: 'alice', text: 'Encryption + authentication complete.'));

echo "\nWaiting for stream data...\n";
\Amp\delay(7.0);

// ─── 10. Close ────────────────────────────────────────────

echo "\nClosing client...\n";
$client->close();
echo "Done.\n";

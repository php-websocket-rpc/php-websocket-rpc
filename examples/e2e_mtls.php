<?php

declare(strict_types=1);

/**
 * End-to-end mTLS test.
 *
 * Starts the mTLS server, connects a client, runs all RPC operations
 * with assertions, and cleans up.
 *
 * Run:
 *   php examples/e2e_mtls.php
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

$exitCode = 0;

// ─── Domain Exceptions (must match server) ───────────────────

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

// ─── Domain Classes ──────────────────────────────────────────

class MathAddRequest extends Payload implements Kind\RpcRequest
{
    public function __construct(
        public readonly int $a,
        public readonly int $b,
    ) {
        parent::__construct();
    }
    public static function responseClass(): string { return MathAddResponse::class; }
}

class MathAddResponse extends Payload implements Kind\RpcResponse
{
    public function __construct(public readonly int $sum) { parent::__construct(); }
}

class MathDivideRequest extends Payload implements Kind\RpcRequest
{
    public function __construct(
        public readonly float $x,
        public readonly float $y,
    ) {
        parent::__construct();
    }
    public static function responseClass(): string { return MathDivideResponse::class; }
}

class MathDivideResponse extends Payload implements Kind\RpcResponse
{
    public function __construct(public readonly float $result) { parent::__construct(); }
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

class SubscribeOrders extends Payload implements Kind\StreamOpen
{
    public function __construct(?string $filter = null) { parent::__construct(); }
    public static function channel(): string { return 'orders'; }
    public static function streamDataClass(): string { return OrderEvent::class; }
}

class OrderEvent extends Payload implements Kind\StreamData
{
    public function __construct(
        public readonly int $orderId,
        public readonly string $status,
        public readonly float $amount,
    ) { parent::__construct(); }
    public static function channel(): string { return 'orders'; }
}

class ChatMessage extends Payload implements Kind\StreamData
{
    public function __construct(
        public readonly string $user,
        public readonly string $text,
    ) { parent::__construct(); }
    public static function channel(): string { return 'chat'; }
}

// ─── Helpers ─────────────────────────────────────────────────

function pass(string $label): void
{
    echo "  ✅ {$label}\n";
}

function fail(string $label, string $detail = ''): void
{
    global $exitCode;
    $exitCode = 1;
    echo "  ❌ {$label}" . ($detail ? ": {$detail}" : '') . "\n";
}

function assert_eq(mixed $expected, mixed $actual, string $label): void
{
    if ($expected === $actual) {
        pass($label);
    } else {
        fail($label, "expected=" . \var_export($expected, true) . ", actual=" . \var_export($actual, true));
    }
}

function assert_instanceof(string $class, mixed $value, string $label): void
{
    if ($value instanceof $class) {
        pass($label);
    } else {
        fail($label, "expected instanceof {$class}, got " . ($value::class ?? 'null'));
    }
}

// ─── Start mTLS Server ──────────────────────────────────────

echo "═══ E2E mTLS Test ═══\n\n";

$serverPath = __DIR__ . '/server_mtls.php';
$serverLog = \tempnam(\sys_get_temp_dir(), 'mtls_server_');

echo "Starting mTLS server...\n";
$serverProc = \proc_open(
    ['php', $serverPath],
    [
        0 => ['pipe', 'r'],   // stdin
        1 => ['file', $serverLog, 'a'], // stdout
        2 => ['file', $serverLog, 'a'], // stderr
    ],
    $pipes,
    __DIR__ . '/..',
);

if ($serverProc === false) {
    \fwrite(\STDERR, "Failed to start server\n");
    exit(1);
}

// Close stdin immediately
\fclose($pipes[0]);

// Wait for server to be ready (poll port 9505)
echo "Waiting for server to be ready...\n";
$ready = false;
for ($i = 0; $i < 20; $i++) {
    \usleep(250000); // 250ms
    $sock = @\fsockopen('tcp://127.0.0.1', 9505, $errno, $errstr, 1);
    if ($sock !== false) {
        \fclose($sock);
        $ready = true;
        break;
    }
}

if (!$ready) {
    \fwrite(\STDERR, "Server did not start in time\n");
    \proc_close($serverProc);
    exit(1);
}

echo "Server is ready.\n\n";

// ─── Create mTLS Connector ──────────────────────────────────

$certDir = __DIR__ . '/certs/mtls';
$caCert     = "$certDir/ca.crt";
$clientCert = "$certDir/client.crt";
$clientKey  = "$certDir/client.key";

$tlsContext = (new ClientTlsContext('localhost'))
    ->withCertificate(new Certificate($clientCert, $clientKey))
    ->withCaFile($caCert)
    ->withPeerNameVerification(true)
    ->withPeerVerification(true);

$connectContext = (new ConnectContext())
    ->withTlsContext($tlsContext);

$connectionFactory = new DefaultConnectionFactory(
    connectContext: $connectContext,
);

$pool = new UnlimitedConnectionPool($connectionFactory);
$httpClient = (new HttpClientBuilder())
    ->usingPool($pool)
    ->build();

$connector = new Rfc6455Connector(
    httpClient: $httpClient,
);

// ─── Connect ─────────────────────────────────────────────────

echo "Connecting via mTLS...\n";

try {
    $client = RpcClient::connect('wss://127.0.0.1:9505/rpc', $connector);
    pass("mTLS connection established");
} catch (\Throwable $e) {
    fail("mTLS connection", $e->getMessage());
    \proc_close($serverProc);
    exit(1);
}

echo "\n";

// ─── Test 1: Async RPC Call ─────────────────────────────────

echo "─── Test 1: Async RPC (math.add) ───\n";
try {
    $future = $client->call(new MathAddRequest(a: 40, b: 2));
    assert_instanceof(\Amp\Future::class, $future, 'call() returns Future');

    $response = $future->await();
    assert_instanceof(MathAddResponse::class, $response, 'response type is MathAddResponse');
    assert_eq(42, $response->sum, '40 + 2 = 42');
} catch (\Throwable $e) {
    fail("math.add", $e->getMessage());
}
echo "\n";

// ─── Test 2: Another Async RPC ──────────────────────────────

echo "─── Test 2: Async RPC (math.divide) ───\n";
try {
    $response = $client->call(new MathDivideRequest(x: 100, y: 7))->await();
    assert_instanceof(MathDivideResponse::class, $response, 'response type is MathDivideResponse');
    // 100 / 7 = 14.285714...  Use approximate comparison
    if (\abs($response->result - 100 / 7) < 0.0001) {
        pass("100 / 7 = {$response->result}");
    } else {
        fail("100 / 7", "expected ~" . (100 / 7) . ", got {$response->result}");
    }
} catch (\Throwable $e) {
    fail("math.divide", $e->getMessage());
}
echo "\n";

// ─── Test 3: Error Handling ─────────────────────────────────

echo "─── Test 3: Division by Zero (typed exception) ───\n";
try {
    $client->call(new MathDivideRequest(x: 10, y: 0))->await();
    fail("division by zero", "expected exception was not thrown");
} catch (DivisionByZeroException $e) {
    pass("caught DivisionByZeroException");
    assert_eq('Division by zero', $e->getMessage(), 'exception message');
    assert_eq(-32602, $e->getRpcCode(), 'RPC code is INVALID_PARAMS');
    assert_eq(['y' => 0], $e->getErrorData(), 'error data contains y=0');
} catch (\Throwable $e) {
    fail("division by zero", "unexpected exception: " . $e::class . ' - ' . $e->getMessage());
}
echo "\n";

// ─── Test 4: Notification ───────────────────────────────────

echo "─── Test 4: Notification (fire-and-forget) ───\n";
try {
    $client->notify(new UserLoggedIn(userId: 42, username: 'alice'));
    pass("notification sent without error");
} catch (\Throwable $e) {
    fail("notification", $e->getMessage());
}
echo "\n";

// ─── Test 5: Subscribe & Publish ───────────────────────────

echo "─── Test 5: Stream Subscribe / Publish ───\n";
try {
    $orders = $client->subscribe(new SubscribeOrders(filter: 'active'));
    pass("subscription created");

    // Collect events in background
    $receivedEvents = [];
    $streamDone = new \Amp\DeferredFuture();
    \Amp\async(function () use ($orders, &$receivedEvents, $streamDone): void {
        $count = 0;
        foreach ($orders as $event) {
            $receivedEvents[] = $event;
            $count++;
            if ($count >= 3) {
                $orders->complete();
                break;
            }
        }
        $streamDone->complete(true);
    });

    // Publish chat messages — these should not interfere
    $client->publish(new ChatMessage(user: 'alice', text: 'Hello over mTLS!'));
    $client->publish(new ChatMessage(user: 'alice', text: 'End-to-end test message.'));

    // Wait for stream events to arrive
    \Amp\delay(7.0);

    // Check stream was completed
    $streamDone->getFuture()->await();
    assert_eq(3, \count($receivedEvents), 'received 3 stream events');
    foreach ($receivedEvents as $event) {
        assert_instanceof(OrderEvent::class, $event, 'event is OrderEvent');
    }
} catch (\Throwable $e) {
    fail("subscribe/publish", $e->getMessage());
}
echo "\n";

// ─── Test 6: Multiple Concurrent Calls ──────────────────────

echo "─── Test 6: Concurrent Calls ───\n";
try {
    $concurrent = 10;
    $futures = [];
    for ($i = 0; $i < $concurrent; $i++) {
        $futures[] = $client->call(new MathAddRequest(a: $i, b: $i * 2));
    }

    $results = [];
    foreach ($futures as $future) {
        $results[] = $future->await();
    }

    assert_eq($concurrent, \count($results), "received {$concurrent} responses");
    foreach ($results as $i => $result) {
        assert_instanceof(MathAddResponse::class, $result, "result[{$i}] is MathAddResponse");
        assert_eq($i + ($i * 2), $result->sum, "{$i} + " . ($i * 2) . " = {$result->sum}");
    }
} catch (\Throwable $e) {
    fail("concurrent calls", $e->getMessage());
}
echo "\n";

// ─── Test 7: Close ──────────────────────────────────────────

echo "─── Test 7: Close client ───\n";
try {
    $client->close();
    pass("client closed gracefully");
} catch (\Throwable $e) {
    fail("close", $e->getMessage());
}
echo "\n";

// ─── Cleanup ────────────────────────────────────────────────

echo "Shutting down server...\n";
\proc_terminate($serverProc, \SIGTERM);
\proc_close($serverProc);

\unlink($serverLog);

echo "\n";
echo $exitCode === 0 ? "═══ ALL TESTS PASSED ═══\n" : "═══ SOME TESTS FAILED ═══\n";

exit($exitCode);

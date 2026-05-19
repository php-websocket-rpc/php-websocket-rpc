<?php

declare(strict_types=1);

/**
 * Example: mTLS (Mutual TLS) RPC WebSocket Server
 *
 * Run with:
 *   php examples/server_mtls.php
 *
 * Certificates must be generated first:
 *   bash examples/certs/mtls/generate.sh
 *
 * This demonstrates:
 *   - Two-way TLS: server authenticates with its cert AND
 *     requires a valid client certificate signed by the CA
 *   - Accessing the client certificate CN to identify the caller
 *   - Server authenticates with a CA-signed certificate
 *   - Client must present a CA-signed client certificate
 */

use Amp\Socket\BindContext;
use Amp\Socket\Certificate as ServerCertificate;
use Amp\Socket\InternetAddress;
use Amp\Socket\ServerTlsContext;
use PhpWebsocketRpc\Rpc\Exception\RpcDispatchException;
use PhpWebsocketRpc\Rpc\Payload\Error;
use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;
use PhpWebsocketRpc\RpcServer\Server\ClientSession;
use PhpWebsocketRpc\RpcServer\Server\RpcServer;

require __DIR__ . '/../vendor/autoload.php';

// ─── Domain Exceptions (shared between server and client) ────

class DivisionByZeroException extends RpcDispatchException
{
}

// ─── 1. Certificate Paths ────────────────────────────────────

$certDir = __DIR__ . '/certs/mtls';
$caCert     = "$certDir/ca.crt";
$serverCert = "$certDir/server.crt";
$serverKey  = "$certDir/server.key";

foreach ([$caCert, $serverCert, $serverKey] as $f) {
    if (!\file_exists($f)) {
        \fwrite(\STDERR, "ERROR: Missing certificate: $f\n");
        \fwrite(\STDERR, "Run: bash examples/certs/mtls/generate.sh\n");
        exit(1);
    }
}

// ─── 2. Define Domain Classes ────────────────────────────────

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

class SubscribeOrders extends Payload implements Kind\StreamOpen
{
    public function __construct(
        public readonly ?string $filter = null,
    ) {
        parent::__construct();
    }

    public static function channel(): string { return 'orders'; }
    public static function streamDataClass(): string { return OrderEvent::class; }
}

class OrderEvent extends Payload implements Kind\StreamData
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

class ChatMessage extends Payload implements Kind\StreamData
{
    public function __construct(
        public readonly string $user,
        public readonly string $text,
    ) {
        parent::__construct();
    }

    public static function channel(): string { return 'chat'; }
}

// ─── 3. Start the Server with mTLS ──────────────────────────

$logHandler = new \Amp\Log\StreamHandler(\Amp\ByteStream\getStdout());
$logHandler->setFormatter(new \Amp\Log\ConsoleFormatter());
$logger = new \Monolog\Logger('server');
$logger->pushHandler($logHandler);

$server = \Amp\Http\Server\SocketHttpServer::createForDirectAccess($logger);

// Configure mTLS:
//   1. Server presents its own CA-signed certificate
//   2. Require and verify client certificate (signed by our CA)
//   3. Disable peer name verification — we verify the cert's
//      signature/chain, not that the CN matches a hostname
//   4. Trust client certs signed by this CA
$tlsContext = (new ServerTlsContext())
    ->withDefaultCertificate(new ServerCertificate($serverCert, $serverKey))
    ->withPeerVerification(true)         // Request + verify client cert signature
    ->withoutPeerNameVerification()      // Don't check CN against hostname
    ->withPeerCapturing(true)            // Capture client cert for inspection
    ->withCaFile($caCert);               // Trust CA-signed client certs

$bindContext = (new BindContext())
    ->withTlsContext($tlsContext);

$server->expose(
    new InternetAddress('0.0.0.0', 9505),
    $bindContext,
);

$errorHandler = new \Amp\Http\Server\DefaultErrorHandler();
$router = new \Amp\Http\Server\Router($server, $logger, $errorHandler);

// Attach RPC WebSocket server
$rpcServer = RpcServer::attach($server, $router, '/rpc', $logger);

// ─── 4. Register mTLS-aware RPC Handlers ────────────────────

$rpcServer->on(
    MathAddRequest::class,
    function (MathAddRequest $req, ClientSession $session): MathAddResponse {
        $tlsInfo = $session->getTlsInfo();
        $clientCn = 'unknown';

        // Extract the client CN from the peer certificate
        if ($tlsInfo !== null) {
            $peerCerts = $tlsInfo->getPeerCertificates();
            if (isset($peerCerts[0])) {
                $cert = $peerCerts[0];
                $clientCn = $cert->getSubject()->getCommonName();
            }
        }

        \printf(
            "[mTLS] Math request from client '%s' (CN: %s)\n",
            $session->getClientId(),
            $clientCn,
        );

        return new MathAddResponse(sum: $req->a + $req->b);
    },
);

$rpcServer->on(
    MathDivideRequest::class,
    function (MathDivideRequest $req, ClientSession $session): MathDivideResponse {
        if ($req->y === 0.0) {
            throw new DivisionByZeroException(
                'Division by zero',
                Error::INVALID_PARAMS,
                ['y' => 0],
            );
        }

        return new MathDivideResponse(result: $req->x / $req->y);
    },
);

// ─── 5. Register Subscription Handler ─────────────────────────

$rpcServer->onSubscribe(
    SubscribeOrders::class,
    function (SubscribeOrders $req, ClientSession $session) use ($rpcServer, $logger): void {
        $rpcServer->channel('orders')->subscribe($session);
        $logger->info('Client subscribed to orders stream (mTLS)', [
            'client_id' => $session->getClientId(),
        ]);
    },
);

// ─── 6. Register Publish Handler ────────────────────────────

$rpcServer->onPublish(
    ChatMessage::class,
    function (ChatMessage $msg, ClientSession $session) use ($rpcServer, $logger): void {
        $logger->info('Chat message (mTLS)', ['user' => $msg->user, 'text' => $msg->text]);
        $rpcServer->channel('chat')->push($msg);
    },
);

// ─── 7. Background Stream Pusher ─────────────────────────────

\Amp\async(function () use ($rpcServer): void {
    $orderId = 1000;
    while (true) {
        \Amp\delay(3.0);
        $event = new OrderEvent(
            orderId: ++$orderId,
            status: \random_int(0, 1) ? 'pending' : 'shipped',
            amount: \round(\random_int(1000, 99999) / 100, 2),
        );
        $rpcServer->push('orders', $event);
    }
});

// ─── 8. Start ──────────────────────────────────────────────

$server->start($router, $errorHandler);
$rpcServer->start();

$logger->info('mTLS RPC WebSocket server running on wss://0.0.0.0:9505/rpc');
$logger->info('Clients must present a certificate signed by the CA');
$logger->info("CA certificate: $caCert");

$signal = \Amp\trapSignal([\SIGINT, \SIGTERM]);
$logger->info("Received signal {$signal}, shutting down...");

$rpcServer->stop();
$server->stop();

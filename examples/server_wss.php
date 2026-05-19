<?php

declare(strict_types=1);

/**
 * Example: RPC WSS (Secure WebSocket) Server
 *
 * Run with:
 *   php examples/server_wss.php
 *
 * This demonstrates:
 *   - Same RPC handlers as the plain WS server
 *   - Served over WSS with a self-signed certificate
 *   - Generate certs: openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
 *       -keyout examples/certs/server.key \
 *       -out examples/certs/server.crt \
 *       -subj "/CN=localhost"
 *
 * Client connects with WSS and skips certificate verification.
 */

use PhpWebsocketRpc\Rpc\Exception\RpcDispatchException;
use PhpWebsocketRpc\Rpc\Payload\Error;
use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\Payload;
use PhpWebsocketRpc\Rpc\Stream\StreamChannelAware;
use PhpWebsocketRpc\Rpc\Stream\StreamSubscribable;
use PhpWebsocketRpc\RpcServer\Server\ClientSession;
use PhpWebsocketRpc\RpcServer\Server\RpcServer;

require __DIR__ . '/../vendor/autoload.php';

// ─── Domain Exceptions (shared between server and client) ────

class DivisionByZeroException extends RpcDispatchException
{
}

// ─── 1. Define Domain Classes (identical to server.php) ──────

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
    public function __construct(
        public readonly ?string $filter = null,
    ) {
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

// ─── 2. SSL Certificate Paths ─────────────────────────────────

$certFile = __DIR__ . '/certs/server.crt';
$keyFile  = __DIR__ . '/certs/server.key';

if (!\file_exists($certFile) || !\file_exists($keyFile)) {
    \fwrite(\STDERR, "ERROR: SSL certificate not found.\n");
    \fwrite(\STDERR, "Generate with:\n");
    \fwrite(\STDERR, "  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\\n");
    \fwrite(\STDERR, "    -keyout examples/certs/server.key \\\n");
    \fwrite(\STDERR, "    -out examples/certs/server.crt \\\n");
    \fwrite(\STDERR, "    -subj \"/CN=localhost\"\n");
    exit(1);
}

// ─── 3. Start the Server with TLS ─────────────────────────────

$logHandler = new \Amp\Log\StreamHandler(\Amp\ByteStream\getStdout());
$logHandler->setFormatter(new \Amp\Log\ConsoleFormatter());
$logger = new \Monolog\Logger('server');
$logger->pushHandler($logHandler);

// Create the HTTP server
$server = \Amp\Http\Server\SocketHttpServer::createForDirectAccess($logger);

// Configure TLS with the self-signed certificate
$tlsContext = (new \Amp\Socket\ServerTlsContext())
    ->withDefaultCertificate(
        new \Amp\Socket\Certificate($certFile, $keyFile),
    );

$bindContext = (new \Amp\Socket\BindContext())
    ->withTlsContext($tlsContext);

// Expose on WSS port with TLS
$server->expose(
    new \Amp\Socket\InternetAddress('0.0.0.0', 9504),
    $bindContext,
);

$errorHandler = new \Amp\Http\Server\DefaultErrorHandler();
$router = new \Amp\Http\Server\Router($server, $logger, $errorHandler);

// Attach RPC WebSocket server
$rpcServer = RpcServer::attach($server, $router, '/rpc', $logger);

// ─── 4. Register RPC Handlers ────────────────────────────────

$rpcServer->on(
    MathAddRequest::class,
    function (MathAddRequest $req, ClientSession $session): MathAddResponse {
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
        $logger->info('Client subscribed to orders stream', [
            'client_id' => $session->getClientId(),
            'filter' => $req->filter,
        ]);
    },
);

// ─── 6. Register Publish Handler (chat broadcast) ────────────

$rpcServer->onPublish(
    ChatMessage::class,
    function (ChatMessage $msg, ClientSession $session) use ($rpcServer, $logger): void {
        $logger->info('Chat message', ['user' => $msg->user, 'text' => $msg->text]);
        $rpcServer->channel('chat')->push($msg);
    },
);

// ─── 7. Background Stream Pusher ──────────────────────────────

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

// ─── 8. Start ────────────────────────────────────────────────

$server->start($router, $errorHandler);
$rpcServer->start();

$logger->info('RPC WebSocket server running on wss://0.0.0.0:9504/rpc (self-signed cert)');

// Await shutdown signal
$signal = \Amp\trapSignal([\SIGINT, \SIGTERM]);

$logger->info("Received signal {$signal}, shutting down...");

$rpcServer->stop();
$server->stop();

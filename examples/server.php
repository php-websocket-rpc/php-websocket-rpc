<?php

declare(strict_types=1);

/**
 * Example: RPC WebSocket Server
 *
 * Run with:
 *   php examples/server.php
 *
 * This shows:
 *   - Typed RPC request/response handlers
 *   - Stream subscription handling
 *   - Stream publish handling (broadcast)
 *   - Background stream pusher
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

/**
 * Custom domain exception thrown on the server for division by zero.
 *
 * Because the framework includes the exception class in the error
 * response, the client can catch this exact type:
 *
 *   try { ... } catch (DivisionByZeroException $e) { ... }
 *
 * Extends RpcDispatchException so it gets caught with the correct
 * RPC error code (-32602 InvalidParams) instead of -32603 InternalError.
 */
class DivisionByZeroException extends RpcDispatchException
{
}

// ─── 1. Define Domain Classes ────────────────────────────────

// --- RPC: math.add ---
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
    public function __construct(
        public readonly int $sum,
    ) {
        parent::__construct();
    }
}

// --- RPC: math.divide ---
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
    public function __construct(
        public readonly float $result,
    ) {
        parent::__construct();
    }
}

// --- Notification: user.logged_in ---
class UserLoggedIn extends Payload implements Kind\Notification
{
    public function __construct(
        public readonly int $userId,
        public readonly string $username,
    ) {
        parent::__construct();
    }
}

// --- Stream subscribe: orders ---
class SubscribeOrders extends Payload implements Kind\StreamOpen, StreamSubscribable
{
    public function __construct(
        public readonly ?string $filter = null,
    ) {
        parent::__construct();
    }

    public static function channel(): string
    {
        return 'orders';
    }

    public static function streamDataClass(): string
    {
        return OrderEvent::class;
    }
}

// --- Stream data: order event ---
class OrderEvent extends Payload implements Kind\StreamData, StreamChannelAware
{
    public function __construct(
        public readonly int $orderId,
        public readonly string $status,
        public readonly float $amount,
    ) {
        parent::__construct();
    }

    public static function channel(): string
    {
        return 'orders';
    }
}

// --- Stream publish: chat message ---
class ChatMessage extends Payload implements Kind\StreamData, StreamChannelAware
{
    public function __construct(
        public readonly string $user,
        public readonly string $text,
    ) {
        parent::__construct();
    }

    public static function channel(): string
    {
        return 'chat';
    }
}

// ─── 2. Start the Server ─────────────────────────────────────

$logHandler = new \Amp\Log\StreamHandler(\Amp\ByteStream\getStdout());
$logHandler->setFormatter(new \Amp\Log\ConsoleFormatter());
$logger = new \Monolog\Logger('server');
$logger->pushHandler($logHandler);

$server = \Amp\Http\Server\SocketHttpServer::createForDirectAccess($logger);
$server->expose(new \Amp\Socket\InternetAddress('127.0.0.1', 9501));

$errorHandler = new \Amp\Http\Server\DefaultErrorHandler();
$router = new \Amp\Http\Server\Router($server, $logger, $errorHandler);

// Attach RPC WebSocket server
$rpcServer = RpcServer::attach($server, $router, '/rpc', $logger);

// ─── 3. Register RPC Handlers ────────────────────────────────

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
            // Throw a typed exception — the framework includes the
            // exception class in the error response, so the client
            // can catch DivisionByZeroException by its type.
            throw new DivisionByZeroException(
                'Division by zero',
                Error::INVALID_PARAMS,
                ['y' => 0],
            );
        }

        return new MathDivideResponse(result: $req->x / $req->y);
    },
);

// ─── 4. Register Subscription Handler ─────────────────────────

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

// ─── 5. Register Publish Handler (chat broadcast) ────────────

$rpcServer->onPublish(
    ChatMessage::class,
    function (ChatMessage $msg, ClientSession $session) use ($rpcServer, $logger): void {
        $logger->info('Chat message', ['user' => $msg->user, 'text' => $msg->text]);
        // Broadcast to all chat subscribers
        $rpcServer->channel('chat')->push($msg);
    },
);

// ─── 6. Background Stream Pusher (simulate order events) ─────

\Amp\async(function () use ($rpcServer): void {
    $orderId = 1000;

    while (true) {
        \Amp\delay(3.0); // Push an order event every 3 seconds

        $event = new OrderEvent(
            orderId: ++$orderId,
            status: \random_int(0, 1) ? 'pending' : 'shipped',
            amount: \round(\random_int(1000, 99999) / 100, 2),
        );

        $rpcServer->push('orders', $event);
    }
});

// ─── 7. Start ────────────────────────────────────────────────

$server->start($router, $errorHandler);
$rpcServer->start();

$logger->info('RPC WebSocket server running on ws://127.0.0.1:9501/rpc');

// Await shutdown signal
$signal = \Amp\trapSignal([\SIGINT, \SIGTERM]);

$logger->info("Received signal {$signal}, shutting down...");

$rpcServer->stop();
$server->stop();

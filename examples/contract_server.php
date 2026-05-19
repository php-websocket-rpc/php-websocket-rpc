<?php

/**
 * Contract-based RPC server example.
 *
 * Demonstrates registering service contracts and serving them
 * over the WebSocket RPC transport.
 *
 * Run:   php examples/contract_server.php
 */

declare(strict_types=1);

use Amp\ByteStream;
use Amp\Http\Server\DefaultErrorHandler;
use Amp\Http\Server\Router;
use Amp\Http\Server\SocketHttpServer;
use Amp\Log\ConsoleFormatter;
use Amp\Log\StreamHandler;
use Amp\Socket\InternetAddress;
use Monolog\Logger;
use Monolog\Processor\PsrLogMessageProcessor;
use PhpWebsocketRpc\RpcServer\Server\RpcServer;

require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/contract_math_service.php';

// ─── Logging ───────────────────────────────────────────────────

$handler = new StreamHandler(ByteStream\getStdout());
$handler->setFormatter(new ConsoleFormatter());
$logger = new Logger('server', [$handler], [new PsrLogMessageProcessor()]);

// ─── HTTP Server ───────────────────────────────────────────────

$httpServer = SocketHttpServer::createForDirectAccess($logger);
$httpServer->expose(new InternetAddress('127.0.0.1', 9502));

$errorHandler = new DefaultErrorHandler();
$router = new Router($httpServer, $logger, $errorHandler);

// ─── Create RPC Server ─────────────────────────────────────────

$server = RpcServer::attach($httpServer, $router, '/rpc', $logger);

// ─── Register Contract Services ────────────────────────────────

// 1. Call/Response + Notification
$math = new MathServiceImpl();
$server->registerService(MathService::class, $math);

// 2. Streaming (Iterator return)
$server->registerService(NumberStreamService::class, new NumberStreamServiceImpl());

// 3. Subscription (callable parameter via #[RpcSubscribe])
$events = new EventServiceImpl();
$server->registerService(EventService::class, $events);

// 4. Subscribe + Publish (chat via #[RpcSubscribe] + #[RpcPublish])
$chat = new ChatServiceImpl();
$server->registerService(ChatService::class, $chat);

// ─── Start Server ──────────────────────────────────────────────

$httpServer->start($router, $errorHandler);
$server->start();

echo "✓ Contract RPC server running on ws://127.0.0.1:9502/rpc\n";
echo "  Registered services:\n";
echo "    - MathService         (call: add, sub, mul | notify: log)\n";
echo "    - NumberStreamService (stream: count)\n";
echo "    - EventService        (subscribe: onEvent)\n";
echo "    - ChatService         (subscribe: onMessage | publish: send)\n\n";

// ─── Event Simulation (async timer) ────────────────────────────

\Amp\async(function () use ($events): void {
    $i = 0;
    while (true) {
        \Amp\delay(3.0);
        $i++;
        $events->trigger("event_$i");
    }
});

// ─── Wait for signal ──────────────────────────────────────────

$signal = \Amp\trapSignal([\SIGINT, \SIGTERM]);
$logger->info("Received signal {$signal}, stopping...");

$server->stop();
$httpServer->stop();

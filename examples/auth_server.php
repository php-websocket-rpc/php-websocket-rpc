<?php

/**
 * Authentication/Authorization server example.
 *
 * Demonstrates:
 *   1. Setting up BasicAuthenticationProvider
 *   2. Registering protected and mixed-access services
 *   3. Auth middleware automatically protecting #[NeedAuthorization] methods
 *
 * Run:   php examples/auth_server.php
 * Client: php examples/auth_client.php
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
use PhpWebsocketRpc\RpcServer\Auth\BasicAuthenticationProvider;
use PhpWebsocketRpc\RpcServer\Server\RpcServer;

require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/auth_contract.php';

// ─── Logging ───────────────────────────────────────────────────

$handler = new StreamHandler(ByteStream\getStdout());
$handler->setFormatter(new ConsoleFormatter());
$logger = new Logger('server', [$handler], [new PsrLogMessageProcessor()]);

// ─── HTTP Server ───────────────────────────────────────────────

$httpServer = SocketHttpServer::createForDirectAccess($logger);
$httpServer->expose(new InternetAddress('127.0.0.1', 9503));

$errorHandler = new DefaultErrorHandler();
$router = new Router($httpServer, $logger, $errorHandler);

// ─── Create RPC Server ─────────────────────────────────────────

$server = RpcServer::attach($httpServer, $router, '/rpc', $logger);

// ─── Set up Authentication ─────────────────────────────────────
//
// Tokens:     id            roles
// 'tok-alice' => 'alice'    => ['customer']
// 'tok-admin' => 'bob'      => ['admin']

$server->useAuthentication(new BasicAuthenticationProvider([
    'tok-alice' => ['id' => 'alice', 'roles' => ['customer']],
    'tok-admin' => ['id' => 'bob', 'roles' => ['admin']],
]));

// ─── Register Protected Services ───────────────────────────────

$server->registerService(SecureDataService::class, new SecureDataServiceImpl());
$server->registerService(MixedAccessService::class, new MixedAccessServiceImpl());

// ─── Start Server ──────────────────────────────────────────────

$httpServer->start($router, $errorHandler);
$server->start();

echo "✓ Auth RPC server running on ws://127.0.0.1:9503/rpc\n";
echo "  Tokens:\n";
echo "    - tok-alice  (roles: customer)\n";
echo "    - tok-admin  (roles: admin)\n";
echo "  Protected services:\n";
echo "    - SecureDataService      (all methods: #[NeedAuthorization] on class)\n";
echo "    - MixedAccessService     (getPublicInfo: public | getProfile: auth | adminOnly: admin)\n\n";

// ─── Wait for signal ──────────────────────────────────────────

$signal = \Amp\trapSignal([\SIGINT, \SIGTERM]);
$logger->info("Received signal {$signal}, stopping...");

$server->stop();
$httpServer->stop();

<?php

/**
 * Minimal benchmark server — echoes back BenchRequest.
 * Run: php examples/server_bench.php
 */

use PhpWebsocketRpc\Rpc\Payload\Payload;
use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\RpcServer\Server\RpcServer;
use PhpWebsocketRpc\RpcServer\Server\ClientSession;

require __DIR__ . '/../vendor/autoload.php';

class BenchRequest extends Payload implements Kind\RpcRequest
{
    public function __construct(
        public readonly int $seq,
        public readonly string $payload,
    ) {
        parent::__construct();
    }
    public static function responseClass(): string { return BenchResponse::class; }
}

class BenchResponse extends Payload implements Kind\RpcResponse
{
    public function __construct(
        public readonly int $seq,
        public readonly string $echo,
    ) {
        parent::__construct();
    }
}

$logHandler = new \Amp\Log\StreamHandler(\Amp\ByteStream\getStdout());
$logHandler->setFormatter(new \Amp\Log\ConsoleFormatter());
$logger = new \Monolog\Logger('bench');
$logger->pushHandler($logHandler);

$server = \Amp\Http\Server\SocketHttpServer::createForDirectAccess($logger);
$server->expose(new \Amp\Socket\InternetAddress('127.0.0.1', 9503));

$errorHandler = new \Amp\Http\Server\DefaultErrorHandler();
$router = new \Amp\Http\Server\Router($server, $logger, $errorHandler);

$rpc = RpcServer::attach($server, $router, '/rpc', $logger);

$rpc->on(BenchRequest::class, function (BenchRequest $req): BenchResponse {
    return new BenchResponse(seq: $req->seq, echo: $req->payload);
});

$server->start($router, $errorHandler);
$rpc->start();

echo "[Bench Server] Ready on ws://127.0.0.1:9503/rpc\n";
\Amp\trapSignal([\SIGINT, \SIGTERM]);

$rpc->stop();
$server->stop();

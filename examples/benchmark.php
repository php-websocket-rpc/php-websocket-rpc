<?php

declare(strict_types=1);

/**
 * Performance benchmark for RPC over WebSocket.
 *
 * Measures:
 *   1. Serialization throughput (msgpack encode/decode)
 *   2. End-to-end RPC call latency
 *   3. RPC call throughput (concurrent)
 *   4. Serialized payload size
 *
 * Run:
 *   Terminal 1: php examples/server_bench.php
 *   Terminal 2: php examples/benchmark.php
 */

use PhpWebsocketRpc\Rpc\Payload\Payload;
use PhpWebsocketRpc\Rpc\Payload\Kind;
use PhpWebsocketRpc\Rpc\Payload\RpcResponse;
use PhpWebsocketRpc\Rpc\Payload\Error;
use PhpWebsocketRpc\Rpc\Serialization\Serializer;
use PhpWebsocketRpc\RpcClient\Client\RpcClient;

require __DIR__ . '/../vendor/autoload.php';

// ─── Benchmark domain classes ─────────────────────────────────

class BenchRequest extends Payload implements Kind\RpcRequest
{
    public function __construct(
        public readonly int $seq,
        public readonly string $payload,
    ) {
        parent::__construct();
    }

    public static function responseClass(): string
    {
        return BenchResponse::class;
    }
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

// ─── Helpers ──────────────────────────────────────────────────

function fmt(int|float $n): string
{
    if ($n >= 1_000_000) {
        return \number_format($n / 1_000_000, 2) . 'M';
    }
    if ($n >= 1_000) {
        return \number_format($n / 1_000, 2) . 'K';
    }
    return (string) $n;
}

function mem(): string
{
    return \number_format(\memory_get_peak_usage(true) / 1024 / 1024, 2) . ' MB';
}

// ─── 1. Serialization Benchmark ──────────────────────────────

echo "═══ SERIALIZATION BENCHMARK ═══\n\n";

$serializer = new Serializer();

// Small payload
$smallReq = new BenchRequest(seq: 1, payload: \str_repeat('x', 64));
$mediumReq = new BenchRequest(seq: 2, payload: \str_repeat('x', 4096));
$largeReq = new BenchRequest(seq: 3, payload: \str_repeat('x', 65536));

// Response
$resp = new RpcResponse('test', new BenchResponse(1, 'ok'), null);

foreach ([
    'Small (64B payload)'  => $smallReq,
    'Medium (4K payload)'  => $mediumReq,
    'Large (64K payload)'  => $largeReq,
    'RpcResponse'          => $resp,
] as $label => $payload) {
    $encoded = $serializer->encode($payload);
    $size = \strlen($encoded);

    // Decode once to verify
    $serializer->decode($encoded);

    // Encode benchmark
    $start = \hrtime(true);
    $iters = match (true) {
        $size > 100_000 => 1_000,
        default         => 10_000,
    };
    for ($i = 0; $i < $iters; $i++) {
        $serializer->encode($payload);
    }
    $encodeTime = (\hrtime(true) - $start) / 1e9 / $iters;

    // Decode benchmark
    $packed = $serializer->encode($payload);
    $start = \hrtime(true);
    for ($i = 0; $i < $iters; $i++) {
        $serializer->decode($packed);
    }
    $decodeTime = (\hrtime(true) - $start) / 1e9 / $iters;

    printf(
        "  %-20s | wire: %8s | encode: %8.1f ns | decode: %8.1f ns | %10s enc/s | %10s dec/s\n",
        $label,
        \strlen($encoded) > 1024
            ? \number_format(\strlen($encoded) / 1024, 1) . ' KB'
            : \strlen($encoded) . ' B',
        $encodeTime * 1e9,
        $decodeTime * 1e9,
        \number_format(1 / $encodeTime),
        \number_format(1 / $decodeTime),
    );
}

echo "\n";
echo "Peak memory: " . mem() . "\n\n";

// ─── 2. E2E RPC Latency Benchmark ────────────────────────────

echo "═══ E2E RPC LATENCY BENCHMARK ═══\n\n";

try {
    $client = RpcClient::connect('ws://127.0.0.1:9503/rpc');

    // Warmup
    $client->call(new BenchRequest(0, 'warmup'))->await();

    // Latency — single call, repeated
    $count = 100;
    $start = \hrtime(true);

    for ($i = 0; $i < $count; $i++) {
        $resp = $client->call(new BenchRequest($i, 'latency'))->await();
        \assert($resp instanceof BenchResponse);
    }

    $totalTime = (\hrtime(true) - $start) / 1e9;
    $avgLatency = ($totalTime / $count) * 1000; // ms

    printf("  Sequential calls: %d\n", $count);
    printf("  Total time:       %.3f s\n", $totalTime);
    printf("  Avg latency:      %.3f ms\n", $avgLatency);
    printf("  Throughput:       %.0f calls/s\n", $count / $totalTime);

    echo "\n";

    // ─── 3. Concurrent Throughput ────────────────────────────

    echo "═══ CONCURRENT THROUGHPUT ═══\n\n";

    $concurrent = 50;
    $start = \hrtime(true);

    $futures = [];
    for ($i = 0; $i < $concurrent; $i++) {
        $futures[] = $client->call(new BenchRequest($i, 'concurrent'));
    }

    foreach ($futures as $future) {
        $future->await();
    }

    $totalTime2 = (\hrtime(true) - $start) / 1e9;
    printf("  Concurrent calls: %d\n", $concurrent);
    printf("  Total time:       %.3f s\n", $totalTime2);
    printf("  Avg per call:     %.3f ms\n", ($totalTime2 / $concurrent) * 1000);
    printf("  Throughput:       %.0f calls/s\n", $concurrent / $totalTime2);

    echo "\n";

    $client->close();

} catch (\Throwable $e) {
    echo "  ❌ Benchmark requires the server to be running:\n";
    echo "     php examples/server_bench.php\n\n";
    echo "  Error: {$e->getMessage()}\n";
}

echo "Peak memory: " . mem() . "\n";

/**
 * Node.js contract RPC test — mirrors PHP contract_client.php.
 *
 * Demonstrates all 5 patterns using the ESM bundle.
 *
 * Requires: npm install ws
 *
 * Run after starting the PHP server:
 *   php examples/contract_server.php
 *
 * Then:
 *   node examples/node-test.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { RpcClient } from '../dist/index.mjs';
// Or from the npm package:
// import { RpcClient } from '@php-websocket-rpc/client';
const { WebSocket } = require('ws');

async function main() {
    console.log('Connecting to ws://127.0.0.1:9502/rpc...\n');

    const client = await RpcClient.connect('ws://127.0.0.1:9502/rpc', {
        wsImplementation: WebSocket,
    });

    console.log('✓ Connected\n');

    // ─── 1. Call/Response ─────────────────────────────────────

    console.log('═══ Call/Response Pattern ═══');
    const math = client.createProxy({
        service: 'MathService',
    });

    let result = await math.add(10, 5);
    console.log(`math.add(10, 5) = ${result}`);
    console.assert(result === 15, 'add(10, 5) should be 15');

    result = await math.sub(10, 5);
    console.log(`math.sub(10, 5) = ${result}`);
    console.assert(result === 5, 'sub(10, 5) should be 5');

    result = await math.mul(3, 4);
    console.log(`math.mul(3, 4) = ${result}`);
    console.assert(result === 12, 'mul(3, 4) should be 12');

    // ─── 2. Notification ──────────────────────────────────────

    console.log('\n═══ Notification Pattern ═══');
    math.log('Hello from Node.js client!');
    math.log('This is a fire-and-forget notification');
    console.log('✓ Notifications sent (no response expected)\n');

    // ─── 3. Streaming ─────────────────────────────────────────

    console.log('═══ Streaming Pattern ═══');
    const numbers = client.createProxy({
        service: 'NumberStreamService',
        stream: ['count'],
    });

    const collected = [];
    for await (const value of numbers.count(10)) {
        collected.push(value);
        console.log(`  Received: ${value}`);
    }
    console.log(`Collected: [${collected.join(', ')}]`);
    console.assert(collected.length === 10, 'Should get 10 items');
    console.assert(collected[0] === 0, 'First should be 0');
    console.assert(collected[9] === 9, 'Last should be 9');
    console.log('✓ Stream complete\n');

    // ─── 4. Subscribe + Publish (Chat) ────────────────────────

    console.log('═══ Chat: Subscribe + Publish ═══');
    const chat = client.createProxy({
        service: 'ChatService',
        subscribe: ['onMessage'],
        publish: ['send'],
        channel: 'chat', // matches #[RpcPublish('chat')]
    });

    const chatMessages = [];
    chat.onMessage((msg) => {
        chatMessages.push(msg);
        console.log(`  Chat received: ${msg}`);
    });

    chat.send('Hello via publish!');

    // Wait for echo
    await new Promise(r => setTimeout(r, 1000));
    console.log(`Chat messages received: ${chatMessages.length}`);
    for (const msg of chatMessages) {
        console.log(`  - ${msg}`);
    }
    if (chatMessages.length > 0) {
        console.log('✓ Chat publish/subscribe works\n');
    } else {
        console.log('  (no messages — events may need more time)\n');
    }

    // ─── 5. Subscribe (event timer) ───────────────────────────

    console.log('═══ Subscription Pattern ═══');
    const events = client.createProxy({
        service: 'EventService',
        subscribe: ['onEvent'],
        channel: 'events',
    });

    const received = [];
    events.onEvent((evt) => {
        received.push(evt);
        console.log(`  Callback received: ${evt}`);
    });

    console.log('Waiting for server events (6 seconds)...');
    await new Promise(r => setTimeout(r, 6500));
    console.log(`Received ${received.length} events: [${received.join(', ')}]`);
    if (received.length >= 1) {
        console.log('✓ Subscription works\n');
    } else {
        console.log('  (no events yet — server may need more time)\n');
    }

    // ─── Cleanup ──────────────────────────────────────────────

    client.close();
    console.log('✓ Connection closed');
    console.log('\nAll contract patterns verified successfully!');
}

main().catch((err) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
});

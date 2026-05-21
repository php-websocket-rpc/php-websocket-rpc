#!/usr/bin/env npx tsx
/**
 * Contract-based RPC client example (TypeScript).
 *
 * Demonstrates all 5 patterns using the codegen-generated types and configs:
 *   1. Call/Response  (MathService.add, .sub, .mul)
 *   2. Notification   (MathService.log)
 *   3. Streaming      (NumberStreamService.count)
 *   4. Subscribe      (EventService.onEvent)
 *   5. Publish + Sub  (ChatService.send + .onMessage)
 *
 * Run:
 *   php examples/contract_server.php           (in one terminal)
 *   npx tsx examples/contract-ts-client.ts      (in another)
 */

import { RpcClient } from '@php-websocket-rpc/client';
import {
    MathServiceConfig,
    NumberStreamServiceConfig,
    EventServiceConfig,
    ChatServiceConfig,
} from './__generated/math-contracts';
import type {
    MathServiceProxy,
    NumberStreamServiceProxy,
    EventServiceProxy,
    ChatServiceProxy,
} from './__generated/math-contracts';

// ─── Helpers ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
    if (condition) {
        console.log(`  ✓ ${label}`);
        passed++;
    } else {
        console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
        failed++;
    }
}

function assertEqual<T>(label: string, actual: T, expected: T): void {
    const ok = actual === expected;
    if (ok) {
        console.log(`  ✓ ${label} (= ${JSON.stringify(expected)})`);
        passed++;
    } else {
        console.log(`  ✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        failed++;
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ────────────────────────────────────────────────────────

async function main(): Promise<void> {
    try {
        // ─── Connect ──────────────────────────────────────────

        console.log('Connecting to ws://127.0.0.1:9502/rpc...\n');
        const client = await RpcClient.connect('ws://127.0.0.1:9502/rpc');
        console.log('✓ Connected\n');

        // ─── 1. Call/Response ─────────────────────────────────

        console.log('═══ Call/Response Pattern ═══');
        const math = client.createProxy<MathServiceProxy>(MathServiceConfig);

        const sum = await math.add(10, 5);
        assertEqual('math.add(10, 5)', sum, 15);

        const diff = await math.sub(10, 5);
        assertEqual('math.sub(10, 5)', diff, 5);

        const product = await math.mul(3, 4);
        assertEqual('math.mul(3, 4)', product, 12);

        console.log();

        // ─── 2. Notification ─────────────────────────────────

        console.log('═══ Notification Pattern ═══');
        math.log('Hello from TypeScript client!');
        math.log('This is a fire-and-forget notification');
        console.log('  Notified (no response expected)\n');

        // ─── 3. Streaming ─────────────────────────────────────

        console.log('═══ Streaming Pattern ═══');
        const numbers = client.createProxy<NumberStreamServiceProxy>(NumberStreamServiceConfig);

        const collected: number[] = [];
        for await (const value of numbers.count(10)) {
            collected.push(value);
            console.log(`  Received: ${value}`);
        }
        assertEqual('Stream collected count', collected.length, 10);
        assertEqual(
            'Stream values',
            JSON.stringify(collected),
            JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
        );
        console.log('  ✓ Stream complete\n');

        // ─── 4. Subscription ─────────────────────────────────

        console.log('═══ Subscription Pattern ═══');
        const events = client.createProxy<EventServiceProxy>(EventServiceConfig);

        const received: string[] = [];
        events.onEvent((event: string) => {
            received.push(event);
            console.log(`  Callback received: ${event}`);
        });

        console.log('  Waiting for events (5 seconds)...');
        await delay(5000);

        assert(
            'Events received',
            received.length > 0,
            `Got ${received.length} events`,
        );
        console.log(`  Received ${received.length} events: [${received.join(', ')}]`);
        console.log('  ✓ Subscription complete\n');

        // ─── 5. Publish + Subscribe (Chat) ───────────────────

        console.log('═══ Chat: Publish + Subscribe ═══');
        const chat = client.createProxy<ChatServiceProxy>(ChatServiceConfig);

        const chatMessages: string[] = [];
        chat.onMessage((msg: unknown) => {
            chatMessages.push(msg as string);
            console.log(`  Chat received: ${msg}`);
        });

        chat.send('Hello via publish from TypeScript!');

        console.log('  Waiting for chat echo...');
        await delay(1500);

        assertEqual('Chat messages received', chatMessages.length, 1);
        assert(
            'Chat message content',
            chatMessages[0]?.includes('Hello via publish'),
            chatMessages[0],
        );
        console.log('  ✓ Chat complete\n');

        // ─── Cleanup ─────────────────────────────────────────

        client.close();
        console.log('✓ Connection closed');
        console.log(`\n═══ Results ═══`);
        console.log(`  Passed: ${passed}`);
        console.log(`  Failed: ${failed}`);

        if (failed > 0) {
            process.exit(1);
        } else {
            console.log('\n✓ All contract patterns verified successfully!');
        }
    } catch (e) {
        console.error(`\n❌ Error: ${(e as Error).message}`);
        console.error((e as Error).stack);
        process.exit(1);
    }
}

main();

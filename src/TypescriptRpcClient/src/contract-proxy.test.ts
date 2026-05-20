import { describe, it, expect, vi } from 'vitest';
import type { RpcClient } from './rpc-client';
import { createContractProxy } from './contract-proxy';

/**
 * Create a minimal mock RpcClient for testing the proxy.
 */
function createMockClient(): Partial<RpcClient> {
    return {
        call: vi.fn().mockResolvedValue(42),
        notify: vi.fn(),
        subscribe: vi.fn().mockReturnValue({
            [Symbol.asyncIterator]: () => {
                let done = false;
                return {
                    next: () => {
                        if (!done) {
                            done = true;
                            return Promise.resolve({ value: 99, done: false });
                        }
                        return Promise.resolve({ value: undefined, done: true });
                    },
                };
            },
        }),
        publish: vi.fn(),
    };
}

interface TestService {
    add(a: number, b: number): Promise<number>;
    log(msg: string): void;
    count(limit: number): AsyncIterable<number>;
    onEvent(cb: (value: string) => void): void;
    send(msg: string): void;
}

describe('createContractProxy', () => {
    it('should route call methods to client.call()', async () => {
        const client = createMockClient() as RpcClient;
        const proxy = createContractProxy<TestService>(client, {
            service: 'TestService',
        });

        const result = await proxy.add(10, 5);
        expect(result).toBe(42);
        expect(client.call).toHaveBeenCalledWith('TestService', 'add', [10, 5]);
    });

    it('should route notify methods to client.notify()', () => {
        const client = createMockClient() as RpcClient;
        const proxy = createContractProxy<TestService>(client, {
            service: 'TestService',
            notify: ['log'],
        });

        proxy.log('hello');
        expect(client.notify).toHaveBeenCalledWith('TestService', 'log', ['hello']);
    });

    it('should route stream methods to client.subscribe()', async () => {
        const client = createMockClient() as RpcClient;
        const proxy = createContractProxy<TestService>(client, {
            service: 'TestService',
            stream: ['count'],
        });

        const collected: unknown[] = [];
        for await (const v of proxy.count(10)) {
            collected.push(v);
        }
        expect(client.subscribe).toHaveBeenCalledWith(
            'TestService', 'count', [10], undefined,
        );
        expect(collected).toEqual([99]);
    });

    it('should route subscribe methods to client.subscribe() with callback', () => {
        const client = createMockClient() as RpcClient;
        const proxy = createContractProxy<TestService>(client, {
            service: 'TestService',
            subscribe: ['onEvent'],
        });

        const cb = vi.fn();
        proxy.onEvent(cb);
        expect(client.subscribe).toHaveBeenCalledWith(
            'TestService', 'onEvent', [], undefined,
        );
    });

    it('should route publish methods to client.publish()', () => {
        const client = createMockClient() as RpcClient;
        const proxy = createContractProxy<TestService>(client, {
            service: 'TestService',
            publish: ['send'],
            channel: 'chat',
        });

        proxy.send('hello');
        expect(client.publish).toHaveBeenCalledWith(
            'TestService', 'send', ['hello'], 'chat',
        );
    });

    it('should throw if publish has no named channel', () => {
        const client = createMockClient() as RpcClient;
        const proxy = createContractProxy<TestService>(client, {
            service: 'TestService',
            publish: ['send'],
        });

        expect(() => proxy.send('hello')).toThrow('requires a named channel');
    });

    it('should throw if subscribe has no callback', () => {
        const client = createMockClient() as RpcClient;
        const proxy = createContractProxy<TestService>(client, {
            service: 'TestService',
            subscribe: ['onEvent'],
        });

        expect(() => (proxy as any).onEvent()).toThrow('must be a callable');
    });

    it('should return undefined for symbol properties', () => {
        const client = createMockClient() as RpcClient;
        const proxy = createContractProxy<TestService>(client, {
            service: 'TestService',
        });

        expect((proxy as any)[Symbol.iterator]).toBeUndefined();
    });

    it('should use classMap to deserialize wire values', async () => {
        const client = createMockClient() as RpcClient;
        (client.call as ReturnType<typeof vi.fn>).mockResolvedValue([
            'App\\User',
            { id: 1, name: 'Alice' },
        ]);

        const proxy = createContractProxy<TestService>(client, {
            service: 'TestService',
            classMap: {
                'App\\User': (data) => ({ ...data, __type: 'User' }),
            },
        });

        const result = await proxy.add(1, 2);
        expect(result).toEqual({ id: 1, name: 'Alice', __type: 'User' });
    });

    it('should use channel option for stream/subscribe/publish', () => {
        const client = createMockClient() as RpcClient;
        const proxy = createContractProxy<TestService>(client, {
            service: 'TestService',
            stream: ['count'],
            channel: 'my-channel',
        });

        proxy.count(5);
        expect(client.subscribe).toHaveBeenCalledWith(
            'TestService', 'count', [5], 'my-channel',
        );
    });
});

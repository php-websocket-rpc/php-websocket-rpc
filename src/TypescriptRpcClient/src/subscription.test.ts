import { describe, it, expect } from 'vitest';
import { Subscription } from './subscription';

describe('Subscription', () => {
    it('should collect pushed values via async iteration', async () => {
        const sub = new Subscription<number>();
        sub.push(1);
        sub.push(2);
        sub.push(3);
        sub.close();

        const collected: number[] = [];
        for await (const v of sub) {
            collected.push(v);
        }
        expect(collected).toEqual([1, 2, 3]);
    });

    it('should handle values pushed after iteration starts', async () => {
        const sub = new Subscription<number>();

        setTimeout(() => {
            sub.push(10);
            sub.push(20);
            sub.close();
        }, 0);

        const collected: number[] = [];
        for await (const v of sub) {
            collected.push(v);
        }
        expect(collected).toEqual([10, 20]);
    });

    it('should stop iteration after close', async () => {
        const sub = new Subscription<string>();
        sub.push('a');
        sub.close();
        sub.push('b'); // should be ignored

        const collected: string[] = [];
        for await (const v of sub) {
            collected.push(v);
        }
        expect(collected).toEqual(['a']);
    });

    it('should report closed status', () => {
        const sub = new Subscription<unknown>();
        expect(sub.closed).toBe(false);
        sub.close();
        expect(sub.closed).toBe(true);
    });

    it('should handle multiple pushes and waits', async () => {
        const sub = new Subscription<number>();
        const collected: number[] = [];

        // Start consuming
        const consumer = (async () => {
            for await (const v of sub) {
                collected.push(v);
            }
        })();

        sub.push(1);
        sub.push(2);
        sub.push(3);
        sub.close();

        await consumer;
        expect(collected).toEqual([1, 2, 3]);
    });

    it('should be reusable via multiple async iterators', async () => {
        const sub = new Subscription<number>();
        sub.push(42);
        sub.close();

        const col1: number[] = [];
        for await (const v of sub) col1.push(v);
        expect(col1).toEqual([42]);

        // Second iteration should get nothing (already consumed)
        const col2: number[] = [];
        for await (const v of sub) col2.push(v);
        expect(col2).toEqual([]);
    });
});

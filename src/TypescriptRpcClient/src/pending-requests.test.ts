import { describe, it, expect, vi } from 'vitest';
import { PendingRequestStore } from './pending-requests';

describe('PendingRequestStore', () => {
    it('should register and resolve a request', async () => {
        const store = new PendingRequestStore();
        const promise = store.register('req-1');
        store.resolve('req-1', 42);
        await expect(promise).resolves.toBe(42);
    });

    it('should register and reject a request', async () => {
        const store = new PendingRequestStore();
        const promise = store.register('req-2');
        store.reject('req-2', new Error('fail'));
        await expect(promise).rejects.toThrow('fail');
    });

    it('should have size 0 initially', () => {
        const store = new PendingRequestStore();
        expect(store.size).toBe(0);
    });

    it('should track pending count', () => {
        const store = new PendingRequestStore();
        store.register('req-1');
        store.register('req-2');
        expect(store.size).toBe(2);
    });

    it('should decrement count on resolve', async () => {
        const store = new PendingRequestStore();
        store.register('req-1');
        store.register('req-2');
        store.resolve('req-1', 'done');
        expect(store.size).toBe(1);
    });

    it('should reject all pending requests', async () => {
        const store = new PendingRequestStore();
        const p1 = store.register('req-1');
        const p2 = store.register('req-2');

        store.rejectAll(new Error('shutdown'));

        await expect(p1).rejects.toThrow('shutdown');
        await expect(p2).rejects.toThrow('shutdown');
        expect(store.size).toBe(0);
    });

    it('should timeout a request', async () => {
        vi.useFakeTimers();
        const store = new PendingRequestStore();
        const promise = store.register('req-t', 100);

        vi.advanceTimersByTime(100);
        await expect(promise).rejects.toThrow('timed out');
        expect(store.size).toBe(0);
        vi.useRealTimers();
    });

    it('should not fail on resolve of unknown id', () => {
        const store = new PendingRequestStore();
        expect(() => store.resolve('unknown', 'x')).not.toThrow();
    });

    it('should not fail on reject of unknown id', () => {
        const store = new PendingRequestStore();
        expect(() => store.reject('unknown', 'x')).not.toThrow();
    });
});

import type { PendingEntry } from './types';

/**
 * Manages pending RPC requests, mapping request IDs to Promises.
 */
export class PendingRequestStore {
    private map = new Map<string, PendingEntry>();

    /**
     * Register a pending request.
     * Returns a Promise that resolves/rejects when the response arrives.
     */
    register(id: string, timeoutMs?: number): Promise<unknown> {
        return new Promise<unknown>((resolve, reject) => {
            const entry: PendingEntry = { resolve, reject };

            if (timeoutMs && timeoutMs > 0) {
                entry.timer = setTimeout(() => {
                    this.map.delete(id);
                    reject(new Error(`Request timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            }

            this.map.set(id, entry);
        });
    }

    /**
     * Resolve a pending request with a value.
     */
    resolve(id: string, value: unknown): void {
        const entry = this.map.get(id);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.map.delete(id);
        entry.resolve(value);
    }

    /**
     * Reject a pending request with an error.
     */
    reject(id: string, reason: unknown): void {
        const entry = this.map.get(id);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.map.delete(id);
        entry.reject(reason);
    }

    /**
     * Reject all pending requests.
     */
    rejectAll(reason: unknown): void {
        for (const [, entry] of this.map) {
            clearTimeout(entry.timer);
            entry.reject(reason);
        }
        this.map.clear();
    }

    /**
     * Get the number of pending requests.
     */
    get size(): number {
        return this.map.size;
    }
}

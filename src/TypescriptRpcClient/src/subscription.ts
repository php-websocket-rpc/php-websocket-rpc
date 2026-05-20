/**
 * An async iterable subscription for stream values.
 *
 * Usage:
 *   for await (const value of subscription) {
 *       console.log(value);
 *   }
 */
export class Subscription<T> implements AsyncIterable<T> {
    private buffer: T[] = [];
    private waiting: Array<{ resolve: (value: IteratorResult<T>) => void; }> = [];
    private _closed = false;
    private _error: unknown = null;

    /**
     * Push a value into the subscription queue.
     */
    push(value: T): void {
        if (this._closed) return;

        if (this.waiting.length > 0) {
            const waiter = this.waiting.shift()!;
            waiter.resolve({ value, done: false });
        } else {
            this.buffer.push(value);
        }
    }

    /**
     * Close the subscription, completing the iterator.
     */
    close(): void {
        if (this._closed) return;
        this._closed = true;

        for (const waiter of this.waiting) {
            waiter.resolve({ value: undefined, done: true });
        }
        this.waiting = [];
    }

    /**
     * Error the subscription, rejecting the iterator.
     */
    error(err: unknown): void {
        if (this._closed) return;
        this._closed = true;
        this._error = err;

        for (const waiter of this.waiting) {
            waiter.resolve({ value: undefined, done: true });
        }
        this.waiting = [];
    }

    /**
     * Get the async iterator.
     */
    [Symbol.asyncIterator](): AsyncIterator<T> {
        return {
            next: () => this.next(),
        };
    }

    private async next(): Promise<IteratorResult<T>> {
        if (this._error) {
            throw this._error;
        }

        if (this.buffer.length > 0) {
            return { value: this.buffer.shift()!, done: false };
        }

        if (this._closed) {
            return { value: undefined, done: true };
        }

        return new Promise<IteratorResult<T>>((resolve) => {
            this.waiting.push({ resolve });
        });
    }

    get closed(): boolean {
        return this._closed;
    }
}

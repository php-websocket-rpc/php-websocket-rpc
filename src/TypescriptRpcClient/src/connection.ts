import type { ConnectionOptions } from './types';
import { decodeWireMessage } from './serializer';

export type MessageHandler = (fqcn: string, props: Record<string, unknown>) => void;

/**
 * WebSocket connection wrapper.
 *
 * Handles connecting, sending binary frames, and dispatching
 * incoming messages to handlers.
 */
export class Connection {
    private ws: WebSocket | null = null;
    private messageHandler: MessageHandler | null = null;
    private closeHandler: (() => void) | null = null;
    private closed = false;

    /**
     * Connect to a WebSocket RPC server.
     */
    static async connect(
        uri: string,
        options?: ConnectionOptions,
    ): Promise<Connection> {
        const conn = new Connection();
        await conn._connect(uri, options);
        return conn;
    }

    private constructor() {}

    private _connect(uri: string, options?: ConnectionOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            const protocols = options?.protocols;

            // Use custom WebSocket implementation if provided (Node.js), or native
            const WS = (options?.wsImplementation as typeof WebSocket | undefined)
                ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);

            if (!WS) {
                reject(new Error(
                    'WebSocket is not available. '
                    + 'In Node.js, install the "ws" package and pass it via options.wsImplementation.',
                ));
                return;
            }

            const ws = protocols
                ? new WS(uri, protocols)
                : new WS(uri);

            ws.binaryType = 'arraybuffer';

            ws.onopen = () => {
                this.ws = ws;
                resolve();
            };

            ws.onerror = (_err) => {
                reject(new Error(`WebSocket connection failed: ${uri}`));
            };

            ws.onclose = () => {
                this.closed = true;
                this.closeHandler?.();
            };

            ws.onmessage = (event: MessageEvent) => {
                if (this.messageHandler && event.data instanceof ArrayBuffer) {
                    try {
                        const [fqcn, props] = decodeWireMessage(event.data);
                        this.messageHandler(fqcn, props);
                    } catch {
                        // Silently ignore malformed messages
                    }
                }
            };
        });
    }

    /**
     * Register the message handler for incoming payloads.
     */
    onMessage(handler: MessageHandler): void {
        this.messageHandler = handler;
    }

    /**
     * Register a close handler.
     */
    onClose(handler: () => void): void {
        this.closeHandler = handler;
    }

    /**
     * Send a binary message.
     */
    send(data: Uint8Array): void {
        if (!this.ws || this.closed) {
            throw new Error('Cannot send — connection is closed');
        }
        this.ws.send(data);
    }

    /**
     * Close the connection.
     */
    close(): void {
        this.closed = true;
        this.ws?.close();
    }

    /**
     * Check if the connection is closed.
     */
    get isClosed(): boolean {
        return this.closed || this.ws?.readyState === WebSocket.CLOSED
            || this.ws?.readyState === WebSocket.CLOSING;
    }
}

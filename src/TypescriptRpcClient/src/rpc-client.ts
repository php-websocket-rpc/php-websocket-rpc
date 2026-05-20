import type { ConnectionOptions, ProxyOptions } from './types';
import { Connection } from './connection';
import { PendingRequestStore } from './pending-requests';
import { Subscription } from './subscription';
import { RpcError, RpcErrorCode } from './types';
import { encode } from './serializer';
import {
    FQCN,
    buildContractInvocation,
    buildContractStreamInvocation,
    buildContractPublish,
    isContractResponse,
    isContractStreamValue,
    isContractStreamClose,
    generateId,
} from './wire-format';
import { createContractProxy } from './contract-proxy';

/**
 * RPC client over WebSocket.
 *
 * Provides low-level call/notify/subscribe/publish methods
 * and a high-level createProxy() that returns a JS Proxy
 * for transparent RPC access.
 */
export class RpcClient {
    private connection: Connection;
    private pending = new PendingRequestStore();
    private subscriptions = new Map<string, Subscription<unknown>>();

    private constructor(connection: Connection) {
        this.connection = connection;

        // Set up receive loop
        this.connection.onMessage((fqcn, props) => {
            this.dispatch(fqcn, props);
        });

        // Clean up on close
        this.connection.onClose(() => {
            this.pending.rejectAll(new Error('Connection closed'));
        });
    }

    /**
     * Connect to a WebSocket RPC server.
     */
    static async connect(
        uri: string,
        options?: ConnectionOptions,
    ): Promise<RpcClient> {
        const connection = await Connection.connect(uri, options);
        return new RpcClient(connection);
    }

    // ─── High-level API ──────────────────────────────────────

    /**
     * Create a typed proxy for a service contract.
     *
     * Usage:
     *   const math = client.createProxy<MathService>({
     *       service: 'MathService',
     *       notify: ['log'],
     *   });
     *
     *   const sum = await math.add(1, 2);
     */
    createProxy<T extends object = Record<string, unknown>>(options: ProxyOptions): T {
        return createContractProxy<T>(this, options);
    }

    // ─── Low-level API ───────────────────────────────────────

    /**
     * Make an RPC call and await the response.
     *
     * @returns Promise that resolves with the decoded result.
     */
    async call(
        service: string,
        method: string,
        params: unknown[],
        timeoutMs?: number,
    ): Promise<unknown> {
        const id = generateId();
        const message = buildContractInvocation(id, service, method, params);
        const packed = encode(message);

        const promise = this.pending.register(id, timeoutMs);
        this.connection.send(packed);

        return promise;
    }

    /**
     * Fire-and-forget notification (no response expected).
     */
    notify(
        service: string,
        method: string,
        params: unknown[],
    ): void {
        const id = generateId();
        const message = buildContractInvocation(id, service, method, params);
        const packed = encode(message);
        this.connection.send(packed);
    }

    /**
     * Subscribe to a stream.
     *
     * @returns AsyncIterable that yields stream values.
     */
    subscribe(
        service: string,
        method: string,
        params: unknown[],
        channelName?: string,
    ): AsyncIterable<unknown> {
        const channel = channelName || 'ctr:' + generateId().slice(0, 16);

        const invocation = buildContractStreamInvocation(
            generateId(),
            service,
            method,
            params,
            channel,
        );

        const sub = new Subscription<unknown>();
        this.subscriptions.set(channel, sub);

        // Send the subscription request
        this.connection.send(encode(invocation));

        return sub;
    }

    /**
     * Publish data to a named channel.
     */
    publish(
        service: string,
        method: string,
        data: unknown,
        channelName: string,
    ): void {
        const message = buildContractPublish(
            generateId(),
            service,
            method,
            data,
            channelName,
        );
        this.connection.send(encode(message));
    }

    /**
     * Close the connection.
     */
    close(): void {
        this.pending.rejectAll(new Error('Client closed'));
        for (const [, sub] of this.subscriptions) {
            sub.close();
        }
        this.subscriptions.clear();
        this.connection.close();
    }

    // ─── Internal dispatch ───────────────────────────────────

    private dispatch(fqcn: string, props: Record<string, unknown>): void {
        // Handle responses
        if (isContractResponse([fqcn, props])) {
            this.handleResponse(props);
            return;
        }

        // Handle stream values
        if (isContractStreamValue([fqcn, props])) {
            this.handleStreamValue(props);
            return;
        }

        // Handle stream close
        if (isContractStreamClose([fqcn, props])) {
            this.handleStreamClose(props);
            return;
        }
    }

    private handleResponse(props: Record<string, unknown>): void {
        const id = props['id'] as string | undefined;

        // Try ContractResponse format first (direct, no RpcResponse wrapper)
        if (props['result'] !== undefined) {
            // ContractResponse format: { id, result }
            if (id) this.pending.resolve(id, props['result']);
            return;
        }

        // RpcResponse format: { id, payload, error }
        if (props['payload'] !== undefined || props['error'] !== undefined) {
            if (props['error']) {
                const err = props['error'] as Record<string, unknown>;
                const code = (err['code'] as number) ?? RpcErrorCode.INTERNAL_ERROR;
                const message = (err['message'] as string) || 'RPC error';
                const data = err['data'];
                if (id) this.pending.reject(id, new RpcError(code, message, data));
            } else if (props['payload']) {
                const payload = props['payload'] as [string, Record<string, unknown>];
                // If payload is a ContractResponse, unwrap the result field
                const value = this.unwrapResponse(payload);
                if (id) this.pending.resolve(id, value);
            }
            return;
        }
    }

    /**
     * Unwrap potentially nested response payloads.
     *
     * PHP server wraps ContractResponse in RpcResponse:
     *   RpcResponse.payload = [ContractResponse.FQCN, { result: actualValue }]
     *
     * This method extracts the actual value.
     */
    private unwrapResponse(payload: [string, Record<string, unknown>]): unknown {
        const [fqcn, innerProps] = payload;

        // ContractResponse: extract result field
        if (fqcn === FQCN.ContractResponse && innerProps['result'] !== undefined) {
            return innerProps['result'];
        }

        // RpcResponse nested in another RpcResponse — recurse
        if (fqcn === FQCN.RpcResponse && innerProps['payload'] !== undefined) {
            return this.unwrapResponse(
                innerProps['payload'] as [string, Record<string, unknown>],
            );
        }

        // Plain [FQCN, props] — return props as-is
        return innerProps;
    }

    private handleStreamValue(props: Record<string, unknown>): void {
        const channel = props['channelName'] as string | undefined;
        const value = props['value'];

        if (channel && this.subscriptions.has(channel)) {
            const sub = this.subscriptions.get(channel)!;
            sub.push(value);
        }
    }

    private handleStreamClose(props: Record<string, unknown>): void {
        const channel = props['channelName'] as string | undefined;

        if (channel && this.subscriptions.has(channel)) {
            const sub = this.subscriptions.get(channel)!;
            sub.close();
            this.subscriptions.delete(channel);
        }
    }
}

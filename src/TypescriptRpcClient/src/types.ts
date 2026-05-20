/**
 * Options for creating a contract proxy.
 */
export interface ProxyOptions {
    /** Server-side service interface name (FQCN), e.g. "MathService" */
    service: string;

    /** Methods returning AsyncIterable (stream pattern) */
    stream?: string[];

    /** Methods with a callback param (subscribe pattern) */
    subscribe?: string[];

    /** Methods publishing data (publish pattern) */
    publish?: string[];

    /** Fire-and-forget methods (notify pattern) */
    notify?: string[];

    /** Named channel for subscribe/stream (default: auto-generated) */
    channel?: string;

    /**
     * Object deserialization: maps PHP FQCN → factory function.
     * When a wire value is received as [FQCN, props], the factory
     * is called with props to reconstruct the object.
     */
    classMap?: Record<string, (data: Record<string, unknown>) => unknown>;
}

/**
 * A value from the server that may be a deserialized object.
 */
export type WireValue = unknown;

/**
 * Wire message format: [FQCN, props]
 */
export type WireMessage = [string, Record<string, unknown>];

/**
 * Pending request entry.
 */
export interface PendingEntry {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timer?: ReturnType<typeof setTimeout>;
}

/**
 * Standard RPC error codes from the PHP server.
 */
export const RpcErrorCode = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    TIMEOUT: -32000,
    STREAM_CLOSED: -32001,
    TOO_MANY_REQUESTS: -32005,
    AUTHENTICATION_FAILED: -32010,
    AUTHORIZATION_FAILED: -32011,
} as const;

/**
 * Typed RPC error that includes the server-side error code and data.
 *
 * Usage:
 *   try {
 *       await client.call(service, method, args);
 *   } catch (e) {
 *       if (e instanceof RpcError && e.code === RpcErrorCode.AUTHENTICATION_FAILED) {
 *           // Show login form
 *       }
 *   }
 */
export class RpcError extends Error {
    constructor(
        public readonly code: number,
        message: string,
        public readonly data?: unknown,
    ) {
        super(message);
        this.name = 'RpcError';
    }

    get isAuthError(): boolean {
        return (
            this.code === RpcErrorCode.AUTHENTICATION_FAILED
            || this.code === RpcErrorCode.AUTHORIZATION_FAILED
        );
    }
}

/**
 * Connection options for Node.js (mTLS).
 */
export interface ConnectionOptions {
    /** TLS client key (Node.js mTLS) */
    key?: string | any;
    /** TLS client certificate (Node.js mTLS) */
    cert?: string | any;
    /** CA certificate (Node.js mTLS) */
    ca?: string | any;
    /** WebSocket sub-protocols */
    protocols?: string | string[];
    /** Custom WebSocket constructor (for Node.js or testing) */
    wsImplementation?: unknown;
}

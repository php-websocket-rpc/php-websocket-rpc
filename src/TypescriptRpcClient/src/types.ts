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

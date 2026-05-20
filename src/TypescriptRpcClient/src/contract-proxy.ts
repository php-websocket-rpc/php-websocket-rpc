import type { ProxyOptions } from './types';
import type { RpcClient } from './rpc-client';

/**
 * Create a JavaScript Proxy that transparently maps method calls
 * to RPC operations.
 *
 * @param client  The RPC client instance
 * @param options Proxy configuration (service name, patterns, class map)
 * @returns A proxy object implementing the contract interface
 */
export function createContractProxy<T extends object>(
    client: RpcClient,
    options: ProxyOptions,
): T {
    const {
        service,
        stream = [],
        subscribe = [],
        publish: publishMethods = [],
        notify = [],
        channel: namedChannel,
        classMap,
    } = options;

    const streamSet = new Set(stream);
    const subscribeSet = new Set(subscribe);
    const publishSet = new Set(publishMethods);
    const notifySet = new Set(notify);

    /**
     * Decode a wire value using the classMap if applicable.
     * Wire format: [FQCN, props] or scalar or array.
     */
    function decodeWireValue(value: unknown): unknown {
        if (
            Array.isArray(value)
            && value.length === 2
            && typeof value[0] === 'string'
            && typeof value[1] === 'object'
            && value[1] !== null
        ) {
            const [fqcn, props] = value as [string, Record<string, unknown>];

            if (classMap && classMap[fqcn]) {
                return classMap[fqcn](props);
            }

            // Return as plain object
            return props;
        }

        return value;
    }

    return new Proxy({} as T, {
        get(_target, prop: string | symbol): unknown {
            if (typeof prop === 'symbol') return undefined;

            const methodName = prop;

            // Stream pattern
            if (streamSet.has(methodName)) {
                return (...args: unknown[]): AsyncIterable<unknown> => {
                    const channel = namedChannel || undefined;
                    const iterable = client.subscribe(
                        service, methodName, args, channel,
                    );

                    // Wrap to decode wire values via classMap
                    return {
                        [Symbol.asyncIterator]: async function* () {
                            for await (const value of iterable) {
                                yield decodeWireValue(value);
                            }
                        },
                    };
                };
            }

            // Subscribe pattern
            if (subscribeSet.has(methodName)) {
                return (...args: unknown[]): void => {
                    const callback = args[args.length - 1] as
                        | ((value: unknown) => void)
                        | undefined;

                    if (typeof callback !== 'function') {
                        throw new Error(
                            `Last argument to ${service}.${methodName} must be a callable`,
                        );
                    }

                    const channel = namedChannel || undefined;
                    const iterable = client.subscribe(
                        service, methodName, args.slice(0, -1), channel,
                    );

                    // Feed values to callback in background
                    (async () => {
                        for await (const value of iterable) {
                            callback(decodeWireValue(value));
                        }
                    })();
                };
            }

            // Publish pattern
            if (publishSet.has(methodName)) {
                return (...args: unknown[]): void => {
                    if (!namedChannel) {
                        throw new Error(
                            `Publish method ${service}.${methodName} requires a named channel in options`,
                        );
                    }
                    client.publish(service, methodName, args, namedChannel);
                };
            }

            // Notify pattern
            if (notifySet.has(methodName)) {
                return (...args: unknown[]): void => {
                    client.notify(service, methodName, args);
                };
            }

            // Default: Call pattern
            return (...args: unknown[]): Promise<unknown> => {
                return client.call(service, methodName, args)
                    .then(decodeWireValue);
            };
        },
    });
}

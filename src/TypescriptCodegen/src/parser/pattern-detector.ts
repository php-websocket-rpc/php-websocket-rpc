import type { ServiceMethod } from '../types.js';
import type { AttributeInfo } from './attribute-resolver.js';

/**
 * Determine the RPC pattern for a method based on its attributes, return type,
 * and parameter types.
 *
 * Priority:
 *   1. #[RpcStream]          → stream
 *   2. #[RpcSubscribe(...)]  → subscribe
 *   3. #[RpcPublish(...)]    → publish
 *   4. Return type `void`    → notify
 *   5. Non-void return       → call (default)
 */
export function detectPattern(
    attributes: AttributeInfo[],
    returnType: string | null,
    _hasCallableParam: boolean,
): {
    pattern: ServiceMethod['pattern'];
    channel: string | null;
    subscribeType: string | null;
} {
    let channel: string | null = null;
    let subscribeType: string | null = null;

    for (const attr of attributes) {
        switch (attr.name) {
            case 'RpcStream':
                return { pattern: 'stream', channel: null, subscribeType: null };

            case 'RpcSubscribe': {
                // First positional arg or 'channel' named arg
                channel = attr.args['channel'] ?? attr.args['_0'] ?? null;
                subscribeType = attr.args['type'] ?? null;
                return { pattern: 'subscribe', channel, subscribeType };
            }

            case 'RpcPublish': {
                channel = attr.args['channel'] ?? attr.args['_0'] ?? null;
                return { pattern: 'publish', channel, subscribeType: null };
            }
        }
    }

    // No RPC attribute — infer from signature
    if (returnType === 'void' || returnType === null) {
        return { pattern: 'notify', channel: null, subscribeType: null };
    }

    return { pattern: 'call', channel: null, subscribeType: null };
}

/**
 * Wire format constants matching the PHP server's FQCNs.
 *
 * These are the fully-qualified class names used in msgpack messages
 * to identify the payload type on the wire.
 */

export const FQCN = {
    ContractInvocation: 'PhpWebsocketRpc\\Rpc\\Contract\\ContractInvocation',
    ContractResponse: 'PhpWebsocketRpc\\Rpc\\Contract\\ContractResponse',
    ContractStreamInvocation: 'PhpWebsocketRpc\\Rpc\\Contract\\ContractStreamInvocation',
    ContractStreamValue: 'PhpWebsocketRpc\\Rpc\\Contract\\ContractStreamValue',
    ContractStreamClose: 'PhpWebsocketRpc\\Rpc\\Contract\\ContractStreamClose',
    ContractPublish: 'PhpWebsocketRpc\\Rpc\\Contract\\ContractPublish',
    RpcResponse: 'PhpWebsocketRpc\\Rpc\\Payload\\RpcResponse',
} as const;

/**
 * Build a ContractInvocation message.
 */
export function buildContractInvocation(
    id: string,
    service: string,
    method: string,
    params: unknown[],
): [string, Record<string, unknown>] {
    return [
        FQCN.ContractInvocation,
        { id, service, method, params },
    ];
}

/**
 * Build a ContractStreamInvocation message.
 */
export function buildContractStreamInvocation(
    id: string,
    service: string,
    method: string,
    params: unknown[],
    channelName: string,
): [string, Record<string, unknown>] {
    return [
        FQCN.ContractStreamInvocation,
        { id, service, method, params, channelName },
    ];
}

/**
 * Build a ContractPublish message.
 */
export function buildContractPublish(
    id: string,
    service: string,
    method: string,
    data: unknown,
    channelName: string,
): [string, Record<string, unknown>] {
    return [
        FQCN.ContractPublish,
        { id, service, method, data, channelName },
    ];
}

/**
 * Check if a decoded message is a ContractResponse.
 */
export function isContractResponse(msg: [string, unknown]): boolean {
    return msg[0] === FQCN.ContractResponse
        || msg[0] === FQCN.RpcResponse;
}

/**
 * Check if a decoded message is a ContractStreamValue.
 */
export function isContractStreamValue(msg: [string, unknown]): boolean {
    return msg[0] === FQCN.ContractStreamValue;
}

/**
 * Check if a decoded message is a ContractStreamClose.
 */
export function isContractStreamClose(msg: [string, unknown]): boolean {
    return msg[0] === FQCN.ContractStreamClose;
}

/**
 * Generate a random hex ID (matches PHP's bin2hex(random_bytes(16))).
 */
export function generateId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

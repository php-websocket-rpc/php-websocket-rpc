import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';

/**
 * Encode a value to msgpack binary.
 */
export function encode(value: unknown): Uint8Array {
    const packed = msgpackEncode(value);
    if (packed instanceof Uint8Array) return packed;
    return new Uint8Array(packed as ArrayBuffer);
}

/**
 * Decode a value from msgpack binary.
 */
export function decode<T = unknown>(buffer: ArrayBuffer | Uint8Array): T {
    return msgpackDecode(buffer) as T;
}

/**
 * Decode a wire message — validates [FQCN, props] format.
 */
export function decodeWireMessage(
    buffer: ArrayBuffer | Uint8Array,
): [string, Record<string, unknown>] {
    const decoded = decode(buffer);

    if (
        !Array.isArray(decoded)
        || decoded.length !== 2
        || typeof decoded[0] !== 'string'
        || typeof decoded[1] !== 'object'
        || decoded[1] === null
    ) {
        throw new Error('Invalid wire format: expected [FQCN, props]');
    }

    return [decoded[0], decoded[1] as Record<string, unknown>];
}

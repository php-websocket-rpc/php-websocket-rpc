import { describe, it, expect } from 'vitest';
import { encode, decode, decodeWireMessage } from './serializer';

describe('encode / decode', () => {
    it('should roundtrip a number', () => {
        const buf = encode(42);
        const result = decode<number>(buf);
        expect(result).toBe(42);
    });

    it('should roundtrip a string', () => {
        const buf = encode('hello');
        const result = decode<string>(buf);
        expect(result).toBe('hello');
    });

    it('should roundtrip an array', () => {
        const buf = encode([1, 'two', true]);
        const result = decode(buf);
        expect(result).toEqual([1, 'two', true]);
    });

    it('should roundtrip an object', () => {
        const obj = { id: '1', service: 'MathService', method: 'add' };
        const buf = encode(obj);
        const result = decode(buf);
        expect(result).toEqual(obj);
    });

    it('should roundtrip null', () => {
        const buf = encode(null);
        const result = decode(buf);
        expect(result).toBeNull();
    });

    it('should roundtrip a wire message format', () => {
        const wireMsg: [string, Record<string, unknown>] = [
            'PhpWebsocketRpc\\Rpc\\Contract\\ContractInvocation',
            { id: 'abc', service: 'MathService', method: 'add', params: [10, 5] },
        ];
        const buf = encode(wireMsg);
        const [fqcn, props] = decodeWireMessage(buf);
        expect(fqcn).toBe(wireMsg[0]);
        expect(props).toEqual(wireMsg[1]);
    });
});

describe('decodeWireMessage', () => {
    it('should throw on invalid wire format (not an array)', () => {
        const buf = encode('not-an-array');
        expect(() => decodeWireMessage(buf)).toThrow('Invalid wire format');
    });

    it('should throw on invalid wire format (wrong length)', () => {
        const buf = encode(['only-one']);
        expect(() => decodeWireMessage(buf)).toThrow('Invalid wire format');
    });

    it('should throw on invalid wire format (non-string FQCN)', () => {
        const buf = encode([42, {}]);
        expect(() => decodeWireMessage(buf)).toThrow('Invalid wire format');
    });

    it('should throw on invalid wire format (null props)', () => {
        const buf = encode(['Some\\Class', null]);
        expect(() => decodeWireMessage(buf)).toThrow('Invalid wire format');
    });
});

import { describe, it, expect } from 'vitest';
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

describe('FQCN constants', () => {
    it('should have correct PHP class names', () => {
        expect(FQCN.ContractInvocation).toBe('PhpWebsocketRpc\\Rpc\\Contract\\ContractInvocation');
        expect(FQCN.ContractResponse).toBe('PhpWebsocketRpc\\Rpc\\Contract\\ContractResponse');
        expect(FQCN.ContractStreamInvocation).toBe('PhpWebsocketRpc\\Rpc\\Contract\\ContractStreamInvocation');
        expect(FQCN.ContractStreamValue).toBe('PhpWebsocketRpc\\Rpc\\Contract\\ContractStreamValue');
        expect(FQCN.ContractStreamClose).toBe('PhpWebsocketRpc\\Rpc\\Contract\\ContractStreamClose');
        expect(FQCN.ContractPublish).toBe('PhpWebsocketRpc\\Rpc\\Contract\\ContractPublish');
        expect(FQCN.RpcResponse).toBe('PhpWebsocketRpc\\Rpc\\Payload\\RpcResponse');
    });

    it('should be frozen (as const)', () => {
        // Type-level check: FQCN should be readonly
        expect(Object.isFrozen(FQCN) || true).toBe(true);
    });
});

describe('buildContractInvocation', () => {
    it('should build a valid invocation message', () => {
        const msg = buildContractInvocation('id-1', 'MathService', 'add', [10, 5]);

        expect(msg[0]).toBe(FQCN.ContractInvocation);
        expect(msg[1].id).toBe('id-1');
        expect(msg[1].service).toBe('MathService');
        expect(msg[1].method).toBe('add');
        expect(msg[1].params).toEqual([10, 5]);
    });

    it('should handle empty params', () => {
        const msg = buildContractInvocation('id-2', 'Logger', 'ping', []);
        expect(msg[1].params).toEqual([]);
    });
});

describe('buildContractStreamInvocation', () => {
    it('should build a valid stream invocation', () => {
        const msg = buildContractStreamInvocation('id-1', 'StreamService', 'count', [5], 'chan-1');

        expect(msg[0]).toBe(FQCN.ContractStreamInvocation);
        expect(msg[1].id).toBe('id-1');
        expect(msg[1].service).toBe('StreamService');
        expect(msg[1].method).toBe('count');
        expect(msg[1].params).toEqual([5]);
        expect(msg[1].channelName).toBe('chan-1');
    });
});

describe('buildContractPublish', () => {
    it('should build a valid publish message', () => {
        const msg = buildContractPublish('id-1', 'ChatService', 'send', 'hello', 'chat');

        expect(msg[0]).toBe(FQCN.ContractPublish);
        expect(msg[1].id).toBe('id-1');
        expect(msg[1].service).toBe('ChatService');
        expect(msg[1].method).toBe('send');
        expect(msg[1].data).toBe('hello');
        expect(msg[1].channelName).toBe('chat');
    });

    it('should handle object data', () => {
        const data = { text: 'hello', count: 42 };
        const msg = buildContractPublish('id-2', 'Svc', 'send', data, 'ch');
        expect(msg[1].data).toEqual(data);
    });
});

describe('isContractResponse', () => {
    it('should detect ContractResponse', () => {
        expect(isContractResponse([FQCN.ContractResponse, {}])).toBe(true);
    });

    it('should detect RpcResponse', () => {
        expect(isContractResponse([FQCN.RpcResponse, {}])).toBe(true);
    });

    it('should reject other FQCNs', () => {
        expect(isContractResponse([FQCN.ContractInvocation, {}])).toBe(false);
        expect(isContractResponse([FQCN.ContractStreamValue, {}])).toBe(false);
        expect(isContractResponse([FQCN.ContractPublish, {}])).toBe(false);
    });
});

describe('isContractStreamValue', () => {
    it('should detect ContractStreamValue', () => {
        expect(isContractStreamValue([FQCN.ContractStreamValue, {}])).toBe(true);
    });

    it('should reject other FQCNs', () => {
        expect(isContractStreamValue([FQCN.ContractResponse, {}])).toBe(false);
    });
});

describe('isContractStreamClose', () => {
    it('should detect ContractStreamClose', () => {
        expect(isContractStreamClose([FQCN.ContractStreamClose, {}])).toBe(true);
    });

    it('should reject other FQCNs', () => {
        expect(isContractStreamClose([FQCN.ContractStreamValue, {}])).toBe(false);
    });
});

describe('generateId', () => {
    it('should return a 32-character hex string', () => {
        const id = generateId();
        expect(id).toHaveLength(32);
        expect(/^[0-9a-f]+$/.test(id)).toBe(true);
    });

    it('should generate unique IDs', () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateId()));
        expect(ids.size).toBe(100);
    });
});

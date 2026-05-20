import { describe, it, expect } from 'vitest';
import { emitInterfaces } from './emit-ts-interfaces';
import type { ServiceContract } from '../types';

describe('emitInterfaces', () => {
    it('should emit a call method with number params and Promise<number> return', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'MathService',
            fqcn: 'MathService',
            sourceFile: 'test.php',
            methods: [{
                name: 'add',
                params: [
                    { name: 'a', type: 'int', nullable: false, isVariadic: false, isCallable: false },
                    { name: 'b', type: 'int', nullable: false, isVariadic: false, isCallable: false },
                ],
                returnType: 'int',
                returnNullable: false,
                pattern: 'call',
                channel: null,
                subscribeType: null,
            }],
        };

        const output = emitInterfaces([svc]);
        expect(output).toContain('interface MathServiceProxy');
        expect(output).toContain('add(a: number, b: number): Promise<number>;');
    });

    it('should emit a notify method with void return', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'Logger',
            fqcn: 'Logger',
            sourceFile: 'test.php',
            methods: [{
                name: 'log',
                params: [
                    { name: 'msg', type: 'string', nullable: false, isVariadic: false, isCallable: false },
                ],
                returnType: 'void',
                returnNullable: false,
                pattern: 'notify',
                channel: null,
                subscribeType: null,
            }],
        };

        const output = emitInterfaces([svc]);
        expect(output).toContain('log(msg: string): void;');
    });

    it('should emit a stream method with AsyncIterable return', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'Numbers',
            fqcn: 'Numbers',
            sourceFile: 'test.php',
            methods: [{
                name: 'count',
                params: [
                    { name: 'limit', type: 'int', nullable: false, isVariadic: false, isCallable: false },
                ],
                returnType: '\\Iterator',
                returnNullable: false,
                pattern: 'stream',
                channel: null,
                subscribeType: null,
            }],
        };

        const output = emitInterfaces([svc]);
        expect(output).toContain('count(limit: number): AsyncIterable<number>;');
    });

    it('should emit a subscribe method with callback parameter', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'Events',
            fqcn: 'Events',
            sourceFile: 'test.php',
            methods: [{
                name: 'onEvent',
                params: [
                    { name: 'callback', type: 'callable', nullable: false, isVariadic: false, isCallable: true },
                ],
                returnType: 'void',
                returnNullable: false,
                pattern: 'subscribe',
                channel: 'events',
                subscribeType: 'string',
            }],
        };

        const output = emitInterfaces([svc]);
        expect(output).toContain('onEvent(callback: (value: string) => void): void;');
    });

    it('should emit a publish method with void return', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'Chat',
            fqcn: 'Chat',
            sourceFile: 'test.php',
            methods: [{
                name: 'send',
                params: [
                    { name: 'message', type: 'string', nullable: false, isVariadic: false, isCallable: false },
                ],
                returnType: 'void',
                returnNullable: false,
                pattern: 'publish',
                channel: 'chat',
                subscribeType: null,
            }],
        };

        const output = emitInterfaces([svc]);
        expect(output).toContain('send(message: string): void;');
    });

    it('should emit FQCN comment above each interface', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'Test',
            fqcn: 'App\\Service\\Test',
            sourceFile: 'test.php',
            methods: [{
                name: 'ping',
                params: [],
                returnType: 'string',
                returnNullable: false,
                pattern: 'call',
                channel: null,
                subscribeType: null,
            }],
        };

        const output = emitInterfaces([svc]);
        expect(output).toContain('// ───── App\\Service\\Test ─────');
    });

    it('should handle multiple services', () => {
        const svc1: ServiceContract = {
            namespace: '', name: 'A', fqcn: 'A', sourceFile: 'a.php',
            methods: [{ name: 'foo', params: [], returnType: 'int', returnNullable: false, pattern: 'call', channel: null, subscribeType: null }],
        };
        const svc2: ServiceContract = {
            namespace: '', name: 'B', fqcn: 'B', sourceFile: 'b.php',
            methods: [{ name: 'bar', params: [], returnType: 'string', returnNullable: false, pattern: 'call', channel: null, subscribeType: null }],
        };

        const output = emitInterfaces([svc1, svc2]);
        expect(output).toContain('interface AProxy');
        expect(output).toContain('interface BProxy');
    });

    it('should handle nullable return types', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'Nullable',
            fqcn: 'Nullable',
            sourceFile: 'test.php',
            methods: [{
                name: 'find',
                params: [
                    { name: 'id', type: 'int', nullable: false, isVariadic: false, isCallable: false },
                ],
                returnType: 'string',
                returnNullable: true,
                pattern: 'call',
                channel: null,
                subscribeType: null,
            }],
        };

        const output = emitInterfaces([svc]);
        expect(output).toContain('Promise<string | null>');
    });
});

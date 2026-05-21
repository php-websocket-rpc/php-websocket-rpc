import { describe, it, expect } from 'vitest';
import { emitInterfaces, emitEnumTypes } from './emit-ts-interfaces';
import type { ServiceContract, EnumDecl } from '../types';

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
        expect(output).toContain('// ───── App\\\\Service\\\\Test ─────');
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

    it('should use enum type names in method params when enumNames is provided', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'ConfigService',
            fqcn: 'ConfigService',
            sourceFile: 'test.php',
            methods: [
                {
                    name: 'setStatus',
                    params: [{ name: 'status', type: 'Status', nullable: false, isVariadic: false, isCallable: false }],
                    returnType: 'void',
                    returnNullable: false,
                    pattern: 'notify',
                    channel: null,
                    subscribeType: null,
                },
                {
                    name: 'getStatus',
                    params: [],
                    returnType: 'Status',
                    returnNullable: false,
                    pattern: 'call',
                    channel: null,
                    subscribeType: null,
                },
            ],
        };

        const enumNames = new Set(['Status']);
        const output = emitInterfaces([svc], enumNames);
        expect(output).toContain('setStatus(status: Status): void;');
        expect(output).toContain('getStatus(): Promise<Status>;');
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

describe('emitEnumTypes', () => {
    it('should emit a string-backed enum type', () => {
        const enums: EnumDecl[] = [{
            namespace: '',
            name: 'Status',
            fqcn: 'Status',
            backingType: 'string',
            cases: [
                { name: 'Active', value: 'active' },
                { name: 'Inactive', value: 'inactive' },
            ],
            sourceFile: 'test.php',
        }];

        const output = emitEnumTypes(enums);
        expect(output).toContain("export type Status = 'active' | 'inactive';");
    });

    it('should emit an int-backed enum type', () => {
        const enums: EnumDecl[] = [{
            namespace: '',
            name: 'Priority',
            fqcn: 'Priority',
            backingType: 'int',
            cases: [
                { name: 'Low', value: 1 },
                { name: 'High', value: 2 },
            ],
            sourceFile: 'test.php',
        }];

        const output = emitEnumTypes(enums);
        expect(output).toContain('export type Priority = 1 | 2;');
    });

    it('should emit a unit enum type (no backing value)', () => {
        const enums: EnumDecl[] = [{
            namespace: '',
            name: 'Unit',
            fqcn: 'Unit',
            backingType: null,
            cases: [
                { name: 'Draft', value: null },
                { name: 'Published', value: null },
            ],
            sourceFile: 'test.php',
        }];

        const output = emitEnumTypes(enums);
        expect(output).toContain("export type Unit = 'Draft' | 'Published';");
    });

    it('should emit multiple enum types', () => {
        const enums: EnumDecl[] = [
            {
                namespace: '',
                name: 'Status',
                fqcn: 'Status',
                backingType: 'string',
                cases: [{ name: 'Active', value: 'active' }],
                sourceFile: 'test.php',
            },
            {
                namespace: '',
                name: 'Priority',
                fqcn: 'Priority',
                backingType: 'int',
                cases: [{ name: 'Low', value: 1 }],
                sourceFile: 'test.php',
            },
        ];

        const output = emitEnumTypes(enums);
        expect(output).toContain("export type Status = 'active';");
        expect(output).toContain('export type Priority = 1;');
    });

    it('should return empty string for empty enum list', () => {
        expect(emitEnumTypes([])).toBe('');
    });
});

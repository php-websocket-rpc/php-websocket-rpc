import { describe, it, expect } from 'vitest';
import { emitProxyConfigs } from './emit-proxy-configs';
import type { ServiceContract } from '../types';

describe('emitProxyConfigs', () => {
    it('should emit a call/notify config', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'MathService',
            fqcn: 'MathService',
            sourceFile: 'test.php',
            methods: [
                { name: 'add', params: [], returnType: 'int', returnNullable: false, pattern: 'call', channel: null, subscribeType: null },
                { name: 'sub', params: [], returnType: 'int', returnNullable: false, pattern: 'call', channel: null, subscribeType: null },
                { name: 'log', params: [], returnType: 'void', returnNullable: false, pattern: 'notify', channel: null, subscribeType: null },
            ],
        };

        const output = emitProxyConfigs([svc]);
        expect(output).toContain('export const MathServiceConfig');
        expect(output).toContain("service: 'MathService'");
        expect(output).toContain("call: ['add', 'sub']");
        expect(output).toContain("notify: ['log']");
    });

    it('should emit a stream config', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'NumberStreamService',
            fqcn: 'NumberStreamService',
            sourceFile: 'test.php',
            methods: [
                { name: 'count', params: [], returnType: '\\Iterator', returnNullable: false, pattern: 'stream', channel: null, subscribeType: null },
            ],
        };

        const output = emitProxyConfigs([svc]);
        expect(output).toContain("stream: ['count']");
    });

    it('should emit a subscribe config with channel', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'EventService',
            fqcn: 'EventService',
            sourceFile: 'test.php',
            methods: [
                { name: 'onEvent', params: [], returnType: 'void', returnNullable: false, pattern: 'subscribe', channel: 'events', subscribeType: 'string' },
            ],
        };

        const output = emitProxyConfigs([svc]);
        expect(output).toContain("subscribe: ['onEvent']");
        expect(output).toContain("channel: 'events'");
    });

    it('should emit a subscribe + publish config with channel', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'ChatService',
            fqcn: 'ChatService',
            sourceFile: 'test.php',
            methods: [
                { name: 'onMessage', params: [], returnType: 'void', returnNullable: false, pattern: 'subscribe', channel: 'chat', subscribeType: null },
                { name: 'send', params: [], returnType: 'void', returnNullable: false, pattern: 'publish', channel: 'chat', subscribeType: null },
            ],
        };

        const output = emitProxyConfigs([svc]);
        expect(output).toContain("subscribe: ['onMessage']");
        expect(output).toContain("publish: ['send']");
        expect(output).toContain("channel: 'chat'");
    });

    it('should omit call array if no call methods', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'OnlyStream',
            fqcn: 'OnlyStream',
            sourceFile: 'test.php',
            methods: [
                { name: 'stream', params: [], returnType: '\\Iterator', returnNullable: false, pattern: 'stream', channel: null, subscribeType: null },
            ],
        };

        const output = emitProxyConfigs([svc]);
        expect(output).not.toContain('call:');
        expect(output).not.toContain('notify:');
        expect(output).not.toContain('subscribe:');
        expect(output).not.toContain('publish:');
    });

    it('should use satisfies ProxyOptions', () => {
        const svc: ServiceContract = {
            namespace: '',
            name: 'Test',
            fqcn: 'Test',
            sourceFile: 'test.php',
            methods: [
                { name: 'doIt', params: [], returnType: 'int', returnNullable: false, pattern: 'call', channel: null, subscribeType: null },
            ],
        };

        const output = emitProxyConfigs([svc]);
        expect(output).toContain('satisfies ProxyOptions');
    });
});

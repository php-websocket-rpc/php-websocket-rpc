import { describe, it, expect } from 'vitest';
import { detectPattern } from './pattern-detector';

describe('detectPattern', () => {
    it('should detect stream pattern from RpcStream attribute', () => {
        const result = detectPattern(
            [{ name: 'RpcStream', args: {} }],
            '\\Iterator',
            false,
        );
        expect(result.pattern).toBe('stream');
        expect(result.channel).toBeNull();
    });

    it('should detect subscribe pattern from RpcSubscribe attribute', () => {
        const result = detectPattern(
            [{ name: 'RpcSubscribe', args: { _0: 'events' } }],
            'void',
            true,
        );
        expect(result.pattern).toBe('subscribe');
        expect(result.channel).toBe('events');
    });

    it('should detect subscribe with named channel argument', () => {
        const result = detectPattern(
            [{ name: 'RpcSubscribe', args: { channel: 'chat', type: 'string' } }],
            'void',
            true,
        );
        expect(result.pattern).toBe('subscribe');
        expect(result.channel).toBe('chat');
        expect(result.subscribeType).toBe('string');
    });

    it('should detect publish pattern from RpcPublish attribute', () => {
        const result = detectPattern(
            [{ name: 'RpcPublish', args: { _0: 'chat' } }],
            'void',
            false,
        );
        expect(result.pattern).toBe('publish');
        expect(result.channel).toBe('chat');
    });

    it('should detect call pattern (non-void return, no attributes)', () => {
        const result = detectPattern([], 'int', false);
        expect(result.pattern).toBe('call');
        expect(result.channel).toBeNull();
    });

    it('should detect notify pattern (void return, no attributes)', () => {
        const result = detectPattern([], 'void', false);
        expect(result.pattern).toBe('notify');
        expect(result.channel).toBeNull();
    });

    it('should detect notify when return type is null', () => {
        const result = detectPattern([], null, false);
        expect(result.pattern).toBe('notify');
    });

    it('should prioritize RpcStream over other attributes', () => {
        const result = detectPattern(
            [
                { name: 'RpcStream', args: {} },
                { name: 'RpcSubscribe', args: {} },
            ],
            'void',
            false,
        );
        expect(result.pattern).toBe('stream');
    });

    it('should use named channel from RpcSubscribe', () => {
        const result = detectPattern(
            [{ name: 'RpcSubscribe', args: { channel: 'my-channel' } }],
            'void',
            true,
        );
        expect(result.channel).toBe('my-channel');
    });

    it('should handle no channel specified', () => {
        const result = detectPattern(
            [{ name: 'RpcSubscribe', args: {} }],
            'void',
            true,
        );
        expect(result.channel).toBeNull();
    });
});

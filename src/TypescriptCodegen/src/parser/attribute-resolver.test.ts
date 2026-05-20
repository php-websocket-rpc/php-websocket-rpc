import { describe, it, expect } from 'vitest';
import { Engine } from 'php-parser';
import { resolveAttributes } from './attribute-resolver';

const parser = new Engine({
    parser: { extractDoc: false, php7: true, suppressErrors: true },
    ast: { withPositions: false },
});

/**
 * Helper: parse a fragment and extract attrGroups from a method.
 */
function parseMethodAttributes(code: string): ReturnType<typeof resolveAttributes> {
    const full = `<?php interface Test { ${code} }`;
    const ast = parser.parseCode(full, 'test.php') as any;

    // Navigate: program → interface → method → attrGroups
    for (const child of ast.children) {
        if (child.kind === 'interface') {
            for (const member of child.body) {
                if (member.kind === 'method') {
                    return resolveAttributes(member.attrGroups || []);
                }
            }
        }
    }
    return [];
}

describe('resolveAttributes', () => {
    it('should resolve positional RpcSubscribe argument', () => {
        const attrs = parseMethodAttributes(
            '#[RpcSubscribe(\'chat\')] public function onMessage(callable $cb): void',
        );
        expect(attrs).toHaveLength(1);
        expect(attrs[0].name).toBe('RpcSubscribe');
        expect(attrs[0].args['_0']).toBe('chat');
    });

    it('should resolve named RpcSubscribe arguments', () => {
        const attrs = parseMethodAttributes(
            "#[RpcSubscribe(channel: 'events', type: 'string')] public function onEvent(callable $cb): void",
        );
        expect(attrs).toHaveLength(1);
        expect(attrs[0].name).toBe('RpcSubscribe');
        expect(attrs[0].args['channel']).toBe('events');
        expect(attrs[0].args['type']).toBe('string');
    });

    it('should resolve RpcStream attribute (no arguments)', () => {
        const attrs = parseMethodAttributes(
            '#[RpcStream] public function count(int $limit): \\Iterator',
        );
        expect(attrs).toHaveLength(1);
        expect(attrs[0].name).toBe('RpcStream');
        expect(Object.keys(attrs[0].args)).toHaveLength(0);
    });

    it('should resolve RpcPublish with positional channel', () => {
        const attrs = parseMethodAttributes(
            "#[RpcPublish('chat')] public function send(string $msg): void",
        );
        expect(attrs).toHaveLength(1);
        expect(attrs[0].name).toBe('RpcPublish');
        expect(attrs[0].args['_0']).toBe('chat');
    });

    it('should handle fully qualified attribute names', () => {
        const attrs = parseMethodAttributes(
            '#[PhpWebsocketRpc\\Rpc\\Contract\\Attribute\\RpcSubscribe(\'ch\')] public function onMsg(callable $cb): void',
        );
        expect(attrs).toHaveLength(1);
        expect(attrs[0].name).toBe('RpcSubscribe');
    });

    it('should handle multiple attributes on one method', () => {
        const attrs = parseMethodAttributes(
            '#[RpcSubscribe(\'a\')] #[RpcPublish(\'b\')] public function test(): void',
        );
        expect(attrs).toHaveLength(2);
        expect(attrs[0].name).toBe('RpcSubscribe');
        expect(attrs[1].name).toBe('RpcPublish');
    });

    it('should return empty array for methods without attributes', () => {
        const attrs = parseMethodAttributes(
            'public function plain(): int',
        );
        expect(attrs).toHaveLength(0);
    });
});

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parsePhpFile } from './parse-file';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Path to the example PHP contracts file.
 * We traverse up from src/TypescriptCodegen/src/parser/ to the repo root,
 * then into examples/.
 */
function repoRoot(): string {
    // From src/TypescriptCodegen/src/parser/ up 4 levels to repo root
    return resolve(__dirname, '..', '..', '..', '..');
}

describe('parsePhpFile', () => {
    it('should parse the example contract file', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const contracts = parsePhpFile(path);

        expect(contracts).toHaveLength(4);

        const names = contracts.map((c) => c.name).sort();
        expect(names).toEqual([
            'ChatService',
            'EventService',
            'MathService',
            'NumberStreamService',
        ]);
    });

    it('should extract MathService with 4 methods', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const contracts = parsePhpFile(path);

        const math = contracts.find((c) => c.name === 'MathService');
        expect(math).toBeDefined();
        expect(math!.methods).toHaveLength(4);

        const methodNames = math!.methods.map((m) => m.name);
        expect(methodNames).toEqual(['add', 'sub', 'mul', 'log']);
    });

    it('should detect NumberStreamService count as stream pattern', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const contracts = parsePhpFile(path);

        const ns = contracts.find((c) => c.name === 'NumberStreamService');
        expect(ns).toBeDefined();
        expect(ns!.methods).toHaveLength(1);
        expect(ns!.methods[0].name).toBe('count');
        expect(ns!.methods[0].pattern).toBe('stream');
        expect(ns!.methods[0].params[0].type).toBe('int');
    });

    it('should detect EventService onEvent as subscribe with channel & type', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const contracts = parsePhpFile(path);

        const evt = contracts.find((c) => c.name === 'EventService');
        expect(evt).toBeDefined();
        expect(evt!.methods).toHaveLength(1);
        expect(evt!.methods[0].pattern).toBe('subscribe');
        expect(evt!.methods[0].channel).toBe('events');
        expect(evt!.methods[0].subscribeType).toBe('string');
    });

    it('should detect ChatService with subscribe + publish patterns', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const contracts = parsePhpFile(path);

        const chat = contracts.find((c) => c.name === 'ChatService');
        expect(chat).toBeDefined();
        expect(chat!.methods).toHaveLength(2);

        const onMsg = chat!.methods.find((m) => m.name === 'onMessage');
        const send = chat!.methods.find((m) => m.name === 'send');

        expect(onMsg?.pattern).toBe('subscribe');
        expect(onMsg?.channel).toBe('chat');

        expect(send?.pattern).toBe('publish');
        expect(send?.channel).toBe('chat');
        expect(send?.params[0].type).toBe('string');
    });

    it('should handle a file with no contracts gracefully', () => {
        const path = resolve(repoRoot(), 'examples', 'server.php');
        const contracts = parsePhpFile(path);
        // server.php has no interfaces, just classes and functions
        expect(contracts).toHaveLength(0);
    });
});

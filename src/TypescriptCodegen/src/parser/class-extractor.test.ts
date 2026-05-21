import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parsePhpFile } from './parse-file';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root: src/TypescriptCodegen/src/parser/ → 4 levels up */
function repoRoot(): string {
    return resolve(__dirname, '..', '..', '..', '..');
}

function fixturesDir(): string {
    return resolve(repoRoot(), 'src', 'TypescriptCodegen', 'test', 'fixtures');
}

describe('class-extractor', () => {
    it('should extract Message class with public properties', () => {
        const path = resolve(fixturesDir(), 'dto-contract.php');
        const { classes } = parsePhpFile(path);

        const msg = classes.find((c) => c.name === 'Message');
        expect(msg).toBeDefined();
        expect(msg!.fqcn).toBe('App\\Dto\\Message');

        // Should have 4 properties: id, text, timestamp, attachmentUrl
        // (secret, internal, meta should be skipped)
        expect(msg!.properties).toHaveLength(4);

        const id = msg!.properties.find((p) => p.name === 'id');
        expect(id).toBeDefined();
        expect(id!.type).toBe('string');
        expect(id!.nullable).toBe(false);
        expect(id!.hasDefault).toBe(false);

        const text = msg!.properties.find((p) => p.name === 'text');
        expect(text).toBeDefined();
        expect(text!.type).toBe('string');

        const ts = msg!.properties.find((p) => p.name === 'timestamp');
        expect(ts).toBeDefined();
        expect(ts!.type).toBe('int');

        const att = msg!.properties.find((p) => p.name === 'attachmentUrl');
        expect(att).toBeDefined();
        expect(att!.type).toBe('string');
        expect(att!.nullable).toBe(true);
        expect(att!.hasDefault).toBe(true);
    });

    it('should extract Order class with promoted constructor properties', () => {
        const path = resolve(fixturesDir(), 'dto-contract.php');
        const { classes } = parsePhpFile(path);

        const order = classes.find((c) => c.name === 'Order');
        expect(order).toBeDefined();
        expect(order!.fqcn).toBe('App\\Dto\\Order');

        // Should have 3 properties: orderId, amount, note
        // (internalNote should be skipped — protected)
        expect(order!.properties).toHaveLength(3);

        const orderId = order!.properties.find((p) => p.name === 'orderId');
        expect(orderId).toBeDefined();
        expect(orderId!.type).toBe('string');
        expect(orderId!.nullable).toBe(false);

        const amount = order!.properties.find((p) => p.name === 'amount');
        expect(amount).toBeDefined();
        expect(amount!.type).toBe('int');
        expect(amount!.nullable).toBe(false);

        const note = order!.properties.find((p) => p.name === 'note');
        expect(note).toBeDefined();
        expect(note!.type).toBe('string');
        expect(note!.nullable).toBe(true);
        expect(note!.hasDefault).toBe(true);
    });

    it('should extract no classes from a file with no classes', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const { classes } = parsePhpFile(path);
        expect(classes).toHaveLength(0);
    });

    it('should correctly set namespace and FQCN', () => {
        const path = resolve(fixturesDir(), 'dto-contract.php');
        const { classes } = parsePhpFile(path);

        expect(classes).toHaveLength(2);
        for (const cls of classes) {
            expect(cls.namespace).toBe('App\\Dto');
            expect(cls.fqcn).toContain('App\\Dto\\');
            expect(cls.sourceFile).toBe(path);
        }
    });
});

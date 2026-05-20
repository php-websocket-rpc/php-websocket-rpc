import { readFileSync } from 'node:fs';
import { Engine } from 'php-parser';
import type { Program } from 'php-parser';
import { extractContracts } from './interface-extractor.js';
import type { ServiceContract } from '../types.js';

const parser = new Engine({
    parser: {
        extractDoc: false,
        php7: true,
        suppressErrors: true,
    },
    ast: {
        withPositions: false,
    },
});

/**
 * Parse a single PHP file and extract service contracts.
 */
export function parsePhpFile(filePath: string): ServiceContract[] {
    const source = readFileSync(filePath, 'utf-8');

    let ast: Program;
    try {
        ast = parser.parseCode(source, filePath) as unknown as Program;
    } catch (err) {
        console.error(`[warn] Failed to parse ${filePath}:`, (err as Error).message);
        return [];
    }

    return extractContracts(ast, filePath);
}

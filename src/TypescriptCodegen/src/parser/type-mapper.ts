import type { Identifier } from 'php-parser';
import type { ParamDecl } from '../types.js';

/**
 * Map a PHP type AST node (Identifier or Identifier[] for union types)
 * to a TypeScript type string.
 */
export function mapPhpTypeToTs(
    typeNode: Identifier | Identifier[] | null,
    nullable: boolean,
): string {
    if (typeNode === null) return 'unknown';

    const types: string[] = [];

    if (Array.isArray(typeNode)) {
        // Union type: int|string → number|string
        for (const t of typeNode) {
            types.push(mapSingleType(t.name));
        }
    } else {
        types.push(mapSingleType(typeNode.name));
    }

    // If nullable and the type is not already including null
    if (nullable && !types.includes('null')) {
        types.push('null');
    }

    return types.join(' | ');
}

/**
 * Map a single PHP type name to TypeScript.
 */
function mapSingleType(phpType: string): string {
    switch (phpType) {
        case 'int':
        case 'float':
            return 'number';
        case 'string':
            return 'string';
        case 'bool':
            return 'boolean';
        case 'void':
            return 'void';
        case 'mixed':
        case 'object':
            return 'unknown';
        case 'array':
            return 'unknown[]';
        case 'null':
            return 'null';
        case 'callable':
            return '(...args: unknown[]) => unknown';
        case 'self':
            return 'any';
        case 'true':
            return 'true';
        case 'false':
            return 'false';
        case 'never':
            return 'never';
        default:
            // Class type — could be a value object from classMap
            return 'Record<string, unknown>';
    }
}

/**
 * Map a parameter's type for the subscribe callback value.
 * Returns the inner type the callback receives.
 */
export function mapSubscribeType(subscribeType: string | null): string {
    if (!subscribeType) return 'unknown';

    switch (subscribeType) {
        case 'int':
        case 'float':
            return 'number';
        case 'string':
            return 'string';
        case 'bool':
            return 'boolean';
        case 'array':
            return 'unknown[]';
        default:
            return 'unknown';
    }
}

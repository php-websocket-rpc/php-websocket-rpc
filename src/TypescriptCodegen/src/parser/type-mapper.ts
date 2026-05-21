import type { Identifier } from 'php-parser';

/**
 * Map a PHP type AST node (Identifier or Identifier[] for union types)
 * to a TypeScript type string.
 *
 * @param typeNode   The PHP type AST node
 * @param nullable   Whether the type is nullable
 * @param enumNames  Optional set of known enum short names
 * @param classNames Optional set of known class short names
 */
export function mapPhpTypeToTs(
    typeNode: Identifier | Identifier[] | null,
    nullable: boolean,
    enumNames?: Set<string>,
    classNames?: Set<string>,
): string {
    if (typeNode === null) return 'unknown';

    const types: string[] = [];

    if (Array.isArray(typeNode)) {
        // Union type: int|string → number|string
        for (const t of typeNode) {
            types.push(mapSingleType(t.name, enumNames, classNames));
        }
    } else {
        types.push(mapSingleType(typeNode.name, enumNames, classNames));
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
function mapSingleType(
    phpType: string,
    enumNames?: Set<string>,
    classNames?: Set<string>,
): string {
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
            // Check if this is a known enum type
            if (enumNames?.has(phpType)) {
                return phpType;
            }
            // Check if this is a known class type (DTO)
            if (classNames?.has(phpType)) {
                return phpType;
            }
            // Class type — could be a value object from classMap
            return 'Record<string, unknown>';
    }
}

/**
 * Map a parameter's type for the subscribe callback value.
 * Returns the inner type the callback receives.
 *
 * @param subscribeType The PHP type name
 * @param enumNames     Optional set of known enum short names
 * @param classNames    Optional set of known class short names
 */
export function mapSubscribeType(
    subscribeType: string | null,
    enumNames?: Set<string>,
    classNames?: Set<string>,
): string {
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
            // Check if this is a known enum type
            if (enumNames?.has(subscribeType)) {
                return subscribeType;
            }
            // Check if this is a known class type
            if (classNames?.has(subscribeType)) {
                return subscribeType;
            }
            return 'unknown';
    }
}

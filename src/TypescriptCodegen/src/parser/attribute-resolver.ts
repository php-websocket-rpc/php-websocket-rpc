import type { Attribute, AttrGroup } from 'php-parser';

/**
 * Resolved attribute data for a single attribute on a method or interface.
 */
export interface AttributeInfo {
    name: string;              // short name, e.g. "RpcSubscribe"
    args: Record<string, string | null>;  // named/positional args
}

/**
 * Extract attribute info from an array of AttrGroup nodes.
 */
export function resolveAttributes(attrGroups: AttrGroup[]): AttributeInfo[] {
    const result: AttributeInfo[] = [];

    for (const group of attrGroups) {
        for (const attr of group.attrs) {
            const info = resolveAttribute(attr);
            if (info) result.push(info);
        }
    }

    return result;
}

/**
 * Resolve a single Attribute node to its name and arguments.
 */
function resolveAttribute(attr: Attribute): AttributeInfo | null {
    // attr.name is a string like "RpcSubscribe" or "PhpWebsocketRpc\\Rpc\\Contract\\Attribute\\RpcSubscribe"
    const fullName = attr.name;
    const shortName = fullName.includes('\\')
        ? fullName.split('\\').pop()!
        : fullName;

    const args: Record<string, string | null> = {};
    let positionalIndex = 0;

    for (const arg of attr.args) {
        resolveAttributeArg(arg, args, positionalIndex);
        positionalIndex++;
    }

    return { name: shortName, args };
}

/**
 * Resolve a single attribute argument.
 *
 * php-parser AST varies by arg style:
 *   - Named:    { kind: 'parameter', name: { name: 'channel' }, value: { kind: 'string', value: 'chat' } }
 *   - Positional: { kind: 'string', value: 'chat' }  (direct expression node)
 */
function resolveAttributeArg(
    arg: any,
    out: Record<string, string | null>,
    positionalIndex: number,
): void {
    // Check if it's a named argument
    if (arg.kind === 'namedargument') {
        // Named argument: arg.name is a plain string, arg.value is the expression
        const key = typeof arg.name === 'string' ? arg.name : null;
        if (key) {
            out[key] = extractLiteralValue(arg.value);
            return;
        }
    }

    // Check if it's a Parameter-based named argument
    if (arg.kind === 'parameter' || arg.kind === 'param') {
        let key: string | null = null;
        if (arg.name && typeof arg.name === 'object' && 'name' in arg.name) {
            key = (arg.name as { name: string }).name;
        } else if (typeof arg.name === 'string') {
            key = arg.name;
        }
        if (key) {
            out[key] = extractLiteralValue(arg.value);
            return;
        }
    }

    // Positional argument (direct expression node) or unnamed parameter
    out[`_${positionalIndex}`] = extractLiteralValue(arg);
}

/**
 * Extract a literal value from an expression node.
 */
function extractLiteralValue(node: any): string | null {
    if (!node) return null;

    switch (node.kind) {
        case 'string':
            return node.value as string;
        case 'number':
            return String(node.value);
        case 'boolean':
            return node.value ? 'true' : 'false';
        case 'null':
            return null;
        case 'identifier':
            // A constant reference like `PHP_INT_MAX`
            return node.name as string || null;
        case 'staticlookup':
            // Foo::class — extract the short class name
            // node.what is { kind: 'name', name: 'Foo' } or { kind: 'name', name: '\Ns\Foo' }
            const raw = node.what?.name;
            if (typeof raw === 'string') {
                const parts = raw.replace(/^\\/, '').split('\\');
                return parts[parts.length - 1] || null;
            }
            return null;
        default:
            return null;
    }
}

import type {
    Program,
    Namespace,
    Interface,
    Method,
    Parameter,
    Identifier,
} from 'php-parser';
import type { ServiceContract, ServiceMethod, ParamDecl } from '../types.js';
import { resolveAttributes } from './attribute-resolver.js';
import { detectPattern } from './pattern-detector.js';

/**
 * Extract service contracts from a parsed PHP AST (Program node).
 */
export function extractContracts(
    ast: Program,
    sourceFile: string,
): ServiceContract[] {
    const contracts: ServiceContract[] = [];

    // Walk top-level children — find Namespace and Interface declarations
    for (const child of ast.children) {
        if (child.kind === 'namespace') {
            extractFromNamespace(child as Namespace, contracts, sourceFile);
        } else if (child.kind === 'interface') {
            // Interface at file level (no namespace)
            const contract = extractInterface(
                child as Interface,
                '',
                sourceFile,
            );
            if (contract) contracts.push(contract);
        }
    }

    return contracts;
}

/**
 * Extract contracts from within a namespace block.
 */
function extractFromNamespace(
    ns: Namespace,
    contracts: ServiceContract[],
    sourceFile: string,
): void {
    const namespaceName = resolveNamespaceName(ns);

    for (const child of ns.children) {
        if (child.kind === 'interface') {
            const contract = extractInterface(
                child as Interface,
                namespaceName,
                sourceFile,
            );
            if (contract) contracts.push(contract);
        }
    }
}

/**
 * Resolve the namespace name from a Namespace node.
 */
function resolveNamespaceName(ns: Namespace): string {
    if (ns.name && typeof ns.name === 'object' && 'name' in ns.name) {
        return (ns.name as { name: string }).name;
    }
    return '';
}

/**
 * Extract a single ServiceContract from an Interface AST node.
 */
function extractInterface(
    iface: Interface,
    namespace: string,
    sourceFile: string,
): ServiceContract | null {
    const name = resolveNodeName(iface.name);
    if (!name) return null;

    // Check interface-level attributes (e.g., #[RpcService] — currently unused)
    const ifaceAttrs = resolveAttributes(iface.attrGroups || []);

    const methods: ServiceMethod[] = [];

    for (const member of iface.body) {
        if (member.kind === 'method') {
            const method = extractMethod(
                member as Method,
                ifaceAttrs,
            );
            if (method) methods.push(method);
        }
    }

    if (methods.length === 0) return null;

    const fqcn = namespace ? `${namespace}\\${name}` : name;

    return {
        namespace,
        name,
        fqcn,
        methods,
        sourceFile,
    };
}

/**
 * Extract a single ServiceMethod from a Method AST node.
 */
function extractMethod(
    method: Method,
    _inheritedAttrs: any[],  // interface-level attributes (unused currently)
): ServiceMethod | null {
    const name = resolveNodeName(method.name);
    if (!name) return null;

    // Resolve method-level attributes
    const attrs = resolveAttributes(method.attrGroups || []);

    // Extract parameters
    const params: ParamDecl[] = [];
    let hasCallableParam = false;

    for (const param of method.arguments || []) {
        const pd = extractParameter(param);
        params.push(pd);
        if (pd.isCallable) hasCallableParam = true;
    }

    // Return type
    const returnType = method.type
        ? resolveTypeName(method.type)
        : null;
    const returnNullable = method.nullable || false;

    // Detect pattern
    const { pattern, channel, subscribeType } = detectPattern(
        attrs,
        returnType,
        hasCallableParam,
    );

    return {
        name,
        params,
        returnType,
        returnNullable,
        pattern,
        channel,
        subscribeType,
    };
}

/**
 * Extract a parameter declaration.
 */
function extractParameter(param: Parameter): ParamDecl {
    const name = resolveNodeName(param.name);
    const type = param.type ? resolveTypeName(param.type) : null;
    const isCallable = type === 'callable';

    return {
        name: name || `arg${Math.random().toString(36).slice(2, 6)}`,
        type,
        nullable: param.nullable || false,
        isVariadic: param.variadic || false,
        isCallable,
    };
}

/**
 * Resolve a node name that could be Identifier | string | { name: string }.
 */
function resolveNodeName(
    node: Identifier | string | { name: string } | null | undefined,
): string | null {
    if (!node) return null;
    if (typeof node === 'string') return node;
    if (typeof node === 'object' && 'name' in node) {
        return (node as { name: string }).name;
    }
    return null;
}

/**
 * Resolve a type node (Identifier or Identifier[]).
 * Returns the PHP type name as a string.
 */
function resolveTypeName(
    type: Identifier | Identifier[] | { name: string },
): string {
    if (Array.isArray(type)) {
        // Union type — return the first one for simplicity,
        // but we handle full union in type-mapper.ts
        return type.map((t) => t.name).join('|');
    }
    if (typeof type === 'object' && 'name' in type) {
        return (type as { name: string }).name;
    }
    return 'unknown';
}

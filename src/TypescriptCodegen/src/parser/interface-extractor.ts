import type {
    Program,
    Namespace,
    Interface,
    Method,
    Parameter,
    Identifier,
    Enum,
    EnumCase,
} from 'php-parser';
import type { ServiceContract, ServiceMethod, ParamDecl, EnumDecl, ParsedFile } from '../types.js';
import { resolveAttributes } from './attribute-resolver.js';
import { detectPattern } from './pattern-detector.js';

/**
 * Extract service contracts and enums from a parsed PHP AST (Program node).
 */
export function extractContracts(
    ast: Program,
    sourceFile: string,
): ParsedFile {
    const contracts: ServiceContract[] = [];
    const enums: EnumDecl[] = [];

    // Walk top-level children — find Namespace, Interface, Enum declarations
    for (const child of ast.children) {
        if (child.kind === 'namespace') {
            const ns = child as Namespace;
            extractFromNamespace(ns, contracts, enums, sourceFile);
        } else if (child.kind === 'interface') {
            // Interface at file level (no namespace)
            const contract = extractInterface(
                child as Interface,
                '',
                sourceFile,
            );
            if (contract) contracts.push(contract);
        } else if (child.kind === 'enum') {
            // Enum at file level (no namespace)
            const enumDecl = extractEnum(child as Enum, '', sourceFile);
            if (enumDecl) enums.push(enumDecl);
        }
    }

    return { contracts, enums, classes: [] };
}

/**
 * Extract contracts and enums from within a namespace block.
 */
function extractFromNamespace(
    ns: Namespace,
    contracts: ServiceContract[],
    enums: EnumDecl[],
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
        } else if (child.kind === 'enum') {
            const enumDecl = extractEnum(child as Enum, namespaceName, sourceFile);
            if (enumDecl) enums.push(enumDecl);
        }
    }
}

/**
 * Resolve the namespace name from a Namespace node.
 * php-parser can return the name as a plain string or as an Identifier object.
 */
function resolveNamespaceName(ns: Namespace): string {
    if (!ns.name) return '';
    if (typeof ns.name === 'string') return ns.name;
    if (typeof ns.name === 'object' && 'name' in ns.name) {
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
 * Extract the raw value from an AST node or primitive.
 * php-parser returns AST nodes for enum case values (e.g. { kind: 'string', value: 'active' }).
 */
function extractCaseValue(
    value: unknown,
): string | number | null {
    if (value === null || value === undefined) return null;

    // Handle raw primitives (fallback)
    if (typeof value === 'string' || typeof value === 'number') return value;

    // Handle AST node objects
    if (typeof value === 'object' && value !== null) {
        const node = value as Record<string, unknown>;
        if (node.kind === 'string' && typeof node.value === 'string') {
            return node.value;
        }
        if (node.kind === 'number') {
            const num = String(node.value);
            return parseInt(num, 10);
        }
    }

    return null;
}

/**
 * Extract a single EnumDecl from an Enum AST node.
 */
function extractEnum(
    enumNode: Enum,
    namespace: string,
    sourceFile: string,
): EnumDecl | null {
    const name = resolveNodeName(enumNode.name);
    if (!name) return null;

    // Determine backing type from valueType AST node
    const backingType = enumNode.valueType
        ? resolveTypeName(enumNode.valueType)
        : null;

    // Extract cases
    const cases: { name: string; value: string | number | null }[] = [];

    for (const member of enumNode.body) {
        if (member.kind === 'enumcase') {
            const ec = member as unknown as EnumCase;
            const caseName = resolveNodeName(ec.name);
            if (caseName) {
                cases.push({
                    name: caseName,
                    value: extractCaseValue(ec.value),
                });
            }
        }
    }

    const fqcn = namespace ? `${namespace}\\${name}` : name;

    return {
        namespace,
        name,
        fqcn,
        backingType,
        cases,
        sourceFile,
    };
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

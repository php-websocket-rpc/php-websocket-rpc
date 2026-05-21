import type {
    Program,
    Namespace,
    Identifier,
} from 'php-parser';
import type { ClassDecl, PropertyDecl } from '../types.js';

/**
 * Extract class DTO declarations from a parsed PHP AST (Program node).
 *
 * Scans top-level and namespace-children for 'class' nodes,
 * extracting only public properties and public constructor-promoted properties.
 */
export function extractClasses(
    ast: Program,
    sourceFile: string,
): ClassDecl[] {
    const classes: ClassDecl[] = [];

    for (const child of ast.children) {
        if (child.kind === 'namespace') {
            const ns = child as Namespace;
            const namespaceName = resolveNamespaceName(ns);
            for (const nsChild of ns.children) {
                if (nsChild.kind === 'class') {
                    const cls = extractClass(
                        nsChild as any,
                        namespaceName,
                        sourceFile,
                    );
                    if (cls) classes.push(cls);
                }
            }
        } else if (child.kind === 'class') {
            const cls = extractClass(child as any, '', sourceFile);
            if (cls) classes.push(cls);
        }
    }

    return classes;
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
 * Extract a single ClassDecl from a class AST node.
 */
function extractClass(
    classNode: any,
    namespace: string,
    sourceFile: string,
): ClassDecl | null {
    const name = resolveNodeName(classNode.name);
    if (!name) return null;

    // Resolve parent class (extends)
    let extendsFqcn: string | null = null;
    if (classNode.extends) {
        const parentName = resolveNodeName(classNode.extends);
        if (parentName) {
            // If parentName starts with \, it's already fully qualified; strip the leading \
            // Otherwise prepend the current namespace
            extendsFqcn = parentName.startsWith('\\')
                ? parentName.replace(/^\\/, '')
                : namespace ? `${namespace}\\${parentName}` : parentName;
        }
    }

    const properties: PropertyDecl[] = [];
    const seen = new Set<string>();

    // 1. Extract public properties from propertystatement nodes
    for (const member of classNode.body || []) {
        if (member.kind === 'propertystatement') {
            // Skip non-public or static
            if (member.visibility !== 'public') continue;
            if (member.isStatic === true) continue;

            for (const prop of member.properties || []) {
                const propName = resolveNodeName(prop.name);
                if (!propName || seen.has(propName)) continue;

                seen.add(propName);
                properties.push({
                    name: propName,
                    type: prop.type ? prop.type.name : null,
                    nullable: prop.nullable || false,
                    hasDefault: prop.value !== null && prop.value !== undefined,
                });
            }
        }
    }

    // 2. Extract public constructor-promoted properties
    // php-parser encodes visibility in the `flags` field on Parameter nodes:
    //   flags === 0  → plain parameter (not promoted)
    //   flags & 1    → public promoted
    //   flags & 2    → protected promoted
    //   flags & 4    → private promoted
    for (const member of classNode.body || []) {
        if (
            member.kind === 'method'
            && member.name
            && resolveNodeName(member.name) === '__construct'
        ) {
            for (const param of member.arguments || []) {
                if (typeof param.flags !== 'number' || param.flags === 0) continue;
                // Only include public promoted params (flags & 1)
                if ((param.flags & 1) !== 1) continue;

                const paramName = resolveNodeName(param.name);
                if (!paramName || seen.has(paramName)) continue;

                seen.add(paramName);
                properties.push({
                    name: paramName,
                    type: param.type ? param.type.name : null,
                    nullable: param.nullable || false,
                    hasDefault: param.value !== null && param.value !== undefined,
                });
            }
        }
    }

    if (properties.length === 0) return null;

    const fqcn = namespace ? `${namespace}\\${name}` : name;

    return {
        namespace,
        name,
        fqcn,
        properties,
        sourceFile,
        extendsFqcn,
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

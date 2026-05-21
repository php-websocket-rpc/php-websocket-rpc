import type { ServiceContract, ServiceMethod, ParamDecl, EnumDecl, ClassDecl } from '../types.js';
import { mapPhpTypeToTs, mapSubscribeType } from '../parser/type-mapper.js';

/**
 * Generate TypeScript enum type definitions from parsed PHP enums.
 *
 * String-backed enums → union of string literals (e.g., type Status = 'active' | 'inactive')
 * Int-backed enums    → union of number literals (e.g., type Priority = 1 | 2 | 3)
 * Unit enums          → union of case name literals (e.g., type Unit = 'Active' | 'Inactive')
 */
export function emitEnumTypes(enums: EnumDecl[]): string {
    if (enums.length === 0) return '';

    const blocks: string[] = [];

    for (const e of enums) {
        if (e.backingType === 'string') {
            const values = e.cases.map((c) => `'${c.value}'`).join(' | ');
            blocks.push(`export type ${e.name} = ${values};`);
        } else if (e.backingType === 'int') {
            const values = e.cases.map((c) => `${c.value}`).join(' | ');
            blocks.push(`export type ${e.name} = ${values};`);
        } else {
            // Unit enum — use case names as string literals
            const values = e.cases.map((c) => `'${c.name}'`).join(' | ');
            blocks.push(`export type ${e.name} = ${values};`);
        }
    }

    return blocks.join('\n') + '\n';
}

// ─── Class DTO Interfaces ────────────────────────────────────────

/**
 * Generate TypeScript interfaces for PHP class DTOs.
 */
export function emitClassInterfaces(
    classes: ClassDecl[],
    typeNames?: Set<string>,
): string {
    if (classes.length === 0) return '';

    const blocks: string[] = [];

    for (const cls of classes) {
        blocks.push(emitClassInterface(cls, typeNames));
    }

    return blocks.join('\n');
}

/**
 * Generate a single TypeScript interface for a PHP DTO class.
 */
function emitClassInterface(
    cls: ClassDecl,
    typeNames?: Set<string>,
): string {
    if (cls.properties.length === 0) return '';

    const lines: string[] = [];
    lines.push(`// ───── ${cls.fqcn.replace(/\\/g, '\\\\')} ─────`);

    // Only emit `extends` when the parent class is also in the parsed type set.
    // This avoids generating `extends Payload` for framework base classes
    // that don't have a corresponding TypeScript interface in the output.
    let extendsClause = '';
    if (cls.extendsFqcn) {
        const parentShortName = cls.extendsFqcn.split('\\').pop()!;
        if (typeNames?.has(parentShortName)) {
            extendsClause = ` extends ${parentShortName}`;
        }
    }
    lines.push(`export interface ${cls.name}${extendsClause} {`);

    for (const prop of cls.properties) {
        const tsType = prop.type
            ? mapPhpTypeToTs(
                { name: prop.type } as any,
                prop.nullable,
                typeNames,
            )
            : 'unknown';
        const optional = prop.nullable || prop.hasDefault ? '?' : '';
        lines.push(`    ${prop.name}${optional}: ${tsType};`);
    }

    lines.push('}');
    return lines.join('\n') + '\n';
}

// ─── ClassMap: FQCN-to-Type mapping for wire deserialization ─────

/**
 * Generate a `classMap` constant that maps PHP FQCN strings to factory
 * functions for wire deserialization.
 *
 * The TS client's `decodeWireValue()` in contract-proxy.ts uses this map
 * when it receives a wire value in `[FQCN, props]` format — it looks up
 * the FQCN in classMap and calls the factory to reconstruct the typed object.
 *
 * Only class DTOs generate entries. Enums are scalars on the wire (string/int),
 * so they don't need deserialization.
 *
 * Usage in user code:
 * ```typescript
 * import { ChatServiceConfig, classMap } from './generated/contracts';
 * const proxy = createContractProxy(client, {
 *     ...ChatServiceConfig,
 *     classMap,
 * });
 * ```
 */
export function emitClassMap(classes: ClassDecl[]): string {
    if (classes.length === 0) return '';

    const lines: string[] = [];
    lines.push('// ───── Wire deserialization map ─────');
    lines.push('// Maps PHP FQCN → factory function for [FQCN, props] wire format.');
    lines.push('export const classMap: Record<string, (data: Record<string, unknown>) => unknown> = {');

    for (const cls of classes) {
        const escapedFqcn = cls.fqcn.replace(/\\/g, '\\\\');
        lines.push(`    '${escapedFqcn}': (data) => data as ${cls.name},`);
    }

    lines.push('};');
    lines.push('');

    return lines.join('\n');
}

// ─── Contract Interfaces ─────────────────────────────────────────

/**
 * Generate TypeScript interface code for all services.
 */
export function emitInterfaces(
    services: ServiceContract[],
    typeNames?: Set<string>,
): string {
    const blocks: string[] = [];

    for (const svc of services) {
        blocks.push(emitInterfaceForService(svc, typeNames));
    }

    return blocks.join('\n');
}

/**
 * Generate a single TypeScript interface for a service.
 */
function emitInterfaceForService(
    svc: ServiceContract,
    typeNames?: Set<string>,
): string {
    const interfaceName = `${svc.name}Proxy`;
    const lines: string[] = [];

    lines.push(`// ───── ${svc.fqcn.replace(/\\/g, '\\\\')} ─────`);
    lines.push(`export interface ${interfaceName} {`);

    for (const method of svc.methods) {
        const sig = emitMethodSignature(method, typeNames);
        lines.push(`    ${sig}`);
    }

    lines.push('}');

    return lines.join('\n') + '\n';
}

/**
 * Emit a single method signature within the interface.
 */
function emitMethodSignature(
    method: ServiceMethod,
    typeNames?: Set<string>,
): string {
    const params = method.params.map((p) => emitParam(p, typeNames)).join(', ');

    let returnType: string;

    switch (method.pattern) {
        case 'call':
            returnType = `Promise<${mapPhpTypeToTs(
                method.returnType ? { name: method.returnType } as any : null,
                method.returnNullable,
                typeNames,
            )}>`;
            break;

        case 'stream': {
            const streamType = inferStreamType(method, typeNames);
            returnType = `AsyncIterable<${streamType}>`;
            break;
        }

        case 'subscribe': {
            const valueType = method.subscribeType
                ? mapSubscribeType(method.subscribeType, typeNames)
                : 'unknown';
            returnType = 'void';
            const callbackParam = `callback: (value: ${valueType}) => void`;
            const nonCallbackParams = method.params.filter((p) => !p.isCallable);
            const allParams = [
                ...nonCallbackParams.map((p) => emitParam(p, typeNames)),
                callbackParam,
            ];
            return `${method.name}(${allParams.join(', ')}): ${returnType};`;
        }

        case 'publish':
        case 'notify':
            returnType = 'void';
            break;

        default:
            returnType = 'unknown';
    }

    return `${method.name}(${params}): ${returnType};`;
}

/**
 * Emit a single parameter declaration.
 */
function emitParam(
    param: ParamDecl,
    typeNames?: Set<string>,
): string {
    const tsType = param.type
        ? mapPhpTypeToTs(
            { name: param.type } as any,
            param.nullable,
            typeNames,
        )
        : 'unknown';
    return `${param.name}${param.nullable ? '?' : ''}: ${tsType}`;
}

/**
 * Infer the yielded type for a stream method.
 */
function inferStreamType(
    method: ServiceMethod,
    typeNames?: Set<string>,
): string {
    if (
        method.returnType === 'Iterator'
        || method.returnType === '\\Iterator'
        || method.returnType === 'iterable'
    ) {
        if (method.params.length > 0) {
            const p = method.params[0];
            if (p.type) {
                return mapPhpTypeToTs(
                    { name: p.type } as any,
                    false,
                    typeNames,
                );
            }
        }
    } else if (method.returnType) {
        const mapped = mapPhpTypeToTs(
            { name: method.returnType } as any,
            method.returnNullable,
            typeNames,
        );
        if (mapped !== 'unknown') return mapped;
    }

    return 'unknown';
}

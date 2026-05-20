import type { ServiceContract, ServiceMethod, ParamDecl } from '../types.js';
import { mapPhpTypeToTs, mapSubscribeType } from '../parser/type-mapper.js';

/**
 * Generate TypeScript interface code for all services.
 */
export function emitInterfaces(services: ServiceContract[]): string {
    const blocks: string[] = [];

    for (const svc of services) {
        blocks.push(emitInterfaceForService(svc));
    }

    return blocks.join('\n');
}

/**
 * Generate a single TypeScript interface for a service.
 */
function emitInterfaceForService(svc: ServiceContract): string {
    const interfaceName = `${svc.name}Proxy`;
    const lines: string[] = [];

    lines.push(`// ───── ${svc.fqcn} ─────`);
    lines.push(`export interface ${interfaceName} {`);

    for (const method of svc.methods) {
        const sig = emitMethodSignature(method);
        lines.push(`    ${sig}`);
    }

    lines.push('}');

    return lines.join('\n') + '\n';
}

/**
 * Emit a single method signature within the interface.
 */
function emitMethodSignature(method: ServiceMethod): string {
    const params = method.params.map((p) => emitParam(p)).join(', ');

    let returnType: string;

    switch (method.pattern) {
        case 'call':
            returnType = `Promise<${mapPhpTypeToTs(
                method.returnType ? { name: method.returnType } as any : null,
                method.returnNullable,
            )}>`;
            break;

        case 'stream': {
            // Stream return type is Iterator<T> in PHP
            // Figure out the yielded type from the return type or first param
            const streamType = inferStreamType(method);
            returnType = `AsyncIterable<${streamType}>`;
            break;
        }

        case 'subscribe': {
            // Subscribe: last param is callback, return void
            const valueType = method.subscribeType
                ? mapSubscribeType(method.subscribeType)
                : 'unknown';
            returnType = 'void';
            // Transform params: replace callable with callback signature
            const callbackParam = `callback: (value: ${valueType}) => void`;
            const nonCallbackParams = method.params.filter((p) => !p.isCallable);
            const allParams = [
                ...nonCallbackParams.map((p) => emitParam(p)),
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
function emitParam(param: ParamDecl): string {
    const tsType = param.type
        ? mapPhpTypeToTs({ name: param.type } as any, param.nullable)
        : 'unknown';
    return `${param.name}${param.nullable ? '?' : ''}: ${tsType}`;
}

/**
 * Infer the yielded type for a stream method.
 * Uses the first PHPDoc-like pattern or falls back to the first param type.
 */
function inferStreamType(method: ServiceMethod): string {
    // Stream methods typically yield the same type as the first parameter or a generic type
    if (method.returnType === 'Iterator' || method.returnType === '\\Iterator' || method.returnType === 'iterable') {
        // Try to infer from return type annotation in docblock is not available,
        // fall back to first param type or generic
        if (method.params.length > 0) {
            const p = method.params[0];
            if (p.type) {
                return mapPhpTypeToTs({ name: p.type } as any, false);
            }
        }
    } else if (method.returnType) {
        // If return type is something specific like Generator<int>
        // (not handled by php-parser for parameterized generics), fall through
        const mapped = mapPhpTypeToTs({ name: method.returnType } as any, method.returnNullable);
        if (mapped !== 'unknown') return mapped;
    }

    return 'unknown';
}

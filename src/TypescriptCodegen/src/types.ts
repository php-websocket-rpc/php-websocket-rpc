/**
 * Parsed parameter declaration.
 */
export interface ParamDecl {
    name: string;
    type: string | null;  // PHP type name (e.g. "int", "string", null if untyped)
    nullable: boolean;
    isVariadic: boolean;
    isCallable: boolean;  // true if type is "callable"
}

/**
 * RPC pattern assigned to a method.
 */
export type MethodPattern = 'call' | 'notify' | 'stream' | 'subscribe' | 'publish';

/**
 * Parsed service method.
 */
export interface ServiceMethod {
    name: string;
    params: ParamDecl[];
    returnType: string | null;
    returnNullable: boolean;
    pattern: MethodPattern;
    channel: string | null;        // from #[RpcSubscribe('ch')] or #[RpcPublish('ch')]
    subscribeType: string | null;  // type hint from #[RpcSubscribe(type: 'string')]
}

/**
 * Parsed service contract.
 */
export interface ServiceContract {
    namespace: string;
    name: string;
    fqcn: string;
    methods: ServiceMethod[];
    sourceFile: string;
}

/**
 * Generated output for a single service.
 */
export interface GeneratedService {
    interfaceCode: string;
    configCode: string;
    exportName: string;
}

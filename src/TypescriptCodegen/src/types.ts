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
 * A single case within a PHP enum.
 */
export interface EnumCaseDecl {
    name: string;
    value: string | number | null; // null for unit enums (no backing value)
}

/**
 * Parsed PHP enum declaration.
 */
export interface EnumDecl {
    namespace: string;
    name: string;
    fqcn: string;
    backingType: string | null; // 'int' | 'string' | null for unit enums
    cases: EnumCaseDecl[];
    sourceFile: string;
}

/**
 * A single property within a PHP class.
 */
export interface PropertyDecl {
    name: string;
    type: string | null;   // PHP type name (e.g. "string", "int", null if untyped)
    nullable: boolean;
    hasDefault: boolean;   // true if the property has a default value
}

/**
 * Parsed PHP class declaration (for DTO/value objects).
 */
export interface ClassDecl {
    namespace: string;
    name: string;
    fqcn: string;
    properties: PropertyDecl[];
    sourceFile: string;
}

/**
 * Result of parsing a single PHP file.
 */
export interface ParsedFile {
    contracts: ServiceContract[];
    enums: EnumDecl[];
    classes: ClassDecl[];
}

/**
 * Generated output for a single service.
 */
export interface GeneratedService {
    interfaceCode: string;
    configCode: string;
    exportName: string;
}

export { parsePhpFile } from './parser/parse-file.js';
export { extractContracts } from './parser/interface-extractor.js';
export { resolveAttributes } from './parser/attribute-resolver.js';
export { detectPattern } from './parser/pattern-detector.js';
export { mapPhpTypeToTs, mapSubscribeType } from './parser/type-mapper.js';
export { emitInterfaces } from './generator/emit-ts-interfaces.js';
export { emitProxyConfigs } from './generator/emit-proxy-configs.js';
export { runCodegen, main as cli } from './cli.js';
export type { ServiceContract, ServiceMethod, ParamDecl, MethodPattern } from './types.js';

import type { ServiceContract } from '../types.js';

/**
 * Generate ProxyOptions config exports for all services.
 */
export function emitProxyConfigs(services: ServiceContract[]): string {
    const blocks: string[] = [];

    for (const svc of services) {
        blocks.push(emitConfigForService(svc));
    }

    return blocks.join('\n');
}

/**
 * Generate a single ProxyOptions config for a service.
 */
function emitConfigForService(svc: ServiceContract): string {
    const configName = `${svc.name}Config`;

    const callMethods: string[] = [];
    const notifyMethods: string[] = [];
    const streamMethods: string[] = [];
    const subscribeMethods: string[] = [];
    const publishMethods: string[] = [];
    let channel: string | null = null;

    for (const method of svc.methods) {
        switch (method.pattern) {
            case 'call':
                callMethods.push(method.name);
                break;
            case 'notify':
                notifyMethods.push(method.name);
                break;
            case 'stream':
                streamMethods.push(method.name);
                break;
            case 'subscribe':
                subscribeMethods.push(method.name);
                if (method.channel) channel = method.channel;
                break;
            case 'publish':
                publishMethods.push(method.name);
                if (method.channel) channel = method.channel;
                break;
        }
    }

    // Build the config object literal
    const props: string[] = [];
    props.push(`    service: '${svc.name}',`);

    if (callMethods.length > 0) {
        props.push(`    call: [${callMethods.map((m) => `'${m}'`).join(', ')}],`);
    }
    if (notifyMethods.length > 0) {
        props.push(`    notify: [${notifyMethods.map((m) => `'${m}'`).join(', ')}],`);
    }
    if (streamMethods.length > 0) {
        props.push(`    stream: [${streamMethods.map((m) => `'${m}'`).join(', ')}],`);
    }
    if (subscribeMethods.length > 0) {
        props.push(`    subscribe: [${subscribeMethods.map((m) => `'${m}'`).join(', ')}],`);
    }
    if (publishMethods.length > 0) {
        props.push(`    publish: [${publishMethods.map((m) => `'${m}'`).join(', ')}],`);
    }
    if (channel) {
        props.push(`    channel: '${channel}',`);
    }

    return `export const ${configName} = {\n${props.join('\n')}\n} satisfies ProxyOptions;\n`;
}

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parsePhpFile } from './parse-file';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Path to the example PHP contracts file.
 * We traverse up from src/TypescriptCodegen/src/parser/ to the repo root,
 * then into examples/ or test/.
 */
function repoRoot(): string {
    // From src/TypescriptCodegen/src/parser/ up 4 levels to repo root
    return resolve(__dirname, '..', '..', '..', '..');
}

/**
 * Path to the test fixtures directory.
 */
function fixturesDir(): string {
    // From src/TypescriptCodegen/src/parser/ up 2 levels, then test/fixtures/
    return resolve(__dirname, '..', '..', 'test', 'fixtures');
}

describe('parsePhpFile', () => {
    it('should parse the example contract file', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const { contracts, enums } = parsePhpFile(path);

        expect(contracts).toHaveLength(4);
        expect(enums).toHaveLength(0);

        const names = contracts.map((c) => c.name).sort();
        expect(names).toEqual([
            'ChatService',
            'EventService',
            'MathService',
            'NumberStreamService',
        ]);
    });

    it('should extract MathService with 4 methods', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const { contracts } = parsePhpFile(path);

        const math = contracts.find((c) => c.name === 'MathService');
        expect(math).toBeDefined();
        expect(math!.methods).toHaveLength(4);

        const methodNames = math!.methods.map((m) => m.name);
        expect(methodNames).toEqual(['add', 'sub', 'mul', 'log']);
    });

    it('should detect NumberStreamService count as stream pattern', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const { contracts } = parsePhpFile(path);

        const ns = contracts.find((c) => c.name === 'NumberStreamService');
        expect(ns).toBeDefined();
        expect(ns!.methods).toHaveLength(1);
        expect(ns!.methods[0].name).toBe('count');
        expect(ns!.methods[0].pattern).toBe('stream');
        expect(ns!.methods[0].params[0].type).toBe('int');
    });

    it('should detect EventService onEvent as subscribe with channel & type', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const { contracts } = parsePhpFile(path);

        const evt = contracts.find((c) => c.name === 'EventService');
        expect(evt).toBeDefined();
        expect(evt!.methods).toHaveLength(1);
        expect(evt!.methods[0].pattern).toBe('subscribe');
        expect(evt!.methods[0].channel).toBe('events');
        expect(evt!.methods[0].subscribeType).toBe('string');
    });

    it('should detect ChatService with subscribe + publish patterns', () => {
        const path = resolve(repoRoot(), 'examples', 'contract_math_service.php');
        const { contracts } = parsePhpFile(path);

        const chat = contracts.find((c) => c.name === 'ChatService');
        expect(chat).toBeDefined();
        expect(chat!.methods).toHaveLength(2);

        const onMsg = chat!.methods.find((m) => m.name === 'onMessage');
        const send = chat!.methods.find((m) => m.name === 'send');

        expect(onMsg?.pattern).toBe('subscribe');
        expect(onMsg?.channel).toBe('chat');

        expect(send?.pattern).toBe('publish');
        expect(send?.channel).toBe('chat');
        expect(send?.params[0].type).toBe('string');
    });

    it('should handle a file with no contracts gracefully', () => {
        const path = resolve(repoRoot(), 'examples', 'server.php');
        const { contracts, enums, classes } = parsePhpFile(path);
        // server.php has no interfaces/enums but has domain exception classes
        expect(contracts).toHaveLength(0);
        expect(enums).toHaveLength(0);
        // May have classes (e.g., domain exception classes)
        // Just verify it doesn't crash
    });

    describe('DTO class extraction', () => {
        it('should extract DTO classes from dto-contract.php', () => {
            const path = resolve(fixturesDir(), 'dto-contract.php');
            const { contracts, enums, classes } = parsePhpFile(path);

            expect(contracts).toHaveLength(0);
            expect(enums).toHaveLength(0);
            expect(classes).toHaveLength(5);

            const msg = classes.find((c) => c.name === 'Message');
            expect(msg).toBeDefined();
            expect(msg!.fqcn).toBe('App\\Dto\\Message');
            expect(msg!.properties).toHaveLength(4);

            const order = classes.find((c) => c.name === 'Order');
            expect(order).toBeDefined();
            expect(order!.fqcn).toBe('App\\Dto\\Order');
            expect(order!.properties).toHaveLength(3);

            // Inheritance
            const chatNotif = classes.find((c) => c.name === 'ChatNotification');
            expect(chatNotif).toBeDefined();
            expect(chatNotif!.extendsFqcn).toBeNull();

            const msgNotif = classes.find((c) => c.name === 'MessageNotification');
            expect(msgNotif).toBeDefined();
            expect(msgNotif!.extendsFqcn).toBe('App\\Dto\\ChatNotification');
            expect(msgNotif!.properties).toHaveLength(3);

            const deep = classes.find((c) => c.name === 'DeepChild');
            expect(deep).toBeDefined();
            expect(deep!.extendsFqcn).toBe('App\\Dto\\MessageNotification');
        });

        it('should return classes alongside contracts and enums', () => {
            const path = resolve(fixturesDir(), 'enum-contract.php');
            const { classes } = parsePhpFile(path);
            // enum-contract.php has no DTO classes
            expect(classes).toHaveLength(0);
        });
    });

    describe('enum support', () => {
        it('should extract enums from a PHP file', () => {
            const path = resolve(fixturesDir(), 'enum-contract.php');
            const { contracts, enums } = parsePhpFile(path);

            expect(enums).toHaveLength(3);

            // Status: string-backed enum
            const status = enums.find((e) => e.name === 'Status');
            expect(status).toBeDefined();
            expect(status!.backingType).toBe('string');
            expect(status!.cases).toHaveLength(2);
            expect(status!.cases[0].name).toBe('Active');
            expect(status!.cases[0].value).toBe('active');
            expect(status!.cases[1].name).toBe('Inactive');
            expect(status!.cases[1].value).toBe('inactive');

            // Priority: int-backed enum
            const priority = enums.find((e) => e.name === 'Priority');
            expect(priority).toBeDefined();
            expect(priority!.backingType).toBe('int');
            expect(priority!.cases).toHaveLength(3);
            expect(priority!.cases[0].name).toBe('Low');
            expect(priority!.cases[0].value).toBe(1);
            expect(priority!.cases[1].name).toBe('Medium');
            expect(priority!.cases[1].value).toBe(2);
            expect(priority!.cases[2].name).toBe('High');
            expect(priority!.cases[2].value).toBe(3);

            // Unit: unit enum (no backing type)
            const unit = enums.find((e) => e.name === 'Unit');
            expect(unit).toBeDefined();
            expect(unit!.backingType).toBeNull();
            expect(unit!.cases).toHaveLength(2);
            expect(unit!.cases[0].name).toBe('Draft');
            expect(unit!.cases[0].value).toBeNull();
            expect(unit!.cases[1].name).toBe('Published');
            expect(unit!.cases[1].value).toBeNull();
        });

        it('should extract the ConfigService contract with enum param types', () => {
            const path = resolve(fixturesDir(), 'enum-contract.php');
            const { contracts } = parsePhpFile(path);

            const config = contracts.find((c) => c.name === 'ConfigService');
            expect(config).toBeDefined();
            expect(config!.methods).toHaveLength(5);

            const setStatus = config!.methods.find((m) => m.name === 'setStatus');
            expect(setStatus).toBeDefined();
            expect(setStatus!.params[0].type).toBe('Status');
            expect(setStatus!.pattern).toBe('notify');

            const getStatus = config!.methods.find((m) => m.name === 'getStatus');
            expect(getStatus).toBeDefined();
            expect(getStatus!.returnType).toBe('Status');
            expect(getStatus!.pattern).toBe('call');

            const setPriority = config!.methods.find((m) => m.name === 'setPriority');
            expect(setPriority).toBeDefined();
            expect(setPriority!.params[0].type).toBe('Priority');

            const setUnit = config!.methods.find((m) => m.name === 'setUnit');
            expect(setUnit).toBeDefined();
            expect(setUnit!.params[0].type).toBe('Unit');
        });
    });
});

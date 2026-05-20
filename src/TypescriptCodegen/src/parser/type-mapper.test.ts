import { describe, it, expect } from 'vitest';
import { mapPhpTypeToTs, mapSubscribeType } from './type-mapper';

describe('mapPhpTypeToTs', () => {
    const id = (name: string) => ({ name, kind: 'identifier' } as any);

    it('should map int to number', () => {
        expect(mapPhpTypeToTs(id('int'), false)).toBe('number');
    });

    it('should map float to number', () => {
        expect(mapPhpTypeToTs(id('float'), false)).toBe('number');
    });

    it('should map string to string', () => {
        expect(mapPhpTypeToTs(id('string'), false)).toBe('string');
    });

    it('should map bool to boolean', () => {
        expect(mapPhpTypeToTs(id('bool'), false)).toBe('boolean');
    });

    it('should map void to void', () => {
        expect(mapPhpTypeToTs(id('void'), false)).toBe('void');
    });

    it('should map mixed/object to unknown', () => {
        expect(mapPhpTypeToTs(id('mixed'), false)).toBe('unknown');
        expect(mapPhpTypeToTs(id('object'), false)).toBe('unknown');
    });

    it('should map array to unknown[]', () => {
        expect(mapPhpTypeToTs(id('array'), false)).toBe('unknown[]');
    });

    it('should map callable', () => {
        expect(mapPhpTypeToTs(id('callable'), false)).toBe('(...args: unknown[]) => unknown');
    });

    it('should map null to null', () => {
        expect(mapPhpTypeToTs(id('null'), false)).toBe('null');
    });

    it('should map custom class to Record<string, unknown>', () => {
        expect(mapPhpTypeToTs(id('User'), false)).toBe('Record<string, unknown>');
    });

    it('should handle nullable types', () => {
        expect(mapPhpTypeToTs(id('int'), true)).toBe('number | null');
        expect(mapPhpTypeToTs(id('string'), true)).toBe('string | null');
    });

    it('should handle union types', () => {
        const union = [id('int'), id('string')];
        expect(mapPhpTypeToTs(union, false)).toBe('number | string');
    });

    it('should handle nullable union types', () => {
        const union = [id('int'), id('string')];
        expect(mapPhpTypeToTs(union, true)).toBe('number | string | null');
    });

    it('should return unknown for null type node', () => {
        expect(mapPhpTypeToTs(null, false)).toBe('unknown');
    });

    it('should map never', () => {
        expect(mapPhpTypeToTs(id('never'), false)).toBe('never');
    });

    it('should map true/false literals', () => {
        expect(mapPhpTypeToTs(id('true'), false)).toBe('true');
        expect(mapPhpTypeToTs(id('false'), false)).toBe('false');
    });
});

describe('mapSubscribeType', () => {
    it('should map int/float to number', () => {
        expect(mapSubscribeType('int')).toBe('number');
        expect(mapSubscribeType('float')).toBe('number');
    });

    it('should map string to string', () => {
        expect(mapSubscribeType('string')).toBe('string');
    });

    it('should map bool to boolean', () => {
        expect(mapSubscribeType('bool')).toBe('boolean');
    });

    it('should return unknown for null input', () => {
        expect(mapSubscribeType(null)).toBe('unknown');
    });

    it('should return unknown for unknown types', () => {
        expect(mapSubscribeType('object')).toBe('unknown');
        expect(mapSubscribeType('mixed')).toBe('unknown');
    });
});

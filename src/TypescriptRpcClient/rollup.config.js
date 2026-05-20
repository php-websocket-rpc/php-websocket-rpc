import typescript from '@rollup/plugin-typescript';

export default [
    // ESM build
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/index.mjs',
            format: 'es',
            sourcemap: true,
        },
        plugins: [typescript({ tsconfig: './tsconfig.json' })],
        external: ['@msgpack/msgpack'],
    },
    // CJS build
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/index.cjs',
            format: 'cjs',
            sourcemap: true,
        },
        plugins: [typescript({ tsconfig: './tsconfig.json' })],
        external: ['@msgpack/msgpack'],
    },
    // Browser IIFE bundle (inlines msgpack)
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/browser.js',
            format: 'iife',
            name: 'PhpWebsocketRpc',
            sourcemap: true,
            globals: {
                '@msgpack/msgpack': 'msgpack',
            },
        },
        plugins: [typescript({ tsconfig: './tsconfig.json' })],
        // Inline @msgpack/msgpack for browser bundle — no external deps
        external: [],
    },
];

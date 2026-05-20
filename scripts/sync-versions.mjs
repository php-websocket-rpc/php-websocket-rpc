#!/usr/bin/env node

/**
 * Sync versions across all workspace packages.
 *
 * Usage:
 *   node scripts/sync-versions.mjs          # sync all to highest version
 *   node scripts/sync-versions.mjs 0.2.0    # sync all to specific version
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const workspacePackages = [
    'src/TypescriptRpcClient',
    'src/TypescriptCodegen',
];

const targetVersion = process.argv[2]; // optional: set a specific version

let version;
if (targetVersion) {
    version = targetVersion;
    console.log(`Syncing all packages to version ${version}...`);
} else {
    // Read all packages and find the highest version
    const versions = workspacePackages.map((dir) => {
        const pkg = JSON.parse(
            readFileSync(resolve(root, dir, 'package.json'), 'utf-8'),
        );
        return pkg.version || '0.0.0';
    });
    versions.sort().reverse();
    version = versions[0];
    console.log(`Syncing all packages to version ${version}...`);
}

for (const dir of workspacePackages) {
    const filePath = resolve(root, dir, 'package.json');
    const pkg = JSON.parse(readFileSync(filePath, 'utf-8'));

    if (pkg.version !== version) {
        pkg.version = version;
        writeFileSync(filePath, JSON.stringify(pkg, null, 4) + '\n', 'utf-8');
        console.log(`  ${dir}/package.json → ${version}`);
    } else {
        console.log(`  ${dir}/package.json already at ${version}`);
    }
}

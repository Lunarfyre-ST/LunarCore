import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { VERSION } from '../core/version.js';
async function check(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) await check(path);
        else if (/\.(js|mjs)$/.test(path)) {
            const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
            if (result.status !== 0) throw new Error(result.stderr);
        }
    }
}
await check('.');
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (manifest.version !== pkg.version || manifest.version !== VERSION) throw new Error('Version mismatch');
await Promise.all([readFile(manifest.js), readFile(manifest.css)]);
console.log('Syntax and extension metadata checks passed.');

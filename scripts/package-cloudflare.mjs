import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/cloudflare/', root);
await mkdir(output, {recursive: true});
await copyFile(new URL('dist/server/index.js', root), new URL('app.mjs', output));
const entry = await readFile(new URL('src/cloudflare-entry.mjs', root), 'utf8');
await writeFile(new URL('cloudflare-entry.mjs', output), entry.replace("'./worker.mjs'", "'./app.mjs'"));
await copyFile(new URL('deploy/cloudflare-upload.json', root), new URL('metadata.json', output));
console.log('Packaged Cloudflare modules; no resources changed or deployed.');

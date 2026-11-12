import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/cloudflare/', root);
await mkdir(output, {recursive: true});
const redirect=(await readFile(new URL('src/sites-redirect.mjs',root),'utf8')).replace(/export /g,'');
const entry=(await readFile(new URL('src/sites-entry.mjs',root),'utf8')).replace(/^import .*\n/gm,'');
await writeFile(new URL('transition.mjs',output),redirect+'\n'+entry);
await copyFile(new URL('deploy/cloudflare-upload.json', root), new URL('metadata.json', output));
console.log('Packaged old Workers address as transition only; no database bindings.');

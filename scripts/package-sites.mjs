import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const redirect=(await readFile(new URL('src/sites-redirect.mjs',root),'utf8')).replace(/export /g,'');
const entry=(await readFile(new URL('src/sites-entry.mjs',root),'utf8')).replace(/^import .*\n/gm,'');
await writeFile(new URL('dist/server/index.js',root),redirect+'\n'+entry);
console.log('Packaged permanent Sites transition; no D1 access or migration endpoint.');

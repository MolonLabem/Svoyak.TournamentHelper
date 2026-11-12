// A separate source deployment: never apply its freeze migration to the target.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const bridge=(await readFile(new URL('src/migration-bridge.mjs',root),'utf8')).replace(/export /g,'');
const entry=(await readFile(new URL('src/sites-entry.mjs',root),'utf8')).replace(/^import .*\n/gm,'');
await writeFile(new URL('dist/server/index.js',root),bridge+'\n'+entry);
console.log('Packaged frozen Sites source; no production changes.');

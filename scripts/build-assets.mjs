// Ejecutar antes de wrangler deploy. No modifica secretos ni wrangler.toml.
import {readdir,readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';
const root=fileURLToPath(new URL('../frontend/',import.meta.url));
async function walk(dir){const out=[];for(const d of await readdir(dir,{withFileTypes:true})){if(d.name==='static')continue;const p=join(dir,d.name);if(d.isDirectory())out.push(...await walk(p));else out.push(p);}return out.sort();}
const files=await walk(root),assets=files.filter(p=>/\.(js|css)$/.test(p));
const hash=createHash('sha256');for(const p of assets){hash.update(relative(root,p));hash.update(await readFile(p));}const version=hash.digest('hex').slice(0,16);
await mkdir(join(root,'static'),{recursive:true});
for(const p of assets){const target=join(root,'static',version,relative(root,p));await mkdir(join(target,'..'),{recursive:true});await writeFile(target,await readFile(p));}
for(const p of files.filter(p=>p.endsWith('.html'))){const html=await readFile(p,'utf8');await writeFile(p,html.replace(/(src|href)="(?:\/static\/[a-f0-9]+)?\/(js|css)\//g,`$1="/static/${version}/$2/`));}
console.log(`Activos versionados: ${version}; ${assets.length} archivos. HTML listo para wrangler deploy.`);

// Retiene hasta tres versiones para pestañas abiertas durante un despliegue.
const versions=await Promise.all((await readdir(join(root,'static'))).filter(n=>/^[a-f0-9]{16}$/.test(n)).map(async name=>({name,time:(await stat(join(root,'static',name))).mtimeMs})));
for(const v of versions.filter(v=>v.name!==version).sort((a,b)=>b.time-a.time).slice(2))await rm(join(root,'static',v.name),{recursive:true,force:true});

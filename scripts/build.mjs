import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const files=['_worker.js','_routes.json','index.html','privacy.html','ads.txt','styles.css','app.mjs','sw.js','manifest.webmanifest','_headers','ads-config.mjs','src/engine.mjs','src/simulator.mjs','src/allocations.mjs','src/worker.mjs','src/scenario.mjs','src/export.mjs','src/calculator.mjs','src/ads.mjs','src/privacy.mjs',...(await readdir(resolve(root,'assets'))).map(name=>'assets/'+name)];
const hash=createHash('sha256');
for(const file of files) {
  const destination=resolve(root,'dist',file);
  await mkdir(dirname(destination),{recursive:true});
  await copyFile(resolve(root,file),destination);
  hash.update(file);hash.update(await readFile(resolve(root,file)));
}
const revision=hash.digest('hex').slice(0,12);
const sw=await readFile(resolve(root,'sw.js'),'utf8');
await writeFile(resolve(root,'dist/sw.js'),sw.replace(/const CACHE='[^']+';/,`const CACHE='sensou-calc-${revision}';`));
console.log(`Static app built: ${resolve(root,'dist')} (${revision})`);

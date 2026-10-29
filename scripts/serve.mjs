import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const port=Number(process.env.PORT)||4173;
createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if (!file.startsWith(root+sep) || pathname.split('/').some(p=>p.startsWith('.')) || !['/index.html','/styles.css','/app.mjs','/sw.js','/manifest.webmanifest'].includes(pathname) && pathname!=='/' && !pathname.startsWith('/src/') && !pathname.startsWith('/assets/')) {res.writeHead(404);res.end('Not found');return;}
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(await readFile(file));
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Sensou Calc: http://127.0.0.1:${port}`));

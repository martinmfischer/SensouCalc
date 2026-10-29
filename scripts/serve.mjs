import {isPublicPath} from './static-path.mjs';
import {createServer} from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,extname,sep,relative} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const securityHeaders=Object.fromEntries((await readFile(resolve(root,'_headers'),'utf8')).split('\n').filter(line=>/^\s+[\w-]+:/.test(line)).map(line=>{const at=line.indexOf(':');return [line.slice(0,at).trim(),line.slice(at+1).trim()];}));
const port=Number(process.env.PORT)||4173;
createServer(async(req,res)=>{
  for(const [key,value] of Object.entries(securityHeaders))res.setHeader(key,value);
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+sep)||!isPublicPath(pathname)||!isPublicPath('/'+relative(root,await realpath(file)).split(sep).join('/'))){res.writeHead(404);res.end('Not found');return;}
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(await readFile(file));
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Sensou Calc: http://127.0.0.1:${port}`));

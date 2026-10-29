const entrypoints=new Set(['/','/index.html','/styles.css','/app.mjs','/sw.js','/manifest.webmanifest','/ads-config.mjs']);
// Check both the request path and its real, symlink-resolved filesystem path.
export function isPublicPath(path){
  if(typeof path!=='string'||path.includes('\\')||path.includes('\0')||path.split('/').some(part=>part.startsWith('.')))return false;
  return entrypoints.has(path)||/^\/src\/[a-z][a-z0-9-]*\.mjs$/.test(path)||/^\/assets\/[A-Za-z0-9_-]+\.(svg|png|woff2|txt)$/.test(path);
}

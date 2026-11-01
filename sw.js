const CACHE='sensou-calc-v12';
const ASSETS=['./','./index.html','./privacy.html','./styles.css','./app.mjs','./src/engine.mjs','./src/simulator.mjs','./src/allocations.mjs','./src/worker.mjs','./src/scenario.mjs','./src/export.mjs','./src/calculator.mjs','./src/ads.mjs','./src/privacy.mjs','./ads-config.mjs','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/dm-sans.woff2','./assets/manrope.woff2'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sensou-calc-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(async response=>{
    if(response.ok && ASSETS.some(path=>new URL(path,self.registration.scope).href===event.request.url)) {
      const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());
    }
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    if(event.request.mode==='navigate')return caches.match(new URL('./index.html',self.registration.scope));
    return new Response('Offline: asset unavailable',{status:503});
  }));
});

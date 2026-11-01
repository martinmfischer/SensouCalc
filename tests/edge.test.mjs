import test from 'node:test';
import assert from 'node:assert/strict';
import edge,{htmlPolicy} from '../_worker.js';
import {readFile} from 'node:fs/promises';

test('Pages HTML uses fresh nonces, safe response headers and no conditional stale-body pairing',async()=>{
  const previous=globalThis.HTMLRewriter;let attached,received;
  globalThis.HTMLRewriter=class{
    on(selector,handler){assert.equal(selector,'script');this.handler=handler;return this;}
    transform(response){this.handler.element({setAttribute:(name,value)=>{assert.equal(name,'nonce');attached=value;}});return response;}
  };
  try{
    const env={ASSETS:{fetch:async request=>{received=request;return new Response('<script type="module" src="./app.mjs"></script>',{headers:{'content-type':'text/html','etag':'old','last-modified':'yesterday','content-length':'50'}});}}};
    const request=new Request('https://example.test/',{headers:{'if-none-match':'old','if-modified-since':'yesterday'}});
    const first=await edge.fetch(request,env),nonce=attached;
    assert.equal(received.headers.has('if-none-match'),false);assert.equal(received.headers.has('if-modified-since'),false);assert.equal(request.headers.get('if-none-match'),'old');
    assert.ok(nonce.length>=24);assert.equal(first.headers.get('content-security-policy'),htmlPolicy(nonce));assert.equal(first.headers.get('cache-control'),'no-store');
    for(const name of ['etag','last-modified','content-length'])assert.equal(first.headers.has(name),false);
    assert.equal(first.headers.get('x-frame-options'),'DENY');assert.equal(first.headers.get('x-content-type-options'),'nosniff');
    assert.ok(!htmlPolicy(nonce).includes('unsafe-eval'));assert.ok(htmlPolicy(nonce).includes("script-src-attr 'none'"));
    await edge.fetch(new Request('https://example.test/'),env);assert.notEqual(attached,nonce);
    const asset=new Response('script',{headers:{'content-type':'text/javascript','etag':'keep'}});
    assert.equal(await edge.fetch(request,{ASSETS:{fetch:async()=>asset}}),asset);
  }finally{if(previous===undefined)delete globalThis.HTMLRewriter;else globalThis.HTMLRewriter=previous;}
});
test('The edge function only runs for HTML and the offline cache contains consent dependencies',async()=>{
  const routes=JSON.parse(await readFile(new URL('../_routes.json',import.meta.url),'utf8'));
  // Pages redirects /privacy.html to /privacy before invoking the HTML handler.
  assert.deepEqual(routes.include,['/','/index.html','/privacy','/privacy.html']);
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');assert.ok(sw.includes('./src/privacy.mjs'));
});

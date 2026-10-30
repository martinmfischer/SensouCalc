import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canRequestAds} from '../src/ads.mjs';
import {ADSENSE} from '../ads-config.mjs';

test('Ads remain disabled without IDs, online status, consent and a response nonce',()=>{
  const state={online:true,consent:true,nonce:'a-random-response-nonce'},valid={enabled:true,client:'ca-pub-1234567890123456',slot:'1234567890'};
  assert.equal(canRequestAds(ADSENSE,state),false);
  assert.equal(canRequestAds(valid,state),true);
  for(const [key,value] of Object.entries({online:false,consent:false,nonce:undefined}))assert.equal(canRequestAds(valid,{...state,[key]:value}),false);
  for(const client of ['ca-pub-123','https://attacker.test','ca-pub-1234567890123456&x=1'])assert.equal(canRequestAds({...valid,client},state),false);
});

test('Ad placement is separate from calculator controls; no external scripts are in HTML',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.indexOf('id="advertisement"')>html.indexOf('id="chart-footnote"'));
  assert.ok(html.indexOf('id="advertisement"')<html.indexOf('<footer>'));
  assert.match(html,/<aside[^>]+id="advertisement"[^>]+hidden/);
  assert.doesNotMatch(html,/<script[^>]+src=["']https?:/i);
});

test('Published ownership metadata and seller entry match the configured account',async()=>{
  assert.match(ADSENSE.client,/^ca-pub-\d{16}$/);assert.match(ADSENSE.slot,/^\d+$/);assert.equal(ADSENSE.enabled,false);
  const seller=(await readFile(new URL('../ads.txt',import.meta.url),'utf8')).trim();
  assert.equal(seller,`google.com, ${ADSENSE.client.slice(3)}, DIRECT, f08c47fec0942fa0`);
  for(const file of ['index.html','privacy.html']){
    const html=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.ok(html.includes(`<meta name="google-adsense-account" content="${ADSENSE.client}">`));
  }
});

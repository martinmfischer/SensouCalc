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

import test from 'node:test';
import assert from 'node:assert/strict';
import {initAdSlot,consentDecision} from '../src/ads.mjs';
import {ADSENSE} from '../ads-config.mjs';

const accepted=()=>({cmpStatus:'loaded',eventStatus:'useractioncomplete',gdprApplies:true,vendor:{consents:{755:true}},purpose:{consents:Object.fromEntries([1,2,3,4,7,9,10].map(p=>[p,true]))}});
test('Consent fails closed, respects rejection and restrictions, and supports non-personalized ads',()=>{
  assert.equal(consentDecision(accepted(),true).allowed,true);
  for(const field of ['cmpStatus','eventStatus','gdprApplies']){const data=accepted();delete data[field];assert.equal(consentDecision(data,true).allowed,false);}
  assert.equal(consentDecision(accepted(),false).allowed,false);
  for(const purpose of [1,2,7,9,10]){const data=accepted();data.purpose.consents[purpose]=false;assert.equal(consentDecision(data,true).allowed,false);}
  const noVendor=accepted();noVendor.vendor.consents[755]=false;assert.equal(consentDecision(noVendor,true).allowed,false);
  const npa=accepted();npa.purpose.consents[3]=false;assert.deepEqual(consentDecision(npa,true),{allowed:true,nonPersonalized:true});
  const restricted=accepted();restricted.publisher={restrictions:{1:{755:0}}};assert.equal(consentDecision(restricted,true).allowed,false);
  assert.equal(consentDecision({cmpStatus:'loaded',eventStatus:'tcloaded',gdprApplies:false},true).allowed,true);
});

// DOM/API doubles test the bootstrap boundary without sending requests to Google.
test('Consent preview loads the SDK paused and never requests a slot, even after acceptance',()=>{
  const originals=Object.fromEntries(['window','document','location','navigator','MutationObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let listener,script,changed,revoked=0,pushes=0;
  const element=()=>({dataset:{},remove(){},replaceWith(next){ad=next;}});
  let ad=element();const events={},status={hidden:true,textContent:''},settings={hidden:true},container={hidden:true,classList:{add(){}},querySelector:()=>ad};
  const win={adsbygoogle:[],addEventListener:(key,fn)=>events[key]=fn,__tcfapi:(command,version,callback)=>{assert.equal(command,'addEventListener');listener=callback;}};
  win.adsbygoogle.push=()=>{pushes++;};
  win.googlefc={callbackQueue:[],showRevocationMessage:()=>revoked++};
  try{
    Object.defineProperty(globalThis,'window',{configurable:true,value:win});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
    Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?previewConsent=1'}});
    Object.defineProperty(globalThis,'MutationObserver',{configurable:true,value:class{constructor(callback){changed=callback;}observe(){}disconnect(){}}});
    Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:selector=>({'#advertisement':container,'#privacy-settings':settings,'#consent-status':status,'script[nonce]':{nonce:'a-valid-random-response-nonce'}})[selector],createElement:element,head:{append:element=>script=element}}});
    initAdSlot();assert.equal(win.adsbygoogle.pauseAdRequests,1);assert.ok(script.src.startsWith('https://pagead2.googlesyndication.com/'));
    win.googlefc.callbackQueue[0].CONSENT_API_READY();listener(accepted(),true);script.onload();
    assert.equal(settings.hidden,false);assert.equal(container.hidden,true);assert.equal(pushes,0);assert.equal(win.adsbygoogle.pauseAdRequests,1);
    settings.onclick();assert.equal(container.hidden,true);win.googlefc.callbackQueue.at(-1).CONSENT_API_READY();assert.equal(revoked,1);
    const old=accepted();old.eventStatus='tcloaded';listener(old,true);assert.match(status.textContent,/awaiting choice/);
    listener(accepted(),true);assert.match(status.textContent,/personalized ads allowed/);assert.equal(pushes,0);
    events.offline();assert.equal(container.hidden,true);assert.equal(win.adsbygoogle.pauseAdRequests,1);
    // Normal pending-approval visits do not load any Google script.
    assert.equal(ADSENSE.enabled,false);script=null;location.search='';initAdSlot();assert.equal(script,null);
    // The future approved path: one request only, then immediate pause/removal.
    initAdSlot({...ADSENSE,enabled:true});win.googlefc.callbackQueue.at(-1).CONSENT_API_READY();script.onload();assert.equal(pushes,0);
    listener(accepted(),true);assert.equal(pushes,1);assert.equal(container.hidden,false);assert.equal(win.adsbygoogle.pauseAdRequests,0);assert.equal(ad.dataset.adSlot,ADSENSE.slot);
    listener(accepted(),true);assert.equal(pushes,1);
    settings.onclick();assert.equal(win.adsbygoogle.pauseAdRequests,1);assert.equal(container.hidden,true);assert.equal(ad.dataset.adSlot,undefined);
    const stale=accepted();stale.eventStatus='tcloaded';listener(stale,true);assert.equal(pushes,1);
    const declined=accepted();declined.purpose.consents[1]=false;listener(declined,true);assert.equal(pushes,1);
    const npa=accepted();npa.purpose.consents[3]=false;listener(npa,true);assert.equal(pushes,2);assert.equal(win.adsbygoogle.requestNonPersonalizedAds,1);
    ad.dataset.adStatus='unfilled';changed();assert.equal(container.hidden,true);
    navigator.globalPrivacyControl=true;listener(accepted(),true);assert.equal(win.adsbygoogle.pauseAdRequests,1);assert.equal(container.hidden,true);assert.equal(pushes,2);
  }finally{
    for(const [key,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
});

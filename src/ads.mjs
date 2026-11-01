import {ADSENSE} from '../ads-config.mjs';

export function canRequestAds(config,{online,consent,nonce}){
  return config.enabled===true&&/^ca-pub-\d{16}$/.test(config.client)&&/^\d{1,20}$/.test(config.slot)&&online===true&&consent===true&&typeof nonce==='string'&&nonce.length>=16;
}

// The account requests consent, not legitimate interest, for all Google purposes.
// Google's SDK additionally evaluates the complete TC string and publisher rules.
export function consentDecision(data,success){
  const denied={allowed:false,nonPersonalized:true};
  if(!success||data?.cmpStatus!=='loaded'||!['tcloaded','useractioncomplete'].includes(data.eventStatus))return denied;
  if(data.gdprApplies===false)return {allowed:true,nonPersonalized:false};
  if(data.gdprApplies!==true||!data.vendor?.consents?.[755])return denied;
  const purposes=data.purpose?.consents||{},restrictions=data.publisher?.restrictions||{};
  const permitted=purpose=>purposes[purpose]===true&&![0,2].includes(restrictions[purpose]?.[755]);
  if(![1,2,7,9,10].every(permitted))return denied;
  return {allowed:true,nonPersonalized:![3,4].every(permitted)};
}

export function initAdSlot(config=ADSENSE){
  const container=document.querySelector('#advertisement'),settings=document.querySelector('#privacy-settings');
  const params=new URLSearchParams(location.search),preview=params.get('previewConsent')==='1';
  if(params.get('previewAds')==='1'){
    if(container){container.hidden=false;container.classList.add('ad-preview');container.querySelector('.ad-label').textContent='Advertisement · preview';}
    return;
  }
  const nonce=document.querySelector('script[nonce]')?.nonce;
  if((!config.enabled&&!preview)||!/^ca-pub-\d{16}$/.test(config.client)||!nonce||nonce.length<16)return;
  if(preview){const status=document.querySelector('#consent-status');if(status){status.hidden=false;status.textContent='Consent preview · waiting for Google · no ad requests';}}
  let consent={allowed:false,nonPersonalized:true},sdkReady=false,script=null,requested=false,observer=null,revoking=false;
  const queue=()=>window.adsbygoogle=window.adsbygoogle||[];
  function pause(){queue().pauseAdRequests=1;}
  function clearAd(){
    pause();observer?.disconnect();observer=null;if(container)container.hidden=true;
    if(requested&&container){
      const fresh=document.createElement('ins');fresh.className='adsbygoogle';fresh.dataset.adFormat='horizontal';fresh.dataset.fullWidthResponsive='false';
      container.querySelector('ins').replaceWith(fresh);
    }
    requested=false;
  }
  function request(){
    const allowed=consent.allowed&&navigator.globalPrivacyControl!==true;
    if(requested||!sdkReady||!container||preview||!canRequestAds(config,{online:navigator.onLine,consent:allowed,nonce}))return;
    const ad=container.querySelector('ins');ad.dataset.adClient=config.client;ad.dataset.adSlot=config.slot;
    queue().requestNonPersonalizedAds=consent.nonPersonalized?1:0;
    container.hidden=false;requested=true;
    observer=new MutationObserver(()=>{if(ad.dataset.adStatus==='unfilled')container.hidden=true;});
    observer.observe(ad,{attributes:true,attributeFilter:['data-ad-status']});
    try{queue().pauseAdRequests=0;queue().push({});}catch{clearAd();}
  }
  window.googlefc=window.googlefc||{};window.googlefc.callbackQueue=window.googlefc.callbackQueue||[];
  window.googlefc.callbackQueue.push({CONSENT_API_READY:()=>{
    if(typeof window.__tcfapi!=='function')return;
    window.__tcfapi('addEventListener',2,(data,success)=>{
      if(data?.eventStatus==='useractioncomplete')revoking=false;
      consent=revoking?{allowed:false,nonPersonalized:true}:consentDecision(data,success);
      if(settings)settings.hidden=!(success&&data?.gdprApplies===true);
      if(!consent.allowed||navigator.globalPrivacyControl===true)clearAd();else request();
      if(preview){const status=document.querySelector('#consent-status');if(status){status.hidden=false;status.textContent='Consent preview · '+(consent.allowed?(consent.nonPersonalized?'non-personalized ads allowed':'personalized ads allowed'):'ads declined or awaiting choice')+' · no ad requests';}}
    });
  }});
  if(settings)settings.onclick=()=>{
    clearAd();revoking=true;consent={allowed:false,nonPersonalized:true};
    window.googlefc.callbackQueue.push({CONSENT_API_READY:()=>window.googlefc.showRevocationMessage()});
  };
  function start(){
    if(!navigator.onLine)return;
    if(script){request();return;}
    pause();script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.nonce=nonce;
    const source=new URL('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');source.searchParams.set('client',config.client);script.src=source.href;
    script.onload=()=>{sdkReady=true;request();};
    script.onerror=()=>{clearAd();script.remove();script=null;sdkReady=false;if(preview){const status=document.querySelector('#consent-status');if(status)status.textContent='Consent preview · Google script unavailable · no ad requests';}};
    document.head.append(script);
  }
  window.addEventListener('online',start);window.addEventListener('offline',clearAd);start();
}

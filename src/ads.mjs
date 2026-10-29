import {ADSENSE} from '../ads-config.mjs';

export function canRequestAds(config,{online,consent,nonce}){
  return config.enabled===true&&/^ca-pub-\d{16}$/.test(config.client)&&/^\d{1,20}$/.test(config.slot)&&online===true&&consent===true&&typeof nonce==='string'&&nonce.length>=16;
}

export function initAdSlot(){
  const container=document.querySelector('#advertisement');if(!container)return;
  if(new URLSearchParams(location.search).get('previewAds')==='1'){
    container.hidden=false;container.classList.add('ad-preview');
    container.querySelector('.ad-label').textContent='Advertisement · preview';
    return; // Preview never loads an ad or a Google script.
  }
  let consent=false,requested=false;
  function request(){
    const nonce=document.querySelector('script[nonce]')?.nonce;
    if(requested||!canRequestAds(ADSENSE,{online:navigator.onLine,consent,nonce}))return;
    requested=true;
    const ad=container.querySelector('ins');
    ad.dataset.adClient=ADSENSE.client;ad.dataset.adSlot=ADSENSE.slot;container.hidden=false;
    const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.nonce=nonce;
    const source=new URL('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');source.searchParams.set('client',ADSENSE.client);script.src=source.href;
    script.onload=()=>{try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch{container.hidden=true;}};
    script.onerror=()=>{container.hidden=true;};
    document.head.append(script);
  }
  // A certified CMP integration must emit this only after resolving consent.
  // CSP nonces must be generated per response by the server before activation.
  window.addEventListener('sensou:ads-consent',event=>{
    consent=event.detail?.granted===true;
    if(!consent){container.hidden=true;if(requested)location.reload();return;}
    request();
  });
  window.addEventListener('online',request);
  window.addEventListener('offline',()=>{container.hidden=true;});
}

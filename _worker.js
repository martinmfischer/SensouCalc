// Cloudflare Pages advanced mode. Only HTML routes invoke this function.
export const htmlPolicy=nonce=>"default-src 'self'; script-src 'nonce-"+nonce+"' 'strict-dynamic' 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https:; frame-src 'self' https:; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

export default {
  async fetch(request,env){
    // Conditional 304s must not pair a fresh CSP nonce with an older HTML body.
    const incoming=new Request(request);incoming.headers.delete('if-none-match');incoming.headers.delete('if-modified-since');
    const response=await env.ASSETS.fetch(incoming);
    if(response.status!==200||!response.headers.get('content-type')?.includes('text/html'))return response;
    const bytes=crypto.getRandomValues(new Uint8Array(24)),nonce=btoa(String.fromCharCode(...bytes));
    const transformed=new HTMLRewriter().on('script',{element(element){element.setAttribute('nonce',nonce);}}).transform(response);
    const headers=new Headers(transformed.headers);
    headers.set('Content-Security-Policy',htmlPolicy(nonce));headers.set('Cache-Control','no-store');
    headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','no-referrer');
    headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    headers.delete('etag');headers.delete('last-modified');headers.delete('content-length');
    return new Response(transformed.body,{status:response.status,statusText:response.statusText,headers});
  }
};

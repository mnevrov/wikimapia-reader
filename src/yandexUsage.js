// Central opt-in gate for Yandex JS API v3. No user keys belong in this module.
// Map hits are currently free; extra metered services (geocoder, panoramas,
// search, routing and suggestions) MUST NOT be invoked by the WikiReader map.
export const YANDEX_JS_API_URL='https://api-maps.yandex.ru/v3/';
export const YANDEX_TERMS_URL='https://yandex.ru/legal/maps_termsofuse';
export const YANDEX_KEY_PATTERN=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function yandexEnablement({selected=false,key='',refererConfigured=false,publiclyAccessible=false}={}){
 if(!selected)return {allowed:false,reason:'not-selected'};
 if(!YANDEX_KEY_PATTERN.test(key))return {allowed:false,reason:'missing-or-invalid-key'};
 if(!refererConfigured)return {allowed:false,reason:'referer-not-confirmed'};
 if(!publiclyAccessible)return {allowed:false,reason:'license-not-confirmed'};
 return {allowed:true,reason:'ready'};
}

export function createYandexApiLoader(loadSdk,{now=()=>Date.now(),retryDelayMs=60_000}={}){
 let activeKey=null,promise=null,failedAt=null;
 return function request(config){
  const decision=yandexEnablement(config);
  if(!decision.allowed)return Promise.resolve({active:false,reason:decision.reason,api:null});
  const {key}=config;
  // A browser JS API client key is observable on the wire. Forbid swapping
  // credentials inside the same WebView session; reload to replace the key.
  if(activeKey&&activeKey!==key)return Promise.resolve({active:false,reason:'reload-required',api:null});
  if(promise)return promise;
  if(failedAt!==null&&now()-failedAt<retryDelayMs){
   return Promise.resolve({active:false,reason:'retry-cooldown',api:null});
  }
  activeKey=key;
  promise=Promise.resolve().then(()=>loadSdk(key)).then(api=>{
   if(!api)throw Error('SDK unavailable');
   return {active:true,reason:'ready',api};
  }).catch(()=>{
   failedAt=now();promise=null;
   return {active:false,reason:'sdk-unavailable',api:null};
  });
  return promise;
 };
}

export function injectYandexJsApi(key){
 if(typeof document==='undefined'||typeof window==='undefined'){
  return Promise.reject(Error('Yandex maps require a browser WebView'));
 }
 return new Promise((resolve,reject)=>{
  if(window.ymaps3){window.ymaps3.ready.then(()=>resolve(window.ymaps3),reject);return;}
  const script=document.createElement('script');
  const url=new URL(YANDEX_JS_API_URL);
  url.searchParams.set('apikey',key);
  url.searchParams.set('lang','ru_RU');
  script.async=true;
  script.referrerPolicy='strict-origin-when-cross-origin';
  script.src=url.toString();
  script.onload=()=>window.ymaps3?.ready?.then(()=>resolve(window.ymaps3),reject)??reject(Error('SDK unavailable'));
  script.onerror=()=>reject(Error('SDK unavailable'));
  document.head.appendChild(script);
 });
}

// No network work at import time. Call only on an explicit user map selection
// and AFTER legitimate WebView Referer / free-license readiness are confirmed.
export const requestYandexJsApi=createYandexApiLoader(injectYandexJsApi);

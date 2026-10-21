// Central opt-in gate for Yandex JS API v3. No user keys belong in this module.
// Map hits are currently free; extra metered services (geocoder, panoramas,
// search, routing and suggestions) MUST NOT be invoked by the WikiReader map.
export const YANDEX_JS_API_URL='https://api-maps.yandex.ru/v3/';
export const YANDEX_TERMS_URL='https://yandex.ru/legal/maps_termsofuse';
export const YANDEX_KEY_PATTERN=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export class YandexSdkError extends Error{
 constructor(code){super(code);this.name='YandexSdkError';this.code=code;}
}

export function yandexEnablement({selected=false,key='',refererConfigured=false,publiclyAccessible=false}={}){
 if(!selected)return {allowed:false,reason:'not-selected'};
 if(!YANDEX_KEY_PATTERN.test(key))return {allowed:false,reason:'missing-or-invalid-key'};
 if(!refererConfigured)return {allowed:false,reason:'referer-not-confirmed'};
 if(!publiclyAccessible)return {allowed:false,reason:'license-not-confirmed'};
 return {allowed:true,reason:'ready'};
}

export function createYandexApiLoader(loadSdk,{now=()=>Date.now(),retryDelayMs=60_000}={}){
 let activeKey=null,promise=null,failedAt=null,lastFailure='sdk-unavailable';
 return function request(config){
  const decision=yandexEnablement(config);
  if(!decision.allowed)return Promise.resolve({active:false,reason:decision.reason,api:null});
  const {key}=config;
  // A browser JS API client key is observable on the wire. Forbid swapping
  // credentials inside the same WebView session; reload to replace the key.
  if(activeKey&&activeKey!==key)return Promise.resolve({active:false,reason:'reload-required',api:null});
  if(promise)return promise;
  if(failedAt!==null&&now()-failedAt<retryDelayMs){
   return Promise.resolve({active:false,reason:'retry-cooldown',failureCode:lastFailure,retrySeconds:Math.ceil((retryDelayMs-(now()-failedAt))/1000),api:null});
  }
  activeKey=key;
  promise=Promise.resolve().then(()=>loadSdk(key)).then(api=>{
   if(!api)throw new YandexSdkError('sdk-global-missing');
   return {active:true,reason:'ready',api};
  }).catch(error=>{
   failedAt=now();promise=null;
   // Do not propagate raw third-party errors: messages can contain the key.
   lastFailure=error instanceof YandexSdkError?error.code:'sdk-unavailable';
   return {active:false,reason:'sdk-unavailable',failureCode:lastFailure,api:null};
  });
  return promise;
 };
}

export function injectYandexJsApi(key){
 if(typeof document==='undefined'||typeof window==='undefined'){
  return Promise.reject(new YandexSdkError('webview-required'));
 }
 return new Promise((resolve,reject)=>{
  if(window.ymaps3){
   Promise.resolve(window.ymaps3.ready).then(()=>resolve(window.ymaps3),()=>reject(new YandexSdkError('sdk-ready-error')));
   return;
  }
  const script=document.createElement('script');
  const url=new URL(YANDEX_JS_API_URL);
  url.searchParams.set('apikey',key);
  url.searchParams.set('lang','ru_RU');
  let finished=false;
  const complete=(error,api)=>{
   if(finished)return;
   finished=true;
   clearTimeout(timeout);
   script.onload=null;script.onerror=null;
   if(error){script.remove();reject(error);}else resolve(api);
  };
  const timeout=setTimeout(()=>complete(new YandexSdkError('script-timeout')),14000);
  script.async=true;
  // Browser sends the actual application origin as Referer. Do not spoof it.
  script.referrerPolicy='strict-origin-when-cross-origin';
  script.src=url.toString();
  script.onload=()=>{
   const sdk=window.ymaps3;
   if(!sdk||!sdk.ready){complete(new YandexSdkError('sdk-global-missing'));return;}
   Promise.resolve(sdk.ready).then(()=>complete(null,sdk),()=>complete(new YandexSdkError('sdk-ready-error')));
  };
  script.onerror=()=>complete(new YandexSdkError('script-load-error'));
  document.head.appendChild(script);
 });
}

// No network work at import time. Call only on an explicit user map selection
// and AFTER legitimate WebView Referer / free-license readiness are confirmed.
export const requestYandexJsApi=createYandexApiLoader(injectYandexJsApi);

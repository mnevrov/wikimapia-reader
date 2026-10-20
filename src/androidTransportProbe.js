/* Explicit Android/WebView transport comparison. Never persist or copy URLs,
   exception messages, API keys, response bodies or geographic coordinates. */
import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {buildRequest, normalizeArea, validateResponse} from './api.js';
import {waitForApiSlot} from './client.js';

const FIXED_PUBLIC_BBOX=[37.616,55.751,37.625,55.756];
const WEB_TIMEOUT_MS=20000;
const NATIVE_TIMEOUT_MS=20000;

// UI reports only safe, fixed-shape properties. Do not expose raw exceptions:
// network/client errors may include the URL and its API key.
function outcome(transport, durationMs, httpStatus, result, objects=null, polygons=null) {
  return {
    transport,
    outcome:result,
    durationMs:Math.max(0,Math.round(durationMs)),
    httpStatus:Number.isSafeInteger(httpStatus)?httpStatus:null,
    objects:Number.isSafeInteger(objects)?objects:null,
    polygons:Number.isSafeInteger(polygons)?polygons:null
  };
}

function parseResponse(response,transport,durationMs) {
  const status=Number(response.status);
  if(status!==200) return outcome(transport,durationMs,status,'http_error');
  try{
    const data=typeof response.data==='string'?JSON.parse(response.data):response.data;
    const payload=validateResponse(data,'box');
    const rows=normalizeArea(payload);
    return outcome(transport,durationMs,status,'ok',rows.length,rows.filter(r=>r.coords.length>=3).length);
  }catch{
    return outcome(transport,durationMs,status,'schema_error');
  }
}

function networkOutcome(error,transport,durationMs,timedOut) {
  if(timedOut||error?.name==='TimeoutError'||/time.?out/i.test(String(error?.name??'')))
    return outcome(transport,durationMs,null,'timeout');
  return outcome(transport,durationMs,null,'transport_error');
}

async function nativeProbe(url) {
  const begin=performance.now();
  try{
    // Longer than production's 12s, to distinguish a slow connection from
    // a persistent failure. This does not change production timeouts.
    const response=await CapacitorHttp.get({url,connectTimeout:NATIVE_TIMEOUT_MS,readTimeout:NATIVE_TIMEOUT_MS});
    return parseResponse(response,'android_native',performance.now()-begin);
  }catch(e){return networkOutcome(e,'android_native',performance.now()-begin,false);}
}
async function webProbe(url) {
  const begin=performance.now(),controller=new AbortController();
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},WEB_TIMEOUT_MS);
  try{
    const r=await fetch(url,{signal:controller.signal,cache:'no-store'});
    const data=await r.text();
    return parseResponse({status:r.status,data},'webview_fetch',performance.now()-begin);
  }catch(e){
    // Browser CORS errors and some network errors can look identical.
    return networkOutcome(e,'webview_fetch',performance.now()-begin,timedOut);
  }finally{clearTimeout(timer);}
}

/** Two opt-in read-only box requests, one per transport, at least six seconds
 * apart and spaced from ordinary Wikimapia calls by the shared gate. */
export async function compareAndroidTransports(key,onProgress=()=>{}) {
  if(!Capacitor.isNativePlatform())throw new Error('Доступно только в приложении Android.');
  const url=new URL(buildRequest('box',key,{bbox:FIXED_PUBLIC_BBOX,page:1}));
  url.searchParams.set('count','5');
  const result={
    schema:1,kind:'manual-android-transport-test',
    testedAtUtc:new Date().toISOString(),
    apiMethod:'box',sample:'fixed_public_test_area',
    requestCount:2,containsKey:false,containsUrl:false,
    results:[]
  };
  onProgress('Проверка Android HTTP (1 из 2)…');
  await waitForApiSlot();
  result.results.push(await nativeProbe(url.toString()));
  onProgress('Проверка WebView (2 из 2)…');
  await waitForApiSlot();
  result.results.push(await webProbe(url.toString()));
  onProgress('Проверка завершена');
  return result;
}

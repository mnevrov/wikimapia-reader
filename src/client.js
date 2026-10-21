import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {car,hasCar} from './carBridge.js';
import { buildRequest, validateResponse, classifyApiFailure } from './api.js';
import {recordApiMetric} from './apiDiagnostics.js';

let nextRequestAt = 0;
// One request gate for opt-in diagnostics and ordinary browser/native API calls.
export async function waitForApiSlot(signal) {
  signal?.throwIfAborted();
  while (Date.now() < nextRequestAt) {
    const wait = nextRequestAt - Date.now();
    await new Promise((resolve,reject)=>{
      const done=()=>{signal?.removeEventListener('abort',abort);resolve();};
      const timer=setTimeout(done,wait);
      const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('Aborted','AbortError'));};
      signal?.addEventListener('abort',abort,{once:true});
    });
    signal?.throwIfAborted();
  }
  nextRequestAt = Date.now() + 6000;
}
export async function wikimapiaCall(func, key, opts = {}) {
  const url = buildRequest(func, key, opts);
  if(hasCar()){
    opts.signal?.throwIfAborted();const startedAt=Date.now(),requestId=crypto.randomUUID();
    const abort=()=>{void car.cancel({requestId});};
    opts.signal?.addEventListener('abort',abort,{once:true});
    try{
      const {signal,...options}=opts;
      const result=await car.request({requestId,method:func,options:{...options,apiOnly:true}});
      opts.signal?.throwIfAborted();
      const value=validateResponse(result.data,func,opts.id,opts.dataBlocks);
      recordApiMetric(func,Date.now()-startedAt);return value;
    }catch(e){recordApiMetric(func,Date.now()-startedAt,opts.signal?.aborted?'cancelled':classifyApiFailure(e));throw e;}
    finally{opts.signal?.removeEventListener('abort',abort);}
  }
  await waitForApiSlot(opts.signal);
  let result;
  const startedAt = Date.now();
  try {
  // HTTPS is mandatory: the API key travels in the query string as required by Wikimapia.
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({ url, connectTimeout: 12000, readTimeout: 12000 });
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  } else {
    // Browser mode requires API CORS support; no third-party proxy is used.
    const controller = new AbortController();
    const abort = () => controller.abort();
    opts.signal?.addEventListener('abort',abort,{once:true});
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; abort(); }, 12000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      result = await response.json();
    } catch (error) {
      if (timedOut && !opts.signal?.aborted) {
        const timeout = new Error('Server timeout');
        timeout.name = 'TimeoutError';
        throw timeout;
      }
      throw error;
    } finally { clearTimeout(timer); opts.signal?.removeEventListener('abort',abort); }
  }
  opts.signal?.throwIfAborted();
  const validated = validateResponse(result, func, opts.id, opts.dataBlocks);
  recordApiMetric(func, Date.now() - startedAt);
  return validated;
  } catch (error) {
    const kind = opts.signal?.aborted ? 'cancelled' : classifyApiFailure(error, {offline:typeof navigator !== 'undefined' && navigator.onLine === false});
    recordApiMetric(func, Date.now() - startedAt, kind);
    throw error;
  }
}

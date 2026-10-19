import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { buildRequest, validateResponse, classifyApiFailure } from './api.js';
import {recordApiMetric} from './apiDiagnostics.js';

let nextRequestAt = 0;
export async function wikimapiaCall(func, key, opts = {}) {
  const url = buildRequest(func, key, opts);
  opts.signal?.throwIfAborted();
  while (Date.now() < nextRequestAt) {
    const wait = nextRequestAt - Date.now();
    await new Promise((resolve,reject)=>{
    const done=()=>{opts.signal?.removeEventListener('abort',abort);resolve();};
    const timer=setTimeout(done,wait);
    const abort=()=>{clearTimeout(timer);opts.signal?.removeEventListener('abort',abort);reject(new DOMException('Aborted','AbortError'));};
    opts.signal?.addEventListener('abort',abort,{once:true});
  });
    opts.signal?.throwIfAborted();
  }
  nextRequestAt = Date.now() + 6000;
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
  const validated = validateResponse(result, func, opts.id);
  recordApiMetric(func, Date.now() - startedAt);
  return validated;
  } catch (error) {
    const kind = opts.signal?.aborted ? 'cancelled' : classifyApiFailure(error, {offline:typeof navigator !== 'undefined' && navigator.onLine === false});
    recordApiMetric(func, Date.now() - startedAt, kind);
    throw error;
  }
}

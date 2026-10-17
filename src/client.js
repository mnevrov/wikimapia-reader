import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { buildRequest, validateResponse } from './api.js';

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
    const timer = setTimeout(abort, 12000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      result = await response.json();
    } finally { clearTimeout(timer); opts.signal?.removeEventListener('abort',abort); }
  }
  opts.signal?.throwIfAborted();
  return validateResponse(result, func, opts.id);
}

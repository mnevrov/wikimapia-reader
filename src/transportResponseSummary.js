/* Pure, allowlisted diagnostics for live Wikimapia API responses.
   No URLs, keys, exception messages or response contents leave this function. */
import {ApiError,normalizeArea,validateResponse} from './api.js';

export function contentCategory(headers) {
  let raw='';
  try {
    if (headers && typeof headers.get==='function') raw=headers.get('content-type')||'';
    else if (headers && typeof headers==='object'){
      const key=Object.keys(headers).find(k=>k.toLowerCase()==='content-type');
      raw=key ? headers[key] : '';
    }
  } catch { /* Unknown headers are not an error. */ }
  const mime=String(Array.isArray(raw)?raw[0]:raw||'').split(';')[0].trim().toLowerCase();
  if (mime==='application/json'||mime.endsWith('+json')) return 'json';
  if (mime==='text/html'||mime==='application/xhtml+xml') return 'html';
  if (mime.startsWith('text/'))return 'text';
  return mime?'other':'unknown';
}

// Deliberately allowlist known Wikimapia error codes. Never export raw debug
// fields: they are server-controlled and may echo secrets or query parameters.
// 1004 ("Key limit has been reached") is documented in historical examples.
// Other arbitrary numeric/string values are not a safe telemetry contract.
export function safeApiCode(payload) {
  const debug=payload && !Array.isArray(payload) && typeof payload==='object' ? payload.debug : null;
  if(!debug || typeof debug!=='object' || Array.isArray(debug))return null;
  const raw=debug.code;
  if(raw===1004 || raw==='1004')return 1004;
  return null;
}

export function safeAreaResponseSummary(response) {
  const status=Number(response?.status);
  const httpStatus=Number.isSafeInteger(status)&&status>=100&&status<=599?status:null;
  const mime=contentCategory(response?.headers);
  const base={httpStatus,contentCategory:mime,outcome:'schema_error',reason:null,apiCode:null,objects:null,polygons:null};
  if(httpStatus!==200)return {...base,outcome:'http_error',reason:'http_non_200'};
  let data=response?.data;
  if(typeof data==='string'){
    try{data=JSON.parse(data);}
    catch{return {...base,reason:'invalid_json'};}
  }
  if(Array.isArray(data))return {...base,reason:'array_root'};
  if(!data||typeof data!=='object')return {...base,reason:'invalid_root'};
  const withCode={...base,apiCode:safeApiCode(data)};
  // Interpret the known machine code even when the server omits its prose.
  // No change to the production API validator or its error handling.
  if(withCode.apiCode===1004)return {...withCode,outcome:'api_rejection',reason:'quota'};
  try {
    validateResponse(data,'box');
  } catch(e){
    if(e instanceof ApiError && e.kind==='auth')return {...withCode,outcome:'api_rejection',reason:'auth'};
    if(e instanceof ApiError && e.kind==='quota')return {...withCode,outcome:'api_rejection',reason:'quota'};
    if(data.debug||data.error||data.error_message)return {...withCode,outcome:'api_rejection',reason:'api_error'};
    return {...withCode,reason:'missing_folder'};
  }
  try{
    const rows=normalizeArea(data);
    return {...withCode,outcome:'ok',reason:'valid_folder',objects:rows.length,polygons:rows.filter(x=>x.coords.length>=3).length};
  }catch{return {...withCode,reason:'normalization_error'};}
}

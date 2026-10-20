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

export function safeAreaResponseSummary(response) {
  const status=Number(response?.status);
  const httpStatus=Number.isSafeInteger(status)&&status>=100&&status<=599?status:null;
  const mime=contentCategory(response?.headers);
  const base={httpStatus,contentCategory:mime,outcome:'schema_error',reason:null,objects:null,polygons:null};
  if(httpStatus!==200)return {...base,outcome:'http_error',reason:'http_non_200'};
  let data=response?.data;
  if(typeof data==='string'){
    try{data=JSON.parse(data);}
    catch{return {...base,reason:'invalid_json'};}
  }
  if(Array.isArray(data))return {...base,reason:'array_root'};
  if(!data||typeof data!=='object')return {...base,reason:'invalid_root'};
  try {
    validateResponse(data,'box');
  } catch(e){
    if(e instanceof ApiError && e.kind==='auth')return {...base,outcome:'api_rejection',reason:'auth'};
    if(e instanceof ApiError && e.kind==='quota')return {...base,outcome:'api_rejection',reason:'quota'};
    if(data.debug||data.error||data.error_message)return {...base,outcome:'api_rejection',reason:'api_error'};
    return {...base,reason:'missing_folder'};
  }
  try{
    const rows=normalizeArea(data);
    return {...base,outcome:'ok',reason:'valid_folder',objects:rows.length,polygons:rows.filter(x=>x.coords.length>=3).length};
  }catch{return {...base,reason:'normalization_error'};}
}

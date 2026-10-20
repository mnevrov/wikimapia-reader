import {Capacitor,registerPlugin} from '@capacitor/core';
const native=Capacitor.isNativePlatform()?registerPlugin('WikiReaderSite'):null;
export const SITE_MAX_BYTES=4*1024*1024;
export function siteUrl(value){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.hostname!=='wikimapia.org'||u.username||u.password||u.port||u.hash||u.searchParams.has('key')||!(/^\/\d+\/(?:ru\/[^?]*)?$/.test(u.pathname)||/^\/z1\/itiles\/(?:[0-3]{3}\/)*[0-3]{1,3}\.xy$/.test(u.pathname)||u.pathname==='/search/'))throw Error('Недопустимый адрес Wikimapia');
 return u.href;
}
export function createSiteTransport(send){
 return async({url,signal,body})=>{
  const safe=siteUrl(url);signal?.throwIfAborted();
  try{
   const result=await send({url:safe,body,signal});signal?.throwIfAborted();
   if(result.finalUrl)siteUrl(result.finalUrl);
   if(result.status!==200)throw Error(`HTTP ${result.status}`);
   if(typeof result.text!=='string'||result.text.length>SITE_MAX_BYTES||new TextEncoder().encode(result.text).length>SITE_MAX_BYTES)throw Error('Слишком большой ответ сайта');
   return result;
  }catch(e){signal?.throwIfAborted();if(e.name==='AbortError')throw e;
   if(/^HTTP (403|429)$/.test(e.message))throw Error('Сайт Wikimapia ограничил доступ. Повторите позже.');
   throw Error('Не удалось загрузить данные сайта Wikimapia. Повторите позже.');
  }
 };
}
let sequence=0;
export const siteRequest=createSiteTransport(async({url,body,signal})=>{
 if(native){
  const id=String(++sequence),cancel=()=>{native.cancel({id}).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
  try{return await native.request({id,url,body});}finally{signal?.removeEventListener('abort',cancel);}
 }
 const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,12000);
 try{
  const r=await fetch(url,{method:body?'POST':'GET',body,headers:body?{'Content-Type':'application/x-www-form-urlencoded'}:undefined,signal:controller.signal,credentials:'omit',redirect:'error'});
  const reader=r.body?.getReader();let text='',size=0;const decoder=new TextDecoder();
  if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>SITE_MAX_BYTES)throw Error('Too large');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}}
  else text=await r.text();
  return {status:r.status,text,finalUrl:r.url};
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
});

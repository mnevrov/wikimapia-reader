import {normalizePlace,normalizeArea,geometryOf} from './api.js';
const reliable=s=>s==='ok'||s==='empty';
function collectionValid(value,field){
 let items=value;if(!Array.isArray(items)&&items&&typeof items==='object'){const key=['places','place','photo','comment','items','item'].find(k=>items[k]!==undefined);items=key?items[key]:null;if(items&&!Array.isArray(items)&&typeof items==='object')items=[items];}
 if(!Array.isArray(items))return false;
 return items.every(x=>x&&typeof x==='object'&&(field==='comments'?([true,1,'1'].includes(x.is_deleted)||['text','comment','message'].some(k=>typeof x[k]==='string')):['big_url','960_url','thumbnail_url','url_big','url_full','big','fullsize','url','url_thumb','thumb'].some(k=>typeof x[k]==='string')));
}
export function createDataSource({site,api,getKey}){
 let apiArea={key:null,ids:new Set(),website:[],hasSite:false};
 return {
  async getPlace(id,{signal}={}){
   signal?.throwIfAborted();let result=null;
   try{result=await site.getPlace(id,{signal});}catch(e){signal?.throwIfAborted();if(e.name==='AbortError')throw e;}
   signal?.throwIfAborted();
   const blocks={title:'unavailable',description:'unavailable',photos:'unavailable',comments:'unavailable',...result?.blocks};
   let place=result?.place??{id,title:`Объект #${id}`,description:'',photos:[],comments:[],url:`https://wikimapia.org/${id}/ru/`};
   const missing=Object.keys(blocks).filter(k=>!reliable(blocks[k])),key=getKey();let source='site';
   if(missing.length&&key){
    const dataBlocks=[...new Set(missing.map(k=>k==='title'||k==='description'?'main':k))];
    try{const payload=await api('place.getbyid',key,{id,signal,dataBlocks});signal?.throwIfAborted();const normalized=normalizePlace(payload),raw=payload.place??payload;if(normalized.id!==id)throw Error('ID mismatch');
     for(const field of missing){const available=field==='title'?typeof (raw.title??raw.main?.title)==='string'&&!!(raw.title??raw.main?.title):field==='description'?typeof (raw.main??raw).description==='string':collectionValid(raw[field],field)&&((raw[field]?.length??0)===0||normalized[field].length>0);
      if(available){place={...place,[field]:normalized[field]};blocks[field]=(Array.isArray(normalized[field])?normalized[field].length:normalized[field])?'ok':'empty';source=result?'hybrid':'api';}}
     const coords=geometryOf(payload);if(coords.length>=3)place={...place,coords};
    }catch(e){signal?.throwIfAborted();if(e.name==='AbortError')throw e;if(!result)throw e;}
   }
   signal?.throwIfAborted();if(!result&&source==='site')throw Error('Сайт Wikimapia недоступен. Попробуйте позже или добавьте резервный API-ключ в настройках.');
   const warnings=Object.keys(blocks).filter(k=>!reliable(blocks[k])).map(k=>({title:'Название',description:'Описание',photos:'Фотографии',comments:'Комментарии'}[k]+' недоступны: сайт не вернул подтверждённые данные.'));
   return {...place,blocks,warnings,dataSource:source};
  },
  async getArea(opts){
   opts.signal?.throwIfAborted();let area=null,siteFailure=null;
   // Subsequent API pages continue the fallback; never replay website tiles per page.
   if((opts.page??1)===1){try{area=await site.getArea(opts);}catch(e){opts.signal?.throwIfAborted();if(e.name==='AbortError')throw e;siteFailure=e;}}
   opts.signal?.throwIfAborted();const key=getKey(),areaKey=JSON.stringify(opts.bbox);
   if((opts.page??1)===1||apiArea.key!==areaKey)apiArea={key:areaKey,ids:new Set(),website:area?.places??[],hasSite:!!area};
   if((!area||!area.complete)&&key){try{
    const payload=await api('box',key,opts);opts.signal?.throwIfAborted();
    const list=normalizeArea(payload),unique=new Map(apiArea.website.map(p=>[p.id,p]));for(const p of list)if(!unique.has(p.id))unique.set(p.id,p);
    const found=Number.isSafeInteger(payload.found)?payload.found:null;
    const before=apiArea.ids.size;for(const p of list)apiArea.ids.add(p.id);const progress=apiArea.ids.size>before,complete=found!==null?apiArea.ids.size>=found:list.length<50;
    return {folder:[...unique.values()].map(p=>({...p,polygon:p.coords.map(([lat,lon])=>({x:lon,y:lat}))})),found:apiArea.hasSite?null:found,more:!complete&&progress&&list.length>0,complete,source:apiArea.hasSite?'hybrid':'api'};
   }catch(e){opts.signal?.throwIfAborted();if(e.name==='AbortError'||!area)throw e;}}
   if(!area&&siteFailure)throw siteFailure;
   if(!area)throw Error('Не удалось загрузить контуры Wikimapia. Попробуйте позже или добавьте резервный API-ключ.');
   return {folder:area.places.map(p=>({...p,polygon:p.coords.map(([lat,lon])=>({x:lon,y:lat}))})),found:null,more:false,complete:area.complete,source:'site'};
  },
  async search(opts){
   opts.signal?.throwIfAborted();try{const r=await site.search(opts);opts.signal?.throwIfAborted();return r;}catch(e){opts.signal?.throwIfAborted();if(e.name==='AbortError')throw e;const key=getKey();if(!key)throw Error('Поиск сайта недоступен. Можно открыть ID или ссылку; API-ключ в настройках доступен как резерв.');const r=await api('search',key,opts);opts.signal?.throwIfAborted();return {places:normalizeArea(r),found:r.found,source:'api'};}
  }
 };
}

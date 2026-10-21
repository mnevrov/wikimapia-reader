// Explicitly saved Wikimapia objects only. Separate from region cache and credentials.
import {Capacitor,CapacitorHttp} from '@capacitor/core';

export const OFFLINE_DEFAULTS={limitMB:100,retentionDays:30};
export const offlinePreferences=value=>({
  limitMB:[25,50,100,250,500].includes(Number(value?.limitMB))?Number(value.limitMB):100,
  retentionDays:[7,30,90,365].includes(Number(value?.retentionDays))?Number(value.retentionDays):30
});
export const offlineStatus=(entry,preferences=OFFLINE_DEFAULTS,now=Date.now())=>{
  if(!entry)return 'absent';
  if(entry.error)return 'error';
  if(entry.missing>0||Object.values(entry.blocks??{}).some(s=>!['ok','empty'].includes(s)))return 'partial';
  if(now-entry.savedAt>offlinePreferences(preferences).retentionDays*86400000)return 'stale';
  return 'saved';
};
const encode=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
const validId=id=>Number.isSafeInteger(Number(id))&&Number(id)>0;
const quotaError=()=>new Error('Недостаточно места в офлайн-хранилище. Увеличьте лимит или удалите объекты.');
const guardError=e=>e?.name==='QuotaExceededError'?new Error('Недостаточно свободной памяти устройства. Освободите место и повторите попытку.'):e;
let connection;
function database(){
  if(!connection){
    connection=new Promise((resolve,reject)=>{
      const req=indexedDB.open('wikireader-offline',1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('objects'))db.createObjectStore('objects',{keyPath:'id'});
        if(!db.objectStoreNames.contains('media'))db.createObjectStore('media',{keyPath:'id'});
        if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings',{keyPath:'id'});
      };
      req.onblocked=()=>reject(new Error('Хранилище занято другой вкладкой'));
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>{
        const db=req.result;
        db.onversionchange=()=>{db.close();connection=null;};
        resolve(db);
      };
    }).catch(error=>{connection=null;throw error;});
  }
  return connection;
}
async function transaction(names,mode,run){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(names,mode);
    let value,workError;
    try{value=run(tx);}catch(e){workError=e;tx.abort();}
    tx.oncomplete=()=>resolve(value);
    tx.onabort=()=>reject(guardError(workError||tx.error||new Error('Запись прервана')));
    tx.onerror=()=>{};
  });
}
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
async function state(){
  const db=await database();
  const tx=db.transaction(['objects','media','settings'],'readonly');
  const rows=await request(tx.objectStore('objects').getAll());
  const media=await request(tx.objectStore('media').getAll());
  const settings=await request(tx.objectStore('settings').get('preferences'));
  const preferences=offlinePreferences(settings);
  const textBytes=rows.reduce((total,row)=>total+row.textBytes,0);
  const mediaBytes=media.reduce((total,row)=>total+row.bytes,0);
  return {rows,media,preferences,textBytes,mediaBytes,bytes:textBytes+mediaBytes,limitBytes:preferences.limitMB*1048576};
}
function cleaned(data){
  if(!validId(data?.id))throw new Error('Неверный ID объекта');
  const photos=Array.isArray(data.photos)?data.photos.slice(0,40).map(p=>({
    src:typeof p.src==='string'&&/^https:\/\//i.test(p.src)&&!/[?&](?:key|apikey|token)=/i.test(p.src)?p.src:'',
    author:String(p.author||'').slice(0,250)
  })).filter(p=>p.src):[];
  return {
    id:Number(data.id),title:String(data.title||'Без названия').slice(0,1000),
    description:String(data.description||''),url:'https://wikimapia.org/'+Number(data.id)+'/',
    // Only public fields; never serialize responses or credentials.
    comments:Array.isArray(data.comments)?data.comments.slice(0,500).map(c=>({
      author:String(c.author||'Участник Wikimapia').slice(0,250),
      text:String(c.text||''),...(typeof c.dateLabel==='string'&&c.dateLabel.trim()?{dateLabel:c.dateLabel.trim().slice(0,100)}:{}),date:typeof c.date==='string'?c.date:null
    })):[],photos,
    ...(data.blocks?{blocks:Object.fromEntries(['title','description','photos','comments'].map(k=>[k,['ok','empty','unavailable','invalid'].includes(data.blocks[k])?data.blocks[k]:'unavailable']))}:{}),
    ...(['site','hybrid','api'].includes(data.dataSource)?{dataSource:data.dataSource}:{}),
    ...(data.blocks?{warnings:Object.entries(data.blocks).filter(([k,v])=>['title','description','photos','comments'].includes(k)&&!['ok','empty'].includes(v)).map(([k])=>({title:'Название',description:'Описание',photos:'Фотографии',comments:'Комментарии'}[k]+' временно недоступны.'))}:{})
  };
}
const mediaKey=(id,index)=>String(id)+':'+index;
function savedRow(data,now=Date.now()){
  const row={...cleaned(data),savedAt:now,missing:0,error:'',textBytes:0};
  row.missing=row.photos.length;
  let n=encode(row);
  while(n!==row.textBytes){row.textBytes=n;n=encode(row);}
  return row;
}
async function mediaBlob(url,signal){
  signal?.throwIfAborted();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  try{
    if(Capacitor.isNativePlatform()){
      const response=await CapacitorHttp.get({url,responseType:'blob',connectTimeout:15000,readTimeout:15000});
      signal?.throwIfAborted();
      if(response.status!==200||typeof response.data!=='string')throw new Error('Фото недоступно');
      const raw=atob(response.data);
      if(raw.length>8*1048576)throw quotaError();
      const bytes=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      return new Blob([bytes],{type:(response.headers?.['Content-Type']||response.headers?.['content-type']||'image/jpeg').split(';')[0]});
    }
    const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error('Фото недоступно');
    const length=Number(response.headers.get('content-length')||0);
    if(length>8*1048576)throw quotaError();
    const blob=await response.blob();
    if(blob.size>8*1048576||!blob.type.startsWith('image/'))throw new Error('Файл не является подходящим фото');
    return blob;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
let writes=Promise.resolve();
const serialize=job=>{const result=writes.then(job);writes=result.catch(()=>{});return result;};
export const offlineStore={
  snapshot:async()=>{
    const s=await state();
    return {entries:s.rows.map(row=>({...row,status:offlineStatus(row,s.preferences)})).sort((a,b)=>b.savedAt-a.savedAt),
      preferences:s.preferences,bytes:s.bytes,textBytes:s.textBytes,mediaBytes:s.mediaBytes,limitBytes:s.limitBytes,count:s.rows.length};
  },
  read:async id=>{
    if(!validId(id))return null;
    const s=await state(),record=s.rows.find(r=>r.id===Number(id));
    if(!record)return null;
    const photos=record.photos.map((p,index)=>{
      const found=s.media.find(m=>m.id===mediaKey(record.id,index));
      return found?{...p,src:URL.createObjectURL(found.blob)}:null;
    }).filter(Boolean);
    return {record,details:{...record,photos},status:offlineStatus(record,s.preferences)};
  },
  save:(data,{signal,onProgress}={})=>serialize(async()=>{
    const row=savedRow(data);
    const previous=await state();
    const old=previous.rows.find(r=>r.id===row.id);
    const oldMedia=previous.media.filter(m=>m.owner===row.id);
    const free=previous.limitBytes-(previous.bytes-(old?.textBytes||0)-oldMedia.reduce((n,m)=>n+m.bytes,0));
    if(row.textBytes>free)throw quotaError();
    signal?.throwIfAborted();
    // Text is committed first, and remains available when media transfer is interrupted.
    await transaction(['objects','media'],'readwrite',tx=>{
      tx.objectStore('objects').put(row);
      for(const m of oldMedia)tx.objectStore('media').delete(m.id);
    });
    onProgress?.({done:0,total:row.photos.length});
    let missing=row.photos.length,addedBytes=0;
    for(let i=0;i<row.photos.length;i++){
      if(signal?.aborted)break;
      try{
        const blob=await mediaBlob(row.photos[i].src,signal);
        const now=await state();
        if(now.bytes+blob.size>now.limitBytes)throw quotaError();
        await transaction(['media'],'readwrite',tx=>tx.objectStore('media').put({
          id:mediaKey(row.id,i),owner:row.id,blob,bytes:blob.size
        }));
        missing--;addedBytes+=blob.size;
      }catch(e){if(signal?.aborted)break;if(e?.name==='QuotaExceededError')throw guardError(e);}
      onProgress?.({done:i+1,total:row.photos.length});
    }
    row.missing=missing;
    row.textBytes=0;
    let n=encode(row);
    while(row.textBytes!==n){row.textBytes=n;n=encode(row);}
    await transaction(['objects'],'readwrite',tx=>tx.objectStore('objects').put(row));
    return {status:offlineStatus(row,(await state()).preferences),missing,mediaBytes:addedBytes};
  }),
  remove:id=>serialize(async()=>{
    const s=await state();
    await transaction(['objects','media'],'readwrite',tx=>{
      tx.objectStore('objects').delete(Number(id));
      for(const m of s.media)if(m.owner===Number(id))tx.objectStore('media').delete(m.id);
    });
  }),
  clear:()=>serialize(async()=>transaction(['objects','media'],'readwrite',tx=>{
    tx.objectStore('objects').clear();tx.objectStore('media').clear();
  })),
  importRows:rows=>serialize(async()=>{
    if(!Array.isArray(rows)||rows.length>5000)throw new Error('Некорректная резервная копия');
    const current=await state();
    const existing=new Set(current.rows.map(row=>row.id));
    const pending=[],seen=new Set(),now=Date.now();
    for(const item of rows){
      if(!validId(item?.id)||typeof item.title!=='string'||typeof item.description!=='string'||
        item.title.length>1000||item.description.length>400000||!Array.isArray(item.comments)||item.comments.length>500||
        !Number.isSafeInteger(item.savedAt)||item.savedAt<1577836800000||item.savedAt>now+86400000)
        throw new Error('Некорректная офлайн-карточка');
      if(existing.has(item.id)||seen.has(item.id))continue;
      seen.add(item.id);
      // Imported text stays readable offline. Media are intentionally not included.
      const row=savedRow({id:item.id,title:item.title,description:item.description,comments:item.comments,photos:[]},item.savedAt);
      pending.push(row);
    }
    const extra=pending.reduce((sum,row)=>sum+row.textBytes,0);
    if(current.bytes+extra>current.limitBytes)throw quotaError();
    if(pending.length)await transaction(['objects'],'readwrite',tx=>{
      for(const row of pending)tx.objectStore('objects').add(row);
    });
    return {added:pending.length,skipped:rows.length-pending.length};
  }),
  setPreferences:p=>serialize(async()=>{
    const preferences=offlinePreferences(p);
    const s=await state();
    if(s.bytes>preferences.limitMB*1048576)throw quotaError();
    await transaction(['settings'],'readwrite',tx=>tx.objectStore('settings').put({id:'preferences',...preferences}));
    return preferences;
  })
};

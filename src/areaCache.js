// Public contours only. Requests, credentials, descriptions and media are excluded.
export const CACHE_MAX_AGE=24*60*60*1000;
export const CACHE_MAX_BYTES=12*1024*1024;
export const CACHE_MAX_AREAS=32;
export class CacheCapacityError extends Error {}
export const cachePreferences=value=>({retentionDays:[1,7,30].includes(value?.retentionDays)?value.retentionDays:1});
export function cacheRecord(entry){
 const {bbox,state,updated}=entry??{};
 if(!Array.isArray(bbox)||bbox.length!==4||bbox.some(v=>!Number.isFinite(v))||bbox[0]>=bbox[2]||bbox[1]>=bbox[3]||bbox[0]<-180||bbox[2]>180||bbox[1]<-90||bbox[3]>90||!Number.isFinite(updated)||!Array.isArray(state?.places))return null;
 const places=state.places.filter(p=>p&&Number.isSafeInteger(p.id)&&p.id>0&&typeof p.title==='string'&&Array.isArray(p.coords)).map(p=>({id:p.id,title:p.title,coords:p.coords.filter(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=90&&Math.abs(c[1])<=180)}));
 const record={id:bbox.join(','),bbox:[...bbox],updated,pinned:entry.pinned===true,state:{places,page:Number.isSafeInteger(state.page)&&state.page>=1?state.page:1,found:Number.isSafeInteger(state.found)&&state.found>=0?state.found:null,more:!!state.more}};
 record.state.complete=state.complete===false?false:!record.state.more&&(record.state.found!==null?places.length>=record.state.found:(state.complete===true||places.length<50));
 record.bytes=0;
 let bytes=new TextEncoder().encode(JSON.stringify(record)).length;
 while(record.bytes!==bytes){record.bytes=bytes;bytes=new TextEncoder().encode(JSON.stringify(record)).length;}
 return record.bytes<=CACHE_MAX_BYTES?record:null;
}
export function retainedRecords(records,now=Date.now(),preferences={}){
 const {retentionDays}=cachePreferences(preferences);let bytes=0,count=0;
 const candidates=records.map(cacheRecord).filter(r=>r&&(r.pinned||(r.updated<=now&&now-r.updated<retentionDays*CACHE_MAX_AGE))).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updated-a.updated);
 return candidates.filter(r=>{
  if(count>=CACHE_MAX_AREAS||bytes+r.bytes>CACHE_MAX_BYTES){if(r.pinned)throw new CacheCapacityError('Недостаточно места для закрепления. Открепите другую область.');return false;}
  bytes+=r.bytes;count++;return true;
 });
}
let connection;
async function database(){
 if(!connection){connection=new Promise((resolve,reject)=>{
  const request=indexedDB.open('wikireader-areas',2);let blocked=false;
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('areas'))db.createObjectStore('areas',{keyPath:'id'});if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings',{keyPath:'id'});};
  request.onblocked=()=>{blocked=true;reject(new Error('cache upgrade blocked'));};
  request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
  request.onerror=()=>reject(request.error);
 });connection.catch(()=>{connection=null;});}
 return connection;
}
let queue=Promise.resolve();
function serialized(work){const job=queue.then(work);queue=job.catch(()=>{});return job;}
// Read, policy pruning, updates and clearing share one atomic transaction/queue.
function access(mutate){return serialized(async()=>{
 const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction(['areas','settings'],'readwrite');const store=tx.objectStore('areas'),settings=tx.objectStore('settings');let rows,prefs,result,failure;
  const finish=()=>{if(!rows||!prefs)return;try{
   let records=retainedRecords(rows,Date.now(),prefs);
   const changed=mutate?.(records,prefs);if(changed){records=changed.records??records;prefs=changed.preferences??prefs;result=changed.result;}
   records=retainedRecords(records,Date.now(),prefs);
   const ids=new Set(records.map(r=>r.id));for(const row of rows)if(!ids.has(row.id))store.delete(row.id);
   for(const record of records){const old=rows.find(r=>r.id===record.id);if(!old||old.updated!==record.updated||old.pinned!==record.pinned||old.bytes!==record.bytes||old.state?.complete!==record.state.complete)store.put(record);}
   settings.put({id:'preferences',...prefs});
   const entries=records.map(r=>({...r,retentionDays:prefs.retentionDays}));
   result={entries,preferences:prefs,count:entries.length,bytes:entries.reduce((n,r)=>n+r.bytes,0),pinnedCount:entries.filter(r=>r.pinned).length,...result};
  }catch(e){failure=e;tx.abort();}};
  const a=store.getAll();a.onsuccess=()=>{rows=a.result;finish();};const p=settings.get('preferences');p.onsuccess=()=>{prefs=cachePreferences(p.result);finish();};
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure??tx.error??new Error('cache transaction aborted'));tx.onerror=()=>{};
 });
});}
export const areaCache={
 read:async()=> (await access()).entries,
 snapshot:()=>access(),
 put:entry=>access((records,prefs)=>{
  const record=cacheRecord(entry);if(!record)return{result:{saved:false}};
  const old=records.find(r=>r.id===record.id);record.pinned=old?.pinned??false;
  try{const keep=retainedRecords([...records.filter(r=>r.id!==record.id),record],Date.now(),prefs);return{records:keep,result:{saved:keep.some(r=>r.id===record.id)}};}catch(e){if(e instanceof CacheCapacityError)return{result:{saved:false}};throw e;}
 }),
 setPreferences:value=>access((records)=>({records,preferences:cachePreferences(value)})),
 pinMany:(ids,pinned)=>access(records=>{
  const wanted=new Set(ids);if(!wanted.size||[...wanted].some(id=>!records.some(r=>r.id===id)))throw new Error('Область ещё не сохранена на устройстве.');
  return{records:records.map(r=>wanted.has(r.id)?{...r,pinned:!!pinned}:r)};
 }),
 clear:({includePinned=false}={})=>access(records=>({records:includePinned?[]:records.filter(r=>r.pinned)}))
};

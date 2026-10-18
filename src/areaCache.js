// Public contour data only. Never persist requests, credentials, comments or photos here.
export const CACHE_MAX_AGE=24*60*60*1000;
export const CACHE_MAX_BYTES=12*1024*1024;
export const CACHE_MAX_AREAS=32;
export function cacheRecord(entry){
 const {bbox,state,updated}=entry??{};
 if(!Array.isArray(bbox)||bbox.length!==4||bbox.some(v=>!Number.isFinite(v))||bbox[0]>=bbox[2]||bbox[1]>=bbox[3]||bbox[0]<-180||bbox[2]>180||bbox[1]<-90||bbox[3]>90||!Number.isFinite(updated)||!Array.isArray(state?.places))return null;
 const places=state.places.filter(p=>Number.isSafeInteger(p.id)&&p.id>0&&typeof p.title==='string'&&Array.isArray(p.coords)).map(p=>({id:p.id,title:p.title,coords:p.coords.filter(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=90&&Math.abs(c[1])<=180)}));
 const record={id:bbox.join(','),bbox:[...bbox],updated,state:{places,page:state.page,found:state.found,more:!!state.more}};
 record.bytes=new TextEncoder().encode(JSON.stringify(record)).length;
 return record.bytes<=CACHE_MAX_BYTES?record:null;
}
export function retainedRecords(records,now=Date.now()){
 let bytes=0;
 return records.map(cacheRecord).filter(r=>r&&now-r.updated<CACHE_MAX_AGE&&r.updated<=now).sort((a,b)=>b.updated-a.updated).filter((r,i)=>{if(i>=CACHE_MAX_AREAS||bytes+r.bytes>CACHE_MAX_BYTES)return false;bytes+=r.bytes;return true;});
}
function transactionDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error??new Error('cache transaction aborted'));tx.onerror=()=>{};});}
let connection;
async function database(){
 if(!connection){connection=new Promise((resolve,reject)=>{
  const request=indexedDB.open('wikireader-areas',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('areas',{keyPath:'id'});
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
  request.onerror=()=>reject(request.error);
 });connection.catch(()=>{connection=null;});}
 return connection;
}
let queue=Promise.resolve();
function serialized(work){const job=queue.then(work);queue=job.catch(()=>{});return job;}
export const areaCache={
 read:()=>serialized(async()=>{
  const db=await database();const tx=db.transaction('areas','readwrite');const done=transactionDone(tx);const store=tx.objectStore('areas');let kept=[];
  const request=store.getAll();request.onsuccess=()=>{kept=retainedRecords(request.result);const ids=new Set(kept.map(r=>r.id));for(const old of request.result)if(!ids.has(old.id))store.delete(old.id);};
  await done;return kept;
 }),
 put:entry=>serialized(async()=>{
  const record=cacheRecord(entry);if(!record)return;
  const db=await database();const tx=db.transaction('areas','readwrite');const done=transactionDone(tx);const store=tx.objectStore('areas');
  const request=store.getAll();request.onsuccess=()=>{
   const all=request.result.filter(r=>r.id!==record.id);const keep=retainedRecords([...all,record]);const ids=new Set(keep.map(r=>r.id));
   for(const old of all)if(!ids.has(old.id))store.delete(old.id);
   if(ids.has(record.id))store.put(record);
  };
  await done;
 }),
 clear:()=>serialized(async()=>{const db=await database();const tx=db.transaction('areas','readwrite');const done=transactionDone(tx);tx.objectStore('areas').clear();await done;})
};

import {Capacitor,registerPlugin} from '@capacitor/core';
import {readFavorites} from './favorites.js';
import {favoriteOperations,mergeAreas} from './carSync.js';
export const car=registerPlugin('CarData');
export const hasCar=()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('CarData');
const FAVORITES='wikimapia-reader-favorites',JOURNAL='wikireader-car-journal-v1';
let queue=Promise.resolve(),listener=()=>{};
const serialized=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job;};
export function persistFavorites(next){
 const old=readFavorites(localStorage.getItem(FAVORITES));
 if(hasCar()){
  const operations=JSON.parse(localStorage.getItem(JOURNAL)||'[]');
  // Journal first. A crash cannot lose the user's intent before native acknowledgement.
  localStorage.setItem(JOURNAL,JSON.stringify([...operations,...favoriteOperations(old,next).map(op=>({...op,opId:crypto.randomUUID()}))]));
 }
 localStorage.setItem(FAVORITES,JSON.stringify(next));
 if(hasCar())void syncFavorites().catch(()=>{});
}
export function syncFavorites(){return serialized(async()=>{
 if(!hasCar())return;
 const legacy=readFavorites(localStorage.getItem(FAVORITES));
 const sent=JSON.parse(localStorage.getItem(JOURNAL)||'[]');
 const result=await car.sync({legacy,operations:sent});
 const pending=JSON.parse(localStorage.getItem(JOURNAL)||'[]').slice(sent.length);
 localStorage.setItem(JOURNAL,JSON.stringify(pending));
 if(pending.length)return; // A later serialized sync will acknowledge edits made in flight.
 const list=readFavorites(JSON.stringify(result.favorites));
 localStorage.setItem(FAVORITES,JSON.stringify(list));listener(list);
});}
export function watchFavorites(fn){listener=fn;return()=>{listener=()=>{};};}
export async function syncAreas(cache){if(!hasCar())return;const web=await cache.read();const result=await car.areas({entries:web});for(const r of mergeAreas(web,result.entries))await cache.put(r);}

import test from 'node:test';
import assert from 'node:assert/strict';
import {cacheRecord,retainedRecords,CACHE_MAX_AREAS,CACHE_MAX_AGE,CACHE_MAX_BYTES} from '../src/areaCache.js';
const entry=(i=0)=>({bbox:[i,0,i+.01,.01],updated:Date.now()-i,state:{places:[{id:1,title:'Place',coords:[[0,0],[0,.01],[.01,.01]],secret:'not retained'}],page:1,found:1,more:false,key:'never persisted'},key:'never persisted'});
test('contour records whitelist fields and exclude credentials and URLs',()=>{
 const record=cacheRecord(entry());assert.equal(record.state.places.length,1);assert.doesNotMatch(JSON.stringify(record),/secret|key|never persisted/);assert.ok(record.bytes>0);
 assert.equal(cacheRecord({bbox:[],state:{places:[]}}),null);
});
test('disk cache is bounded by age, area count and bytes',()=>{
 const entries=Array.from({length:40},(_,i)=>entry(i));entries.push({...entry(90),updated:Date.now()-CACHE_MAX_AGE-1});
 const records=retainedRecords(entries);assert.equal(records.length,CACHE_MAX_AREAS);assert.ok(records.every(r=>r.bbox[0]!==90));assert.ok(records.reduce((n,r)=>n+r.bytes,0)<=CACHE_MAX_BYTES);
 const huge=entry();huge.state.places[0].title='x'.repeat(CACHE_MAX_BYTES+1);assert.equal(cacheRecord(huge),null);
});
test('pinned records survive expiration and ordinary eviction; retention is configurable',()=>{
 const now=Date.now();const old={...entry(90),updated:now-2*CACHE_MAX_AGE,pinned:true};
 const ordinary={...entry(91),updated:now-2*CACHE_MAX_AGE};
 assert.ok(retainedRecords([old],now).some(r=>r.pinned));
 assert.equal(retainedRecords([ordinary],now).length,0);assert.equal(retainedRecords([ordinary],now,{retentionDays:7}).length,1);
 assert.equal(retainedRecords([...Array.from({length:40},(_,i)=>entry(i)),old],now)[0].id,cacheRecord(old).id);
});
test('capacity cannot silently discard a pinned area',async()=>{
 const {CacheCapacityError}=await import('../src/areaCache.js');
 assert.throws(()=>retainedRecords(Array.from({length:33},(_,i)=>({...entry(i),pinned:true}))),CacheCapacityError);
 const pins=Array.from({length:32},(_,i)=>({...entry(i),pinned:true}));const keep=retainedRecords([...pins,entry(50)]);assert.equal(keep.length,32);assert.equal(keep.every(e=>e.pinned),true);
});
test('reported byte size includes the complete serialized stored record',()=>{
 const record=cacheRecord(entry());assert.equal(record.bytes,new TextEncoder().encode(JSON.stringify(record)).length);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {AreaLoader} from '../src/area.js';
const bbox=[2.29,48.85,2.30,48.86];
const place=id=>({id,name:`Place ${id}`,polygon:[{x:2.29,y:48.85},{x:2.30,y:48.85},{x:2.30,y:48.86}]});
test('pages merge by ID; repeated area uses cache; refresh bypasses it',async()=>{
 const pages=[];const loader=new AreaLoader(async opts=>{pages.push(opts.page);return{folder:opts.page===1?[place(1),place(2)]:[place(2),place(3)],found:3};});
 await loader.load(bbox);await loader.more();
 assert.deepEqual(loader.state.places.map(p=>p.id),[1,2,3]);assert.equal(loader.state.more,false);
 await loader.load(bbox);assert.deepEqual(pages,[1,2]);
 await loader.load(bbox,{force:true});assert.deepEqual(pages,[1,2,1]);
});
test('late response cannot replace a newer area',async()=>{
 let resolve;const loader=new AreaLoader(opts=>opts.bbox[0]===2.29?new Promise(r=>resolve=r):Promise.resolve({folder:[place(9)],found:1}));
 const old=loader.load(bbox);await loader.load([2.30,48.85,2.31,48.86]);resolve({folder:[place(1)],found:1});await old;
 assert.deepEqual(loader.state.places.map(p=>p.id),[9]);
});
test('second-page error retains first-page objects, page and retry',async()=>{
 let fail=true;const loader=new AreaLoader(async opts=>{if(opts.page===2&&fail)throw Error('offline');return{folder:[place(opts.page)],found:2};});
 await loader.load(bbox);await loader.more();assert.equal(loader.state.page,1);assert.equal(loader.state.places[0].id,1);assert.ok(loader.state.error);
 fail=false;await loader.more();assert.deepEqual(loader.state.places.map(p=>p.id),[1,2]);
});
test('stop cancels waiting and rejects updates even when transport ignores signal',async()=>{
 let resolve;const loader=new AreaLoader(()=>new Promise(r=>resolve=r));const job=loader.load(bbox);loader.stop();resolve({folder:[place(1)]});await job;assert.equal(loader.state.places.length,0);assert.equal(loader.state.loading,false);
});
test('manual retry does not replay an already handled error notification',async()=>{
 let fail=true,blocked=false;
 const loader=new AreaLoader(async()=>{if(fail)throw Error('network error');return{folder:[place(1)],found:1};},s=>{if(s.error)blocked=true;});
 await loader.load(bbox);assert.equal(blocked,true);
 fail=false;blocked=false;await loader.load(bbox,{force:true});assert.equal(blocked,false);
});
test('moving away disables pagination until the visible area is loaded',async()=>{
 let calls=0;const loader=new AreaLoader(async()=>{calls++;return{folder:[place(1)],found:100};});
 await loader.load(bbox);loader.invalidate();await loader.more();assert.equal(calls,1);assert.equal(loader.state.more,false);
 await loader.load(bbox);assert.equal(loader.state.more,true);
});
test('small pan inside cached coverage reuses contours immediately',async()=>{
 let calls=0;const loader=new AreaLoader(async()=>{calls++;return{folder:[place(1)],found:1};});
 await loader.load(bbox);
 await loader.load([2.291,48.851,2.299,48.859]);
 assert.equal(calls,1);assert.deepEqual(loader.state.places.map(p=>p.id),[1]);
});
test('overlapping contours remain visible while the next area is waiting',async()=>{
 let deliver;let calls=0;const loader=new AreaLoader(async()=>++calls===1?{folder:[place(1)],found:1}:new Promise(r=>deliver=r));
 await loader.load(bbox);const job=loader.load([2.295,48.85,2.305,48.86]);
 assert.deepEqual(loader.state.displayPlaces.map(p=>p.id),[1]);assert.equal(loader.state.loading,true);
 deliver({folder:[place(2)],found:1});await job;
 assert.deepEqual(loader.state.places.map(p=>p.id),[2]);assert.deepEqual(loader.state.displayPlaces.map(p=>p.id),[1,2]);
});
test('expired coverage is fetched again instead of claiming fresh cache',async()=>{
 const old=Date.now;let now=1000;Date.now=()=>now;let calls=0;
 try{const loader=new AreaLoader(async()=>{calls++;return{folder:[],found:0};});await loader.load(bbox);now+=300001;await loader.load(bbox);assert.equal(calls,2);}finally{Date.now=old;}
});
test('saved areas restore after a new loader, without a network call',async()=>{
 const disk=[];const store={read:async()=>disk,put:async entry=>{disk.push(entry);}};
 const first=new AreaLoader(async()=>({folder:[place(7)],found:1}),()=>{},store);await first.load(bbox);
 const second=new AreaLoader(async()=>{throw Error('must use disk cache');},()=>{},store);await second.load(bbox);
 assert.deepEqual(second.state.places.map(p=>p.id),[7]);assert.equal(second.state.error,'');
});
test('stale saved contours appear while a fresh request is pending',async()=>{
 let deliver;const entry={bbox,state:{places:[{id:7,title:'Cached',coords:[[48.85,2.29],[48.85,2.30],[48.86,2.30]]}],page:1,found:1,more:false},updated:Date.now()-300001};
 const loader=new AreaLoader(()=>new Promise(r=>deliver=r),()=>{},{read:async()=>[entry],put:async()=>{}});
 const job=loader.load(bbox);await new Promise(r=>setImmediate(r));assert.equal(loader.state.displayPlaces[0].id,7);assert.equal(loader.state.loading,true);
 deliver({folder:[place(8)],found:1});await job;assert.equal(loader.state.places[0].id,8);
});
test('disk failure falls back to the API',async()=>{
 const loader=new AreaLoader(async()=>({folder:[place(9)],found:1}),()=>{},{read:async()=>{throw Error('disk failed');},put:async()=>{throw Error('full');}});
 await loader.load(bbox);assert.equal(loader.state.places[0].id,9);assert.equal(loader.state.error,'');
});
test('hydrated overlapping records prefer the newest contour and page state',async()=>{
 const now=Date.now();const snapshot=(title,updated)=>({bbox,state:{places:[{id:7,title,coords:[[48.85,2.29],[48.85,2.30],[48.86,2.30]]}],page:1,found:1,more:false},updated});
 const old={...snapshot('Old',now-1000),bbox:[2.28,48.84,2.31,48.87]};const fresh=snapshot('Fresh',now);
 const loader=new AreaLoader(async()=>{throw Error('unexpected network');},()=>{},{read:async()=>[fresh,old],put:async()=>{}});await loader.load([2.292,48.852,2.298,48.858]);
 assert.equal(loader.state.places[0].title,'Fresh');assert.equal(loader.state.displayPlaces[0].title,'Fresh');
});
test('an area evicted from memory still uses the fresh on-device cache',async()=>{
 let calls=0;const disk=new Map();const store={read:async()=>[...disk.values()],put:async e=>disk.set(e.bbox.join(','),e)};
 const loader=new AreaLoader(async()=>({folder:[place(++calls)],found:1}),()=>{},store);
 for(let i=0;i<9;i++)await loader.load([2.29+i*.02,48.85,2.30+i*.02,48.86]);
 await loader.load(bbox);assert.equal(calls,9);assert.equal(loader.state.places[0].id,1);
});
test('fresh complete adjacent areas cover a combined viewport without another request',async()=>{
 let calls=0;const loader=new AreaLoader(async()=>({folder:[place(++calls)],found:1}));
 await loader.load([2.29,48.85,2.30,48.86]);await loader.load([2.30,48.85,2.31,48.86]);
 await loader.load([2.295,48.851,2.305,48.859]);assert.equal(calls,2);assert.deepEqual(loader.state.places.map(p=>p.id),[1,2]);assert.equal(loader.state.more,false);
});
test('partial cached pages do not falsely complete union coverage',async()=>{
 let calls=0;const loader=new AreaLoader(async()=>({folder:[place(++calls)],found:100}));
 await loader.load([2.29,48.85,2.30,48.86]);await loader.load([2.30,48.85,2.31,48.86]);await loader.load([2.295,48.851,2.305,48.859]);assert.equal(calls,3);assert.equal(loader.state.more,true);
});
test('existing contours make subsequent loading background work',async()=>{
 let deliver,calls=0;const loader=new AreaLoader(async()=>++calls===1?{folder:[place(1)],found:1}:new Promise(r=>deliver=r));
 await loader.load(bbox);const job=loader.load([2.295,48.85,2.305,48.86]);assert.equal(loader.state.background,true);loader.stop();assert.equal(loader.state.loading,false);deliver({folder:[],found:0});await job;
});
test('pinned and 7-day retained stale contours are shown while updating',async()=>{
 let deliver;const old={bbox,updated:Date.now()-2*86400000,retentionDays:7,pinned:true,state:{places:[{id:1,title:'Pinned',coords:[[48.85,2.29],[48.85,2.30],[48.86,2.30]]}],page:1,found:1,more:false}};
 const loader=new AreaLoader(()=>new Promise(r=>deliver=r),()=>{},{read:async()=>[old],put:async()=>{}});const job=loader.load(bbox);await new Promise(r=>setImmediate(r));assert.equal(loader.state.background,true);assert.equal(loader.state.displayPlaces[0].id,1);deliver({folder:[place(2)],found:1});await job;
});
test('a stalled page with known missing objects cannot complete combined coverage',async()=>{
 let calls=0;const loader=new AreaLoader(async opts=>{calls++;return opts.bbox[0]===2.29?{folder:opts.page===1?[place(1)]:[],found:100}:{folder:[place(2)],found:1};});
 await loader.load(bbox);await loader.more();await loader.load([2.30,48.85,2.31,48.86]);await loader.load([2.295,48.851,2.305,48.859]);assert.equal(calls,4);
});
test('complete union in memory avoids another disk transaction',async()=>{
 let reads=0;const loader=new AreaLoader(async()=>({folder:[place(1)],found:1}),()=>{},{read:async()=>{reads++;return[];},put:async()=>{}});
 await loader.load(bbox);await loader.load([2.30,48.85,2.31,48.86]);const before=reads;await loader.load([2.295,48.851,2.305,48.859]);assert.equal(reads,before);
});
test('one continuation action drains every remaining page',async()=>{
 const pages=[];const states=[];const loader=new AreaLoader(async({page})=>{pages.push(page);return{folder:[place(page)],found:6};},s=>states.push(s));
 await loader.load(bbox);await loader.more();await loader.more();await loader.remaining();
 assert.deepEqual(pages,[1,2,3,4,5,6]);assert.equal(loader.state.more,false);assert.equal(loader.state.draining,false);assert.ok(states.some(s=>s.draining&&s.page===4));
});
test('continuation stops at a repeated page without falsely marking completeness',async()=>{
 const pages=[];const loader=new AreaLoader(async({page})=>{pages.push(page);return{folder:[place(Math.min(page,2))],found:10};});
 await loader.load(bbox);await loader.remaining();assert.deepEqual(pages,[1,2,3]);assert.equal(loader.state.complete,false);assert.equal(loader.state.draining,false);
});
test('continuation stops on an error and one deliberate retry resumes the failed page',async()=>{
 const pages=[];let fail=true;const loader=new AreaLoader(async({page})=>{pages.push(page);if(page===3&&fail)throw Error('offline');return{folder:[place(page)],found:4};});
 await loader.load(bbox);await loader.remaining();assert.deepEqual(pages,[1,2,3]);assert.equal(loader.state.draining,false);assert.ok(loader.state.error);
 fail=false;await loader.remaining();assert.deepEqual(pages,[1,2,3,3,4]);assert.equal(loader.state.more,false);
});
test('moving to another area cancels continuation including late uncancellable responses',async()=>{
 let deliver;const calls=[];const loader=new AreaLoader(async({page,bbox:b})=>{calls.push([b[0],page]);return b[0]===2.29&&page===2?new Promise(r=>deliver=r):{folder:[place(b[0]===2.29?1:9)],found:b[0]===2.29?5:1};});
 await loader.load(bbox);const job=loader.remaining();await loader.load([2.30,48.85,2.31,48.86]);deliver({folder:[place(2)],found:5});await job;
 assert.deepEqual(calls,[[2.29,1],[2.29,2],[2.30,1]]);assert.equal(loader.state.draining,false);assert.equal(loader.state.places[0].id,9);
});
test('continuation has a finite request budget and can be deliberately resumed',async()=>{
 let calls=0;const loader=new AreaLoader(async({page})=>{calls++;return{folder:[place(page)],found:1000};});
 await loader.load(bbox);await loader.remaining();assert.equal(calls,21);assert.equal(loader.state.more,true);assert.equal(loader.state.batchLimited,true);await loader.remaining();assert.equal(calls,41);
});

test('failure kinds stay distinct and quota/auth errors require deliberate retry',async()=>{
 const errors=['HTTP 429','HTTP 401','Unexpected token < in JSON'];
 for(const [index, message] of errors.entries()){
  const loader=new AreaLoader(async()=>{throw new Error(message);});
  await loader.load(bbox);
  assert.equal(loader.state.failureKind,['quota','auth','schema'][index]);
  assert.equal(loader.state.retryable,false);
  assert.equal(loader.state.loading,false);
 }
 const network=new AreaLoader(async()=>{throw new Error('Failed to fetch');});
 await network.load(bbox);
 assert.equal(network.state.failureKind,'network');
 assert.equal(network.state.retryable,true);
});
test('site area explicit partial completeness survives fewer than 50 objects',async()=>{
 const loader=new AreaLoader(async()=>({folder:[place(1)],found:null,more:false,complete:false,source:'site'}));await loader.load(bbox);assert.equal(loader.state.complete,false);assert.equal(loader.state.source,'site');assert.equal(loader.state.more,false);
});
test('forced refresh forwards the force flag to the source adapter',async()=>{const flags=[];const loader=new AreaLoader(async o=>{flags.push(o.force);return{folder:[],found:0};});await loader.load(bbox);await loader.load(bbox,{force:true});assert.deepEqual(flags,[false,true]);});

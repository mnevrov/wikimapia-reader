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

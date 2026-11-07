import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acquirePosition} from '../src/locationRequest.js';

const sample={coords:{latitude:55.75,longitude:37.62,accuracy:20}};

test('one-shot location shares working watch path and clears watcher',async()=>{
 let listener,cleared=[];
 const geo={watchPosition:async(_opts,cb)=>{listener=cb;return 'watch-a';},
  clearWatch:async({id})=>{cleared.push(id);}};
 const promise=acquirePosition(geo);
 await new Promise(resolve=>setImmediate(resolve));
 listener(sample);
 assert.deepEqual(await promise,sample);
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(cleared,['watch-a']);
});

test('temporary errors and inaccurate fixes do not hide a later valid location',async()=>{
 let listener,cleared=0;
 const geo={watchPosition:async(_opts,cb)=>{listener=cb;return 'watch-b';},
  clearWatch:async()=>{cleared++;}};
 const promise=acquirePosition(geo);
 await new Promise(resolve=>setImmediate(resolve));
 listener(null,{code:3,message:'temporary timeout'});
 listener({coords:{latitude:55.75,longitude:37.62,accuracy:400}});
 listener(sample);
 assert.deepEqual(await promise,sample);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(cleared,1);
});

test('permission denial is terminal and releases the temporary watcher',async()=>{
 let listener,cleared=[];
 const geo={watchPosition:async(_opts,cb)=>{listener=cb;return 'watch-c';},
  clearWatch:async({id})=>{cleared.push(id);}};
 const promise=acquirePosition(geo);
 await new Promise(resolve=>setImmediate(resolve));
 listener(null,{code:1,message:'Permission denied'});
 await assert.rejects(promise,/Permission denied/);
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(cleared,['watch-c']);
});

test('cancel before acquiring a fix aborts the native watcher',async()=>{
 let watchStarted=false,cleared=[];
 const controller=new AbortController();
 const geo={watchPosition:async()=>{watchStarted=true;return 'watch-d';},
  clearWatch:async({id})=>{cleared.push(id);}};
 const promise=acquirePosition(geo,{signal:controller.signal});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(watchStarted,true);
 controller.abort();
 await assert.rejects(promise,{name:'AbortError'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(cleared,['watch-d']);
});

test('late watcher ID is cleaned up after an early valid callback',async()=>{
 let finishId,cleared=[];
 const geo={watchPosition:(_opts,cb)=>{cb(sample);return new Promise(resolve=>{finishId=resolve;});},
  clearWatch:async({id})=>{cleared.push(id);}};
 const promise=acquirePosition(geo);
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(await promise,sample);
 finishId('watch-e');
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(cleared,['watch-e']);
});

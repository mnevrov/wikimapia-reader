import test from 'node:test';
import assert from 'node:assert/strict';
import {wikimapiaCall} from '../src/client.js';
test('area followed by detail waits for rate slot instead of rejecting normal tap',async()=>{
 const original=global.fetch;let calls=[];
 global.fetch=async url=>{calls.push({url,time:Date.now()});return {ok:true,json:async()=>url.includes('getbyarea')?{places:[]}:{id:55,title:'Test'}};};
 try {
  await wikimapiaCall('place.getbyarea','test-key',{bbox:[37.61,55.75,37.62,55.76]});
  const r=await wikimapiaCall('place.getbyid','test-key',{id:55});
  assert.equal(r.id,55);assert.equal(calls.length,2);assert.ok(calls[1].time-calls[0].time>=5900);
  const controller=new AbortController();
  const pending=wikimapiaCall('place.getbyid','test-key',{id:55,signal:controller.signal});
  controller.abort();await assert.rejects(pending,/abort/i);assert.equal(calls.length,2);
  await wikimapiaCall('place.getbyid','test-key',{id:55});
  assert.ok(calls[2].time-calls[1].time<7000,'cancelled request must not reserve an extra slot');
 } finally {global.fetch=original;}
});

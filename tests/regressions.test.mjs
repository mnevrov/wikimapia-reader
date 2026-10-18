import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as api from '../src/api.js';
const {normalizePlace,geometryOf,diagnosticError}=api;
const validateResponse=(...args)=>api.validateResponse(...args);

test('actual API debug error must not become an empty successful response',()=>{
 assert.throws(()=>validateResponse({debug:{code:1000,message:'Invalid key'}},'place.getbyid',55),/ключ/i);
 assert.throws(()=>validateResponse({debug:{message:'You have reached the limit for this action. You need to wait for 5 seconds.'}},'place.getbyarea'),/лимит/i);
});
test('bare empty array is ambiguous, not a verified area result',()=>{
 assert.throws(()=>validateResponse([],'place.getbyarea'),/структур/i);
 assert.deepEqual(validateResponse({places:[]},'place.getbyarea'),{places:[]});
});
test('detail id mismatch and malformed payload fail closed',()=>{
 for(const d of [null,{},'<html>',{id:56,title:'Other'}]) assert.throws(()=>validateResponse(d,'place.getbyid',55));
});
test('live object 55 projection includes actual photo field names and geometry',()=>{
 const raw=JSON.parse(fs.readFileSync(new URL('./fixtures/place-55.projection.json',import.meta.url)));
 const p=normalizePlace(raw);
 assert.equal(p.id,55);assert.equal(p.title,'Eiffel Tower');assert.ok(p.description.length>100);
 assert.equal(p.photos.length,1);assert.match(p.photos[0].src,/^https:\/\/photos.wikimapia.org\//);
 assert.ok(geometryOf(raw).length>=3);
});
test('null and blank coordinates must not turn into Null Island',()=>{
 assert.deepEqual(geometryOf({polygon:[{x:null,y:null},['',''],[null,null]]}),[]);
});
test('error diagnostics never expose a credential-bearing URL',()=>{
 const e=diagnosticError(new Error('Failed https://api.wikimapia.org/?key=SECRET123&function=x'));
 assert.ok(!e.includes('SECRET123'));assert.ok(!e.includes('https://'));
});
test('documented legacy box supports actual folder/name schema',()=>{
 const raw=JSON.parse(fs.readFileSync(new URL('./fixtures/box-moscow.projection.json',import.meta.url)));
 const url=new URL(api.buildRequest('box','example',{bbox:[37.616,55.751,37.625,55.756]}));
 assert.equal(url.searchParams.get('function'),'box');
 assert.equal(api.validateResponse(raw,'box'),raw);
 const places=api.normalizeArea(raw);
 assert.equal(places.length,5);assert.equal(places[0].title,'Земляной город');
 assert.ok(places.every(p=>p.coords.length>=3));
});
test('actual comment schema: display name/message, omit deleted entries and IP',()=>{
 const p=normalizePlace({id:55,title:'Test',comments:[{name:'Синтетический автор',message:'Тест',user_ip:'192.0.2.1',is_deleted:false},{name:'A',message:'Удалено',is_deleted:true}]});
 assert.equal(p.comments.length,1);assert.equal(p.comments[0].author,'Синтетический автор');
 assert.equal(p.comments[0].text,'Тест');assert.ok(!JSON.stringify(p.comments).includes('192.0.2.1'));
});
test('transport URLs with validation-like query text never reveal keys',()=>{
 for(const query of ['масштаб','координаты','Введите запрос','личный ключ']){
  const value=diagnosticError(new Error(`https://api.wikimapia.org/?key=SECRET999&q=${query}`));
  assert.ok(!value.includes('SECRET999'));assert.ok(!value.includes('https://'));
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {yandexEnablement,createYandexApiLoader,YANDEX_JS_API_URL,YANDEX_KEY_PATTERN} from '../src/yandexUsage.js';

const key='00000000-1111-4222-8333-444444444444';
const enabled={selected:true,key,refererConfigured:true,publiclyAccessible:true};

test('Yandex is strictly opt-in, even with a valid key',()=>{
 assert.deepEqual(yandexEnablement({key,refererConfigured:true,publiclyAccessible:true}),{allowed:false,reason:'not-selected'});
 assert.equal(yandexEnablement({selected:true,key,publiclyAccessible:true}).reason,'referer-not-confirmed');
 assert.equal(yandexEnablement({selected:true,key,refererConfigured:true}).reason,'license-not-confirmed');
 assert.equal(yandexEnablement({...enabled,key:'not-a-key'}).reason,'missing-or-invalid-key');
 assert.equal(yandexEnablement(enabled).allowed,true);
 assert.match(YANDEX_JS_API_URL,/^https:\/\/api-maps\.yandex\.ru\/v3\/$/);
 assert.equal(YANDEX_KEY_PATTERN.test(key),true);
});
test('disallowed requests never load the SDK',async()=>{
 let calls=0;
 const load=createYandexApiLoader(async()=>{calls++;return {};});
 for(const input of [{},{key},{selected:true,key},{selected:true,key,refererConfigured:true}]){
  assert.equal((await load(input)).active,false);
 }
 assert.equal(calls,0);
});
test('one network initialization across concurrent requests and repeated panels',async()=>{
 let calls=0;
 const loader=createYandexApiLoader(async()=>{calls++;return {name:'mock'};});
 const [a,b,c]=await Promise.all([loader(enabled),loader(enabled),loader(enabled)]);
 assert.equal(calls,1);
 assert.equal(a.active,true);assert.equal(a.api,b.api);assert.equal(b.api,c.api);
 assert.equal((await loader(enabled)).active,true);
 assert.equal(calls,1);
});
test('cooldown avoids retry storms after network failure',async()=>{
 let calls=0,clock=1000;
 const loader=createYandexApiLoader(async()=>{calls++;throw Error('network');},{now:()=>clock,retryDelayMs:60_000});
 assert.equal((await loader(enabled)).reason,'sdk-unavailable');
 assert.equal((await loader(enabled)).reason,'retry-cooldown');
 assert.equal(calls,1);
 clock+=60_000;
 assert.equal((await loader(enabled)).reason,'sdk-unavailable');
 assert.equal(calls,2);
});
test('key cannot change inside a running WebView instance',async()=>{
 const loader=createYandexApiLoader(async()=>({id:'mock'}));
 assert.equal((await loader(enabled)).active,true);
 assert.equal((await loader({...enabled,key:'ffffffff-ffff-4fff-8fff-ffffffffffff'})).reason,'reload-required');
});

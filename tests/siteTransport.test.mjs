import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../src/siteTransport.js').catch(()=>({}));
test('site transport only accepts its own HTTPS read routes without credentials',async()=>{
 const {siteUrl}=await load();assert.equal(typeof siteUrl,'function');
 assert.equal(siteUrl('https://wikimapia.org/350/ru/'),'https://wikimapia.org/350/ru/');
 for(const url of ['http://wikimapia.org/350/','https://evil.test/350/','https://u:p@wikimapia.org/350/','https://wikimapia.org/object/edit/','https://wikimapia.org/350/?key=secret','https://wikimapia.org:444/350/'])assert.throws(()=>siteUrl(url));
});
test('text requests reject HTTP errors, oversized responses and aborted results',async()=>{
 const {createSiteTransport}=await load();assert.equal(typeof createSiteTransport,'function');
 for(const response of [{status:429,text:''},{status:200,text:'a'.repeat(4194305)}]){
  const get=createSiteTransport(async()=>response);await assert.rejects(()=>get({url:'https://wikimapia.org/350/ru/'}));
 }
 let resolve;const get=createSiteTransport(()=>new Promise(r=>resolve=r));const c=new AbortController();const job=get({url:'https://wikimapia.org/350/ru/',signal:c.signal});c.abort();resolve({status:200,text:'ok'});await assert.rejects(job,{name:'AbortError'});
});
test('read-only search uses bounded POST body and strips secrets from failures',async()=>{
 const {createSiteTransport}=await load();assert.equal(typeof createSiteTransport,'function');
 const get=createSiteTransport(async()=>{throw Error('secret-cookie https://x/?key=private');});
 await assert.rejects(()=>get({url:'https://wikimapia.org/search/?q=park',body:'qu=park&x=1&y=1&z=16&jtype=simple&start=0&try=0'}),e=>!e.message.includes('private')&&!e.message.includes('cookie'));
});

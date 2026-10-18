import test from 'node:test';
import assert from 'node:assert/strict';
import {createCredentialStore} from '../src/credentials.js';
test('native vault restore save delete; no web persistence fallback',async()=>{
 let value='previous-key';const native={load:async()=>({key:value}),save:async({key})=>{value=key;},clear:async()=>{value=null;}};
 const s=createCredentialStore(native);assert.equal(await s.load(),'previous-key');assert.equal(await s.save(' new-key '),true);assert.equal(value,'new-key');await s.clear();assert.equal(await s.load(),null);
 const web=createCredentialStore(null);assert.equal(await web.load(),null);assert.equal(await web.save('memory-key'),false);
});
test('storage errors propagate without silently claiming persistence',async()=>{
 const s=createCredentialStore({load:async()=>{throw Error('locked');},save:async()=>{throw Error('full');},clear:async()=>{throw Error('locked');}});
 await assert.rejects(s.load());await assert.rejects(s.save('key'));await assert.rejects(s.clear());
});

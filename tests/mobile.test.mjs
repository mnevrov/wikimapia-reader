import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRequest,normalizePlace} from '../src/api.js';

test('area page argument is validated and passed to API',()=>{
 const opts={bbox:[2.29,48.85,2.30,48.86],page:3};
 assert.equal(new URL(buildRequest('box','test',opts)).searchParams.get('page'),'3');
 for(const page of [0,-1,1.5,'bad'])assert.throws(()=>buildRequest('box','test',{...opts,page}));
});
test('actual comment date is Unix seconds, missing/invalid date is not invented',()=>{
 const comments=[{name:'A',message:'text',date:1163698281},{message:'missing'},{message:'bad',date:'yesterday'},{message:'zero',date:0}];
 const result=normalizePlace({id:55,title:'Test',comments}).comments;
 assert.equal(result[0].date,'2006-11-16T17:31:21.000Z');
 assert.deepEqual(result.slice(1).map(x=>x.date),[null,null,null]);
});
test('documented search carries query and location and validates response',async()=>{
 const {validateResponse}=await import('../src/api.js');
 const u=new URL(buildRequest('search','test',{query:' Эйфелева башня ',lat:48.858,lon:2.294}));
 assert.equal(u.searchParams.get('q'),'Эйфелева башня');assert.equal(u.searchParams.get('lat'),'48.858');assert.equal(u.searchParams.get('lon'),'2.294');
 assert.deepEqual(validateResponse({folder:[],found:0},'search'),{folder:[],found:0});
 assert.throws(()=>buildRequest('search','test',{query:'x',lat:100,lon:0}));
});

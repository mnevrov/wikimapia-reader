import test from 'node:test';
import assert from 'node:assert/strict';
import {safeAreaResponseSummary,contentCategory} from '../src/transportResponseSummary.js';

const poly=[{x:37.617,y:55.751},{x:37.619,y:55.751},{x:37.619,y:55.753}];
const valid={folder:[{id:77,title:'Example',polygon:poly}],found:1};
test('valid box data returns only counts and a safe allowlisted reason',()=>{
 const result=safeAreaResponseSummary({status:200,data:valid,headers:{'Content-Type':'application/json; charset=utf-8'}});
 assert.deepEqual(result,{httpStatus:200,contentCategory:'json',outcome:'ok',reason:'valid_folder',objects:1,polygons:1});
 assert.equal(safeAreaResponseSummary({status:200,data:{folder:[]}}).outcome,'ok');
});
test('HTTP 200 HTML, unparseable text, array root and missing folder are distinguishable',()=>{
 assert.deepEqual(safeAreaResponseSummary({status:200,data:'<html>not an API response</html>',headers:{'content-type':'text/html'}}),{
   httpStatus:200,contentCategory:'html',outcome:'schema_error',reason:'invalid_json',objects:null,polygons:null
 });
 assert.equal(safeAreaResponseSummary({status:200,data:[]}).reason,'array_root');
 assert.equal(safeAreaResponseSummary({status:200,data:{places:[]}}).reason,'missing_folder');
});
test('server-reported auth, quota and unknown rejection never return raw text',()=>{
 const secret='SUPER_SECRET_KEY';
 const examples=[
   [{debug:{code:1000,message:'key rejected '+secret}},'auth'],
   [{error:'quota limit reached '+secret},'quota'],
   [{error:'Unexpected '+secret},'api_error']
 ];
 for(const [payload,reason] of examples){
   const result=safeAreaResponseSummary({status:200,data:payload});
   assert.equal(result.outcome,'api_rejection');
   assert.equal(result.reason,reason);
   assert.doesNotMatch(JSON.stringify(result),new RegExp(secret));
 }
});
test('content categorization rejects raw HTTP headers and response bodies',()=>{
 assert.equal(contentCategory(new Headers({'Content-Type':'application/problem+json'})),'json');
 assert.equal(contentCategory({'CONTENT-TYPE':'text/plain; charset=utf-8'}),'text');
 assert.equal(contentCategory({'X-API-Key':'do not include this'}),'unknown');
 assert.deepEqual(safeAreaResponseSummary({status:403,data:'private-key'}),{
   httpStatus:403,contentCategory:'unknown',outcome:'http_error',reason:'http_non_200',objects:null,polygons:null
 });
});

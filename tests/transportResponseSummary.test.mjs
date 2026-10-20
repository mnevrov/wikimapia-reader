import test from 'node:test';
import assert from 'node:assert/strict';
import {safeAreaResponseSummary,contentCategory,safeApiCode} from '../src/transportResponseSummary.js';

const poly=[{x:37.617,y:55.751},{x:37.619,y:55.751},{x:37.619,y:55.753}];
const valid={folder:[{id:77,title:'Example',polygon:poly}],found:1};
test('valid box data returns only counts and a safe allowlisted reason',()=>{
 const result=safeAreaResponseSummary({status:200,data:valid,headers:{'Content-Type':'application/json; charset=utf-8'}});
 assert.deepEqual(result,{httpStatus:200,contentCategory:'json',outcome:'ok',reason:'valid_folder',apiCode:null,objects:1,polygons:1});
 assert.equal(safeAreaResponseSummary({status:200,data:{folder:[]}}).outcome,'ok');
});
test('HTTP 200 HTML, unparseable text, array root and missing folder are distinguishable',()=>{
 assert.deepEqual(safeAreaResponseSummary({status:200,data:'<html>not an API response</html>',headers:{'content-type':'text/html'}}),{
   httpStatus:200,contentCategory:'html',outcome:'schema_error',reason:'invalid_json',apiCode:null,objects:null,polygons:null
 });
 assert.equal(safeAreaResponseSummary({status:200,data:[]}).reason,'array_root');
 assert.equal(safeAreaResponseSummary({status:200,data:{places:[]}}).reason,'missing_folder');
});
test('server-reported auth, quota and unknown rejection never return raw text',()=>{
 const secret='SENSITIVE_TOKEN_9XY3';
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
   httpStatus:403,contentCategory:'unknown',outcome:'http_error',reason:'http_non_200',apiCode:null,objects:null,polygons:null
 });
});

test('only exact known numeric code 1004 is exported; no raw debug data leaks',()=>{
 const secret='PRIVATE_DATA_DO_NOT_COPY';
 const known=[
   {debug:{code:1004,message:'Key limit has been reached '+secret,trace:secret}},
   {debug:{code:'1004',message:secret}},
 ];
 for(const data of known){
   const result=safeAreaResponseSummary({status:200,data});
   assert.equal(result.httpStatus,200);
   assert.equal(result.outcome,'api_rejection');
   assert.equal(result.reason,'quota');
   assert.equal(result.apiCode,1004);
   assert.equal(result.objects,null);
   assert.doesNotMatch(JSON.stringify(result),new RegExp(secret));
 }
 assert.equal(safeApiCode({debug:{code:1004}}),1004);
 assert.equal(safeApiCode({debug:{code:'1004'}}),1004);
});
test('unknown/malformed API codes never expose IDs, fake codes or secrets',()=>{
 const samples=[
   {debug:{code:1000,message:'auth issue'}},
   {debug:{code:1005,message:'wait '+ 'PRIVATE_TOKEN'}},
   {debug:{code:'1004SECRET',message:'some error'}},
   {debug:{code:99999999999999,message:'raw opaque error'}},
   {debug:{code:'00001004',message:'raw opaque error'}},
   {debug:{code:{unexpected:'secret'},message:'raw opaque error'}},
   {debug:{code:['1004'],message:'raw opaque error'}},
   {error:'quota token PRIVATE_TOKEN'},
   {error_message:'quota token PRIVATE_TOKEN'}
 ];
 for(const data of samples){
   const result=safeAreaResponseSummary({status:200,data});
   assert.equal(result.apiCode,null);
   assert.equal(result.outcome,'api_rejection');
   assert.equal(result.objects,null);
   const report=JSON.stringify(result);
   assert.doesNotMatch(report,/PRIVATE_TOKEN|PRIVATE_DATA|SECRET|99999999999999|raw opaque error/);
 }
 assert.equal(safeApiCode(null),null);
 assert.equal(safeApiCode([]),null);
 assert.equal(safeApiCode({debug:'1004'}),null);
});
test('HTTP errors and JSON parsing failures do not export arbitrary error values',()=>{
 const report=safeAreaResponseSummary({status:200,data:'{"debug": { "code": "1004-SENSITIVE" }}'});
 assert.equal(report.apiCode,null);
 assert.equal(report.reason,'api_error');
 const http=safeAreaResponseSummary({status:429,data:{debug:{code:1004,message:'secret'}}});
 assert.equal(http.apiCode,null);
 assert.equal(http.reason,'http_non_200');
});

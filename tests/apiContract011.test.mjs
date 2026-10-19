import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateResponse,normalizeArea,classifyApiFailure,ApiError} from '../src/api.js';
import {recordApiMetric,recordCoverage,diagnosticSnapshot,clearDiagnostics} from '../src/apiDiagnostics.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/api-contract-011.json', import.meta.url),'utf8'));
test('documented area methods are accepted only with verified object envelopes',()=>{
 assert.equal(normalizeArea(validateResponse(fixture.box,'box')).length,1);
 assert.equal(normalizeArea(validateResponse(fixture.byarea,'place.getbyarea')).length,1);
 assert.throws(()=>validateResponse(fixture.ambiguous,'place.getbyarea'),ApiError);
 assert.throws(()=>validateResponse(fixture.mismatched,'place.getbyarea'),ApiError);
});
test('HTTP 200 Wikimapia API error structures classify by code and message',()=>{
 for(const [payload,expected] of [[fixture.invalidKey,'auth'],[fixture.quota,'quota']]){
  assert.throws(()=>validateResponse(payload,'box'),err=>classifyApiFailure(err)===expected);
 }
 assert.equal(classifyApiFailure(new DOMException('Aborted','AbortError')),'cancelled');
 assert.equal(classifyApiFailure(new Error('Server timeout')),'timeout');
});
test('memory-only diagnostics emit only fixed method/category keys and numeric aggregates',()=>{
 clearDiagnostics();
 recordApiMetric('box',123,null);
 recordApiMetric('box',500,'quota');
 recordApiMetric('place.getbyid',15,'network');
 recordApiMetric('https://host/?key=private',10,'auth');
 recordApiMetric('box',20,'cancelled');
 recordCoverage(5,10,false);
 recordCoverage(5,5,true);
 const report=diagnosticSnapshot();
 assert.equal(report.requests.box.total,2);
 assert.equal(report.requests.box.success,1);
 assert.equal(report.requests.box.failures.quota,1);
 assert.equal(report.requests['place.getbyid'].failures.network,1);
 assert.deepEqual(report.coverage,{complete:1,partial:1,unknown:0});
 assert.ok(!JSON.stringify(report).includes('private'));
 assert.ok(!JSON.stringify(report).includes('https:'));
 assert.equal(Object.keys(report.requests).length,4);
 clearDiagnostics();
 assert.equal(diagnosticSnapshot().requests.box.total,0);
});

test('unrecognized API error code is not treated like transient network failure',()=>{
 try {validateResponse({debug:{code:4050,message:'Access policy'}},'box');assert.fail('expected');
 }catch(e){assert.equal(classifyApiFailure(e),'api');}
});

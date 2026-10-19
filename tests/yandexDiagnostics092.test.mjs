import test from 'node:test';
import assert from 'node:assert/strict';
import {YandexSdkError,createYandexApiLoader} from '../src/yandexUsage.js';
import {yandexErrorInfo,yandexDiagnosticReport} from '../src/yandexDiagnosis.js';

const config={selected:true,key:'00000000-1111-4222-8333-444444444444',refererConfigured:true,publiclyAccessible:true};

test('SDK error codes survive loader without exposing raw error details',async()=>{
 const load=createYandexApiLoader(async()=>{throw new YandexSdkError('script-load-error');});
 const error=await load(config);
 assert.equal(error.active,false);
 assert.equal(error.reason,'sdk-unavailable');
 assert.equal(error.failureCode,'script-load-error');
 const info=yandexErrorInfo(error.failureCode,{origin:'https://localhost',online:true});
 const report=yandexDiagnosticReport(info);
 assert.match(report,/script-load-error/);
 assert.match(report,/https:\/\/localhost/);
 assert.doesNotMatch(report,/00000000-1111-4222-8333-444444444444/);
});

test('throttled repeat shows both cooldown and original cause without networking',async()=>{
 let attempts=0,clock=1_000;
 const request=createYandexApiLoader(async()=>{attempts++;throw new YandexSdkError('script-timeout');},{now:()=>clock});
 await request(config);
 const repeat=await request(config);
 assert.equal(repeat.reason,'retry-cooldown');
 assert.equal(repeat.failureCode,'script-timeout');
 assert.equal(repeat.retrySeconds,60);
 assert.equal(attempts,1);
 clock+=60_000;
 const next=await request(config);
 assert.equal(next.failureCode,'script-timeout');
 assert.equal(attempts,2);
});

test('raw exception that may contain API key is never passed to report',async()=>{
 const request=createYandexApiLoader(async()=>{throw new Error('https://api-maps.yandex.ru/v3/?apikey='+config.key)});
 const result=await request(config);
 assert.equal(result.failureCode,'sdk-unavailable');
 const report=yandexDiagnosticReport(yandexErrorInfo(result.failureCode,{origin:'https://localhost'}));
 assert.doesNotMatch(report,/apikey|00000000/i);
});
test('report only contains allowlisted diagnostic fields',()=>{
 const report=yandexDiagnosticReport(yandexErrorInfo('sdk-map-error',{origin:'https://localhost',previous:'script-load-error'}));
 assert.match(report,/sdk-map-error/);
 assert.match(report,/script-load-error/);
 assert.doesNotMatch(report,/api-maps.yandex.ru/);
 assert.equal(yandexErrorInfo('arbitrary injected error',{origin:'https://localhost'}).code,'sdk-unavailable');
});

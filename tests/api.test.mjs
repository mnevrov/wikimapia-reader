import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRequest, geometryOf, normalizeArea, normalizePlace, safeUrl, diagnosticError, wikimapiaUrl} from '../src/api.js';

test('area request builds documented method and bounded bbox',()=>{
 const u=new URL(buildRequest('place.getbyarea','sample-key',{bbox:[37.61,55.75,37.62,55.76]}));
 assert.equal(u.protocol,'https:');
 assert.equal(u.searchParams.get('function'),'place.getbyarea');
 assert.equal(u.searchParams.get('format'),'json');
 assert.equal(u.searchParams.get('language'),'ru');
 assert.equal(u.searchParams.get('bbox'),'37.61,55.75,37.62,55.76');
 assert.equal(u.searchParams.get('count'),'50');
});
test('reject invalid area and missing key',()=>{
 assert.throws(()=>buildRequest('place.getbyarea','',{bbox:[37,55,38,56]}),/ключ/);
 assert.throws(()=>buildRequest('place.getbyarea','x',{bbox:[37,55,38,56]}),/масштаб/);
 assert.throws(()=>buildRequest('place.getbyarea','x',{bbox:[37,55,36,56]}),/координаты/);
});
test('getbyid request uses selected id and requested detail blocks',()=>{
 const url=new URL(buildRequest('place.getbyid','x',{id:55}));
 assert.equal(url.searchParams.get('id'),'55');
 assert.match(url.searchParams.get('data_blocks'),/comments/);
 assert.throws(()=>buildRequest('place.getbyid','x',{id:'42noname'}),/ID/);
});
test('normalizes a plausible API area response (synthetic fixture)',()=>{
 const items=normalizeArea({places:[{id:42,title:'Тестовый объект',polygon:[{x:37.617,y:55.752},{x:37.618,y:55.752},{x:37.618,y:55.753}]}]});
 assert.equal(items.length,1);
 assert.equal(items[0].coords.length,3);
 assert.deepEqual(items[0].coords[0],[55.752,37.617]);
});
test('normalizes GeoJSON polygon if present',()=>{
 assert.deepEqual(geometryOf({geometry:{coordinates:[[[37.6,55.7],[37.7,55.8],[37.8,55.9]]]} }),[[55.7,37.6],[55.8,37.7],[55.9,37.8]]);
});
test('description rendered as text and rejects scripting/image schemes',()=>{
 const item=normalizePlace({id:12,main:{title:'<img src=x onerror=alert(1)>',description:'<script>evil()</script>',url:'javascript:alert(1)'},photos:{photo:[{url_big:'javascript:alert(1)'},{url_thumb:'https://example.org/img.jpg'}]},comments:{comment:[{author_name:'A',text:'тест'}]}});
 assert.equal(item.description,'<script>evil()</script>');
 assert.equal(item.photos.length,1);
 assert.equal(item.comments.length,1);
 assert.equal(item.url,wikimapiaUrl(12));
 assert.equal(safeUrl('data:text/html;base64,abc'),null);
});
test('formats useful DNS and quota failures',()=>{
 assert.match(diagnosticError(new Error('Failed to fetch')),/DNS/);
 assert.match(diagnosticError(new Error('HTTP 429')),/лимит/);
});

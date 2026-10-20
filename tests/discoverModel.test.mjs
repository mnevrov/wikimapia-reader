import test from 'node:test';
import assert from 'node:assert/strict';
import {polygonCenter,distanceMeters,polygonAreaMeters,discoverPlaces,distanceLabel} from '../src/discoverModel.js';
const a={id:2,title:'Библиотека',coords:[[55.75,37.61],[55.75,37.62],[55.76,37.62],[55.76,37.61]]};
const b={id:1,title:'Арка',coords:[[55.751,37.613],[55.751,37.614],[55.752,37.614],[55.752,37.613]]};
test('valid polygon center, area and distance are computed without API',()=>{
 const center=polygonCenter(a);
 assert.ok(Math.abs(center.lat-55.755)<1e-9);
 assert.ok(Math.abs(center.lng-37.615)<1e-9);
 assert.ok(polygonAreaMeters(a)>polygonAreaMeters(b));
 assert.equal(distanceMeters({lat:55,lng:37},{lat:55,lng:37}),0);
 assert.ok(distanceMeters({lat:55.7515,lng:37.6135},polygonCenter(b))<100);
});
test('sorting is stable by title, area, then GPS center distance',()=>{
 assert.deepEqual(discoverPlaces([a,b]).map(x=>x.id),[1,2]);
 assert.deepEqual(discoverPlaces([a,b],{sort:'area'}).map(x=>x.id),[2,1]);
 assert.deepEqual(discoverPlaces([a,b],{sort:'distance',location:{lat:55.7515,lng:37.6135}}).map(x=>x.id),[1,2]);
 assert.deepEqual(discoverPlaces([a,b],{sort:'distance'}).map(x=>x.id),[1,2]);
});
test('offline and favorites filters do not change original array',()=>{
 const all=[a,b],favorites=[{id:2,source:'wikimapia'},{id:1,source:'demo'}];
 assert.deepEqual(discoverPlaces(all,{filter:'favorite',favorites}).map(x=>x.id),[2]);
 assert.deepEqual(discoverPlaces(all,{filter:'offline',offline:[{id:1}]}).map(x=>x.id),[1]);
 assert.deepEqual(discoverPlaces(all,{text:'АРК'}).map(x=>x.id),[1]);
 assert.deepEqual(discoverPlaces(all,{text:'2'}).map(x=>x.id),[2]);
 assert.deepEqual(all,[a,b]);
});
test('invalid location/polygon do not cause NaN or leaks',()=>{
 assert.equal(distanceMeters(null,{lat:0,lng:0}),null);
 assert.equal(polygonCenter({coords:[]}),null);
 assert.equal(polygonAreaMeters({coords:[[1,2]]}),0);
 assert.equal(distanceLabel(null),'');
 assert.ok(distanceLabel(1900).includes('1.9'));
});

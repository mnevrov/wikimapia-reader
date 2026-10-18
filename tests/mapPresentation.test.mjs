import test from 'node:test';
import assert from 'node:assert/strict';
import {polygonBounds,inMapView,visibleInMap,contourStyle,validDensity} from '../src/mapPresentation.js';

const square={id:101,coords:[[55.75,37.61],[55.76,37.61],[55.76,37.62],[55.75,37.62]]};
test('bounds preserve lat/lon orientation',()=>{
 assert.deepEqual(polygonBounds(square.coords),[37.61,55.75,37.62,55.76]);
});
test('visible map includes boundary intersections and polygons containing viewport',()=>{
 assert.equal(inMapView(square,[37.62,55.754,37.625,55.758]),true);
 assert.equal(inMapView(square,[37.612,55.752,37.618,55.758]),true);
 assert.equal(inMapView(square,[38,55.752,38.01,55.758]),false);
});
test('invalid polygons never appear in the visible list',()=>{
 assert.equal(polygonBounds([[55,37],[56,38]]),null);
 assert.equal(polygonBounds([[55,37],[Number.NaN,38],[56,38]]),null);
 assert.deepEqual(visibleInMap([square,{id:2,coords:[]}],[37.61,55.75,37.62,55.76]).map(x=>x.id),[101]);
});
test('auto mode reduces visual weight in dense areas without hiding objects',()=>{
 const light=contourStyle('auto',12,17),dense=contourStyle('auto',250,17);
 assert.equal(light.opacity,.95);
 assert.equal(dense.opacity,.55);
 assert.equal(dense.fill,false);
});
test('detailed view overrides density while calm mode stays subdued',()=>{
 assert.equal(contourStyle('detailed',400,12).opacity,.95);
 assert.equal(contourStyle('calm',3,19).opacity,.55);
});
test('selected outlines always remain high contrast and filled',()=>{
 const selected=contourStyle('calm',250,12,true);
 assert.equal(selected.opacity,1);assert.equal(selected.fill,true);assert.equal(selected.weight,3);
});
test('unknown persisted density settings fail safely',()=>{
 assert.equal(validDensity('any'),'auto');assert.equal(validDensity(null),'auto');
 assert.equal(validDensity('detailed'),'detailed');
});

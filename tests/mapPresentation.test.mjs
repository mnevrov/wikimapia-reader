import test from 'node:test';
import assert from 'node:assert/strict';
import {polygonBounds,inMapView,visibleInMap,contourStyle,validDensity,stableContourPlaces} from '../src/mapPresentation.js';

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

test('cold or restarted loader cannot flash already validated contours',()=>{
 const old=[square];
 const reset={places:[],displayPlaces:[],page:0,loading:false,error:''};
 const pending={...reset,loading:true};
 assert.equal(stableContourPlaces(old,reset),old);
 assert.equal(stableContourPlaces(old,pending),old);
 // No unnecessary polygon reconciliation/render when transient payload is empty.
 assert.deepEqual(visibleInMap(stableContourPlaces(old,pending),[37.61,55.75,37.62,55.76]),old);
});
test('a new valid response swaps contours atomically while confirmed empty area clears them',()=>{
 const old=[square],fresh=[{...square,id:202}];
 assert.equal(stableContourPlaces(old,{page:0,loading:true,displayPlaces:fresh}),fresh);
 assert.equal(stableContourPlaces(old,{page:1,loading:false,displayPlaces:fresh}),fresh);
 assert.deepEqual(stableContourPlaces(old,{page:1,loading:false,displayPlaces:[],complete:true}),[]);
});
test('retained contours are still culled by the active map bounds',()=>{
 const old=[square];
 const retained=stableContourPlaces(old,{page:0,displayPlaces:[],loading:true});
 assert.deepEqual(visibleInMap(retained,[38,56,38.01,56.01]),[]);
});
test('partial coverage does not clear polygons while a second page is pending',()=>{
 const old=[square],more=[{...square,id:303}];
 assert.equal(stableContourPlaces(old,{page:0,loading:true,displayPlaces:[]}),old);
 assert.equal(stableContourPlaces(old,{page:1,loading:true,displayPlaces:more}),more);
 assert.deepEqual(stableContourPlaces(old,{page:1,loading:false,displayPlaces:[],complete:false}),[]);
});

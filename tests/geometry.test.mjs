import test from 'node:test';
import assert from 'node:assert/strict';
import {hitTestPlaces} from '../src/geometry.js';
const box=(id,size)=>({id,title:'Object '+id,coords:[[-size,-size],[-size,size],[size,size],[size,-size]]});
const project=([lat,lng])=>({x:lng*100,y:lat*100});
test('overlapping polygons are ordered small first, including the boundary',()=>{
 assert.deepEqual(hitTestPlaces([box(1,2),box(2,1)],{lat:0,lng:0},project).map(p=>p.id),[2,1]);
 assert.equal(hitTestPlaces([box(2,1)],{lat:1,lng:0},project)[0].id,2);
});
test('8px touch tolerance works without selecting distant or invalid polygons',()=>{
 assert.equal(hitTestPlaces([box(2,1)],{lat:1.06,lng:0},project).length,1);
 assert.equal(hitTestPlaces([box(2,1)],{lat:1.1,lng:0},project).length,0);
 assert.equal(hitTestPlaces([{id:3,coords:[]}],{lat:0,lng:0},project).length,0);
});

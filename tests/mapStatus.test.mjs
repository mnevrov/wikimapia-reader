import test from 'node:test';
import assert from 'node:assert/strict';
import {areaMessage} from '../src/mapStatus.js';
test('only cold load speaks; background loading is silent',()=>{
 assert.equal(areaMessage({loading:true,background:false}),'Загружаем объекты…');
 assert.equal(areaMessage({loading:true,background:true,displayPlaces:[{}]}),'');
});
test('cancelled first request clears the old message and errors remain visible',()=>{
 assert.equal(areaMessage({loading:false,page:0,places:[]}), '');
 assert.equal(areaMessage({loading:false,error:'Ошибка'}),'Ошибка');
 assert.equal(areaMessage({loading:false,page:1,places:[],displayPlaces:[]}), 'Здесь пока нет объектов Wikimapia');
});
test('continuation budget is explained and errors take priority',()=>{
 assert.match(areaMessage({batchLimited:true}),/20 страниц/);
 assert.equal(areaMessage({batchLimited:true,error:'Ошибка'}),'Ошибка');
});

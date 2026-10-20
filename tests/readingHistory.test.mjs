import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readHistory,recordHistory,filterLibrary,HISTORY_LIMIT} from '../src/readingHistory.js';
const time=1760000000000;
test('history validates IDs, titles and timestamps, deduplicates and sorts',()=>{
 const items=[{id:7,title:' Башня ',viewedAt:time-5},{id:7,title:'old',viewedAt:time-10},{id:8,title:'Музей',viewedAt:time},{id:'9',title:'bad',viewedAt:time},{id:1,title:'future',viewedAt:9999999999999},{id:-2,title:'negative',viewedAt:time}];
 assert.deepEqual(readHistory(JSON.stringify(items)),[{id:8,title:'Музей',viewedAt:time},{id:7,title:'Башня',viewedAt:time-5}]);
 assert.deepEqual(readHistory('{broken'),[]);assert.deepEqual(readHistory('{}'),[]);
});
test('read event moves to front and persists only whitelisted fields',()=>{
 const input=[{id:7,title:'Old',viewedAt:time-5}];
 const result=recordHistory(input,{id:7,title:'New',source:'wikimapia',apiKey:'secret',latitude:33},time);
 assert.deepEqual(result,[{id:7,title:'New',viewedAt:time}]);
 assert.doesNotMatch(JSON.stringify(result),/secret|latitude|apiKey/);
 assert.deepEqual(recordHistory(result,{id:1,title:'Demo',source:'demo'},time),result);
 assert.deepEqual(recordHistory(result,{id:0,title:'Invalid'},time),result);
});
test('history is bounded to 50 entries',()=>{
 let items=[];
 for(let i=1;i<=HISTORY_LIMIT+3;i++)items=recordHistory(items,{id:i,title:'Место '+i},time+i);
 assert.equal(items.length,HISTORY_LIMIT);assert.equal(items[0].id,HISTORY_LIMIT+3);
 assert.equal(items.at(-1).id,4);
});
test('offline search matches description case-insensitively; title and ID work everywhere',()=>{
 const items=[{id:55,title:'Старая башня',description:'Уникальная архитектура'},{id:77,title:'Музей',description:'История'}];
 assert.deepEqual(filterLibrary(items,'АРХИТЕКТУРА',{searchDescription:true}).map(x=>x.id),[55]);
 assert.deepEqual(filterLibrary(items,'архитектура').map(x=>x.id),[]);
 assert.deepEqual(filterLibrary(items,'77').map(x=>x.id),[77]);
 assert.deepEqual(filterLibrary(items,' бАшНя ').map(x=>x.id),[55]);
});

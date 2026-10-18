import test from 'node:test';
import assert from 'node:assert/strict';
import {readFavorites,toggleFavorite} from '../src/favorites.js';
test('legacy favorites migrate without fabricated demo titles or invalid data',()=>{
 assert.deepEqual(readFavorites(JSON.stringify([101,{id:102,title:'Демонстрация'},null,{id:-1}])),[{id:101,source:'wikimapia',title:'Объект #101'},{id:102,source:'wikimapia',title:'Объект #102'}]);assert.deepEqual(readFavorites('{}'),[]);
});
test('demo and real objects with the same id are distinct',()=>{
 const demo={id:101,source:'demo',title:'Демо'},real={id:101,source:'wikimapia',title:'Реальное место'};
 const list=toggleFavorite(toggleFavorite([],demo),real);assert.equal(list.length,2);assert.deepEqual(toggleFavorite(list,demo),[real]);
});

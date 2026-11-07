import test from 'node:test';import assert from 'node:assert/strict';
import {favoriteOperations,mergeAreas} from '../src/carSync.js';
test('explicit removals survive concurrent car additions',()=>{const before=[{id:1,source:'wikimapia',title:'A'}],next=[];assert.deepEqual(favoriteOperations(before,next),[{place:before[0],remove:true}]);});
test('demo and live are separate namespaces',()=>{assert.equal(favoriteOperations([{id:1,source:'demo',title:'D'}],[{id:1,source:'wikimapia',title:'L'}]).length,2);});
test('cache merge retains newer record and pinned setting',()=>{const b=[1,2,1.01,2.01];const a={bbox:b,updated:10,pinned:true},c={bbox:b,updated:20,pinned:false};assert.deepEqual(mergeAreas([a],[c]),[{...c,pinned:true}]);});

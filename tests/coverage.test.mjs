import test from 'node:test';
import assert from 'node:assert/strict';
import {isCovered} from '../src/coverage.js';
test('adjacent and overlapping rectangles cover the full viewport',()=>{
 assert.equal(isCovered([0,0,2,2],[[0,0,1,2],[1,0,2,2]]),true);
 assert.equal(isCovered([0,0,2,2],[[0,0,1.2,2],[1,0,2,2]]),true);
 assert.equal(isCovered([.1,.1,.9,.9],[[0,0,1,1]]),true);
});
test('gap, hole, edge contact and empty cache never imply coverage',()=>{
 assert.equal(isCovered([0,0,2,2],[[0,0,.999,2],[1,0,2,2]]),false);
 assert.equal(isCovered([0,0,2,2],[[0,0,2,.5],[0,1.5,2,2],[0,0,.5,2],[1.5,0,2,2]]),false);
 assert.equal(isCovered([0,0,1,1],[[1,0,2,1]]),false);
 assert.equal(isCovered([0,0,1,1],[]),false);
});

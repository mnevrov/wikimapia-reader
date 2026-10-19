import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextFollowState,acceptableFix,followMovement} from '../src/gpsFollow.js';
test('follow tap, pause and resume transitions',()=>{
 assert.equal(nextFollowState('off','tap'),'following');
 assert.equal(nextFollowState('following','manual-pan'),'paused');
 assert.equal(nextFollowState('paused','tap'),'following');
 assert.equal(nextFollowState('following','tap'),'off');
 assert.equal(nextFollowState('following','background'),'following');
 assert.equal(nextFollowState('following','permission-denied'),'off');
});
test('reject low accuracy or malformed GPS fixes',()=>{
 assert.equal(acceptableFix({latitude:55,longitude:37,accuracy:10}),true);
 assert.equal(acceptableFix({latitude:55,longitude:37,accuracy:300}),false);
 assert.equal(acceptableFix({latitude:91,longitude:37,accuracy:10}),false);
});
test('ignore GPS jitter and excessive map animation',()=>{
 assert.equal(followMovement(4,6000,10),false);
 assert.equal(followMovement(40,500,10),false);
 assert.equal(followMovement(40,4000,10),true);
 assert.equal(followMovement(40,4000,200),false);
});

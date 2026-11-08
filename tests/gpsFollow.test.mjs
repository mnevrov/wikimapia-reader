import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextFollowState,acceptableFix,usableFix,followZoom,followMovement} from '../src/gpsFollow.js';
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

test('Android approximate first fix is displayed but not treated as precise GPS',()=>{
 assert.equal(usableFix({latitude:55.75,longitude:37.62,accuracy:1800}),true);
 assert.equal(usableFix({latitude:55.75,longitude:37.62,accuracy:250}),true);
 assert.equal(usableFix({latitude:55.75,longitude:37.62,accuracy:7000}),false);
 assert.equal(usableFix({latitude:NaN,longitude:37.62,accuracy:20}),false);
 assert.equal(acceptableFix({latitude:55.75,longitude:37.62,accuracy:1800}),false);
});
test('map zoom reflects initial coarse accuracy and refines when GPS becomes precise',()=>{
 assert.equal(followZoom(1800,17),11);
 assert.equal(followZoom(1200,17),13);
 assert.equal(followZoom(400,17),15);
 assert.equal(followZoom(20,13,true),17);
 assert.equal(followZoom(800,18,true),18); // don't reset deliberate user zoom
});

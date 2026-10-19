import {test} from 'node:test';
import assert from 'node:assert/strict';
import {offlinePreferences,offlineStatus} from '../src/offlineStore.js';
test('offline preferences validated without modifying region cache',()=>{
 assert.deepEqual(offlinePreferences({limitMB:999,retentionDays:0}),{limitMB:100,retentionDays:30});
 assert.deepEqual(offlinePreferences({limitMB:50,retentionDays:90}),{limitMB:50,retentionDays:90});
});
test('offline status distinguishes saved, incomplete, stale, and missing',()=>{
 const now=1710000000000;
 assert.equal(offlineStatus(null,{},now),'absent');
 assert.equal(offlineStatus({savedAt:now,missing:0},null,now),'saved');
 assert.equal(offlineStatus({savedAt:now,missing:2},null,now),'partial');
 assert.equal(offlineStatus({savedAt:now-31*86400000,missing:0},{retentionDays:30},now),'stale');
 assert.equal(offlineStatus({savedAt:now,error:'disk',missing:0},{},now),'error');
});

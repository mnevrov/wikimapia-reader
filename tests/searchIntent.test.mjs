import test from 'node:test';
import assert from 'node:assert/strict';
import {searchIntent} from '../src/searchIntent.js';
test('titles are searched; valid numeric IDs and official links open one place',()=>{
 assert.deepEqual(searchIntent('  Tower  '),{kind:'query',query:'Tower'});
 for(const text of ['55','https://wikimapia.org/55/ru/Tower','https://www.wikimapia.org/?show=55','https://wikimapia.org/#lang=ru&lat=55&show=55'])assert.deepEqual(searchIntent(text),{kind:'place',id:55});
});
test('malformed, foreign and unsafe links never become outbound URLs',()=>{
 for(const text of ['', '0','9007199254740992','https://evil.test/55','https://wikimapia.org.evil.test/55','javascript:alert(1)','https://wikimapia.org/'])assert.equal(searchIntent(text).kind,'invalid');
});

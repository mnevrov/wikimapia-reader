import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBackup,parseBackup} from '../src/libraryBackup.js';
const row={id:5,title:'Старый дом',description:'Описание',savedAt:1760000000000,comments:[],photos:[{src:'https://private.example/image?key=secret'}]};
test('backup excludes credentials, photo URLs and geometry',()=>{
 const source={favorites:[{id:5,source:'wikimapia',title:'Старый дом'}],history:[],offline:[row]};
 const text=JSON.stringify(buildBackup(source));
 assert.ok(!text.includes('secret')&&!text.includes('private.example'));
 const parsed=parseBackup(text);
 assert.deepEqual(parsed.offline,[{id:5,title:'Старый дом',description:'Описание',savedAt:row.savedAt,comments:[]}]);
});
test('backup rejects unknown schema, oversized values and malformed cards',()=>{
 assert.throws(()=>parseBackup('not json'),/JSON/);
 assert.throws(()=>parseBackup(JSON.stringify({format:'other',version:1,mediaIncluded:false,favorites:[],history:[],offline:[]})),/формат/);
 assert.throws(()=>parseBackup(JSON.stringify({...buildBackup({}),offline:[{id:2,title:'x',description:'ok',comments:[],savedAt:-1}]})),/дата/);
});
test('backup round trip ignores demo favorites and invalid history',()=>{
 const saved=buildBackup({favorites:[{id:1,source:'demo',title:'demo'},{id:2,source:'wikimapia',title:'Реальный'}],history:[{id:2,title:'Реальный',viewedAt:1760000000000}],offline:[]});
 assert.deepEqual(parseBackup(JSON.stringify(saved)).favorites.map(x=>x.id),[2]);
 assert.equal(parseBackup(JSON.stringify(saved)).history.length,1);
});

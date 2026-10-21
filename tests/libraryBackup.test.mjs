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

test('malformed comment dates are stripped so reader date formatting cannot crash',()=>{
 const source=buildBackup({offline:[{...row,comments:[{author:'А',text:'Объект',date:'corrupt-date'}]}]});
 const parsed=parseBackup(JSON.stringify(source));
 assert.equal(parsed.offline[0].comments[0].date,null);
});

test('export keeps long existing offline descriptions losslessly within 10MB backup cap',()=>{
 const long='Ж'.repeat(410000);
 const item={...row,description:long};
 const data=buildBackup({offline:[item]});
 const text=JSON.stringify(data);
 assert.equal(parseBackup(text).offline[0].description,long);
});
test('backup round-trip preserves partial-card statuses without exporting media URLs',()=>{
 const entry={id:55,title:'Частичная карточка',description:'Текст',comments:[],savedAt:Date.now(),photos:[{src:'https://photos.wikimapia.org/private-test.jpg'}],blocks:{title:'ok',description:'ok',photos:'ok',comments:'unavailable'}};
 const raw=JSON.stringify(buildBackup({offline:[entry]}));const result=parseBackup(raw).offline[0];assert.equal(result.blocks.comments,'unavailable');assert.equal(result.blocks.photos,'unavailable');assert.ok(!raw.includes('private-test.jpg'));
});

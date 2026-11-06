import test from 'node:test';import assert from 'node:assert/strict';
const mod=()=>import('../src/siteTiles.js').catch(()=>({}));
function encoded(points){let x=0,y=0;return points.map(([lat,lon])=>{const nx=Math.round(lon*1e6),ny=Math.round(lat*1e6);const pair=[nx-x,ny-y];x=nx;y=ny;return pair.map(n=>{let v=n<0?~(n<<1):n<<1,s='';while(v>=32){s+=String.fromCharCode((32|(v&31))+63);v>>>=5;}return s+String.fromCharCode(v+63);}).join('');}).join('');}
test('quadkey matches live Moscow tile and rejects unbounded coordinates',async()=>{const {tileAddress}=await mod();assert.equal(typeof tileAddress,'function');assert.equal(tileAddress(4952,2561,13).id,'03021323233220');assert.throws(()=>tileAddress(1,2,20));});
test('tile decodes typed polygon, bbox and Russian title with correct axis order',async()=>{const {parseSiteTile}=await mod();assert.equal(typeof parseSiteTile,'function');const p=encoded([[55.75,37.61],[55.75,37.62],[55.76,37.62]]);const r=parseSiteTile('030|0|7\n55|100|376100000,376200000,557500000,557600000|16||!Место|1|'+p,'030');assert.equal(r.places[0].title,'Место');assert.deepEqual(r.places[0].coords,[[55.75,37.61],[55.75,37.62],[55.76,37.62]]);assert.equal(r.deeperTiles,false);});
test('malformed geometry and a wrong tile ID fail closed',async()=>{const {parseSiteTile}=await mod();assert.equal(typeof parseSiteTile,'function');assert.throws(()=>parseSiteTile('031|0|7','030'));assert.throws(()=>parseSiteTile('030|0|7\n55|100|1,2,3,4|16||!Место|1|~~~~','030'));});
test('partial area budgets never become complete; abort prevents late updates',async()=>{const {createTileSource}=await mod();assert.equal(typeof createTileSource,'function');const request=async({url})=>({text:new URL(url).pathname.split('/itiles/')[1].replaceAll('/','').replace('.xy','')+'|1|7'});const load=createTileSource(request);const r=await load({bbox:[37.61,55.75,37.62,55.76]});assert.equal(r.complete,false);const c=new AbortController();c.abort();await assert.rejects(()=>load({bbox:[37.61,55.75,37.62,55.76],signal:c.signal}),{name:'AbortError'});});
test('legacy polygon uses big-endian multibyte deltas like official decoder',async()=>{const {parseSiteTile}=await mod();for(const width of [2,3,4]){const encoded=(width-1).toString(16).padStart(2,'0')+'64'.padStart(width*2,'0')+'0'.repeat(width*4)+'64'.padStart(width*2,'0');const r=parseSiteTile('030|0|7\n55|100|376100000,376200000,557500000,557600000|16||!Место|0|376200000;557600000;'+encoded,'030');assert.deepEqual(r.places[0].coords,[[55.76,37.62],[55.76,37.61999],[55.75999,37.61999]]);}});

test('large viewport uses lower LOD instead of silently dropping tiles after the first 16',async()=>{
 const {createTileSource}=await mod();
 const requests=[];
 const request=async({url})=>{
  requests.push(url);
  const id=new URL(url).pathname.split('/itiles/')[1].replaceAll('/','').replace('.xy','');
  return {text:id+'|0|7'};
 };
 const area=await createTileSource(request)({bbox:[37.60,55.74,37.634,55.774]});
 assert.ok(requests.length>0&&requests.length<=16);
 assert.ok(area.zoomLevel<15,'wide view should select a parent tile level');
 assert.equal(area.complete,true,'leaf tiles with no failures fully cover the view');
 assert.equal(area.failedTiles,0);
});
test('a single malformed tile does not erase good contours in the remaining viewport',async()=>{
 const {createTileSource}=await mod();
 let calls=0;
 const request=async({url})=>{
  const id=new URL(url).pathname.split('/itiles/')[1].replaceAll('/','').replace('.xy','');
  calls++;
  if(calls===2)throw Error('HTTP 502');
  return {text:id+'|0|7'};
 };
 const result=await createTileSource(request)({bbox:[37.61,55.75,37.62,55.76]});
 assert.ok(calls>=3);
 assert.equal(result.failedTiles,1);
 assert.equal(result.complete,false,'incomplete coverage cannot be cached as complete');
});
test('all failed site tiles remain an error and never masquerade as an empty area',async()=>{
 const {createTileSource}=await mod();
 const request=async()=>{throw Error('HTTP 502');};
 await assert.rejects(()=>createTileSource(request)({bbox:[37.61,55.75,37.62,55.76]}),/HTTP 502/);
});
test('refresh failure retains previous validated tiles but reports partial coverage',async()=>{
 const {createTileSource}=await mod();
 let fail=false;
 const request=async({url})=>{
  if(fail)throw Error('HTTP 502');
  const id=new URL(url).pathname.split('/itiles/')[1].replaceAll('/','').replace('.xy','');
  return {text:id+'|0|7'};
 };
 const load=createTileSource(request);
 const bbox=[37.61,55.75,37.62,55.76];
 assert.equal((await load({bbox})).complete,true);
 fail=true;
 const retry=await load({bbox,force:true});
 assert.ok(retry.failedTiles>0);
 assert.equal(retry.complete,false);
});
test('abort during a multi-tile load immediately propagates and does not return partial success',async()=>{
 const {createTileSource}=await mod();
 const controller=new AbortController();
 let calls=0;
 const request=async({url})=>{
  const id=new URL(url).pathname.split('/itiles/')[1].replaceAll('/','').replace('.xy','');
  if(++calls===2)controller.abort();
  return {text:id+'|0|7'};
 };
 await assert.rejects(()=>createTileSource(request)({bbox:[37.61,55.75,37.62,55.76],signal:controller.signal}),{name:'AbortError'});
 assert.equal(calls,2);
});

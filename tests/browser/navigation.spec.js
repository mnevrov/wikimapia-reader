import {test,expect} from '@playwright/test';
import {tiles,connect} from './helpers.js';
const polygon=[{x:37.617,y:55.751},{x:37.619,y:55.751},{x:37.619,y:55.753}];
async function start(page,zoom=15){
 await tiles(page);await page.addInitScript(z=>localStorage.setItem('wikimapia-reader-view',JSON.stringify({lat:55.752,lng:37.618,zoom:z})),zoom);
 await page.goto('/');await connect(page);
}
async function pan(page,dx,dy=0){const b=await page.locator('.map').boundingBox();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.48);await page.mouse.down();await page.mouse.move(b.x+b.width*.5+dx,b.y+b.height*.48+dy,{steps:12});await page.mouse.up();}
test('zoom 15 loads and panning requests new contours without the large counter',async({page})=>{
 let requests=0;
 await page.route('https://api.wikimapia.org/**',r=>{requests++;return r.fulfill({json:{folder:[{id:requests,name:'Area',polygon}],found:1}});});
 await start(page);await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
 await expect(page.locator('.map-summary')).toHaveCount(0);await expect(page.locator('body')).not.toContainText('объектов из');
 await pan(page,-170);await expect.poll(()=>requests,{timeout:15000}).toBe(2);
});
test('automatic pagination fills the map without tapping more',async({page})=>{
 const pages=[];await page.route('https://api.wikimapia.org/**',r=>{const n=Number(new URL(r.request().url()).searchParams.get('page'));pages.push(n);return r.fulfill({json:{folder:[{id:n,name:'Object '+n,polygon}],found:2}});});
 await start(page,16);await expect(page.locator('path.leaflet-interactive')).toHaveCount(2,{timeout:15000});expect(pages).toEqual([1,2]);
});
test('temporary network error retries after moving, without manual refresh',async({page})=>{
 let calls=0;await page.route('https://api.wikimapia.org/**',r=>++calls===1?r.abort():r.fulfill({json:{folder:[{id:1,name:'Recovered',polygon}],found:1}}));
 await start(page);await expect(page.locator('.status')).toContainText('подключиться');await pan(page,-170);
 await expect(page.locator('path.leaflet-interactive')).toHaveCount(1,{timeout:15000});
});
test('saved contours survive reload and can be cleared from settings',async({page})=>{
 const {nativeVault,screen,map}=await import('./helpers.js');
 let requests=0;await page.route('https://api.wikimapia.org/**',r=>{requests++;return r.fulfill({json:{folder:[{id:1,name:'Saved area',polygon}],found:1}});});
 await tiles(page);await nativeVault(page,{key:'cache-test-key',calls:[]});await page.goto('/');await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
 await page.reload();await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);expect(requests).toBe(1);
 await screen(page,'Настройки');await page.getByRole('button',{name:'Очистить кэш областей'}).click();await expect(page.locator('.toast')).toContainText('Кэш областей очищен');
 await map(page);await expect.poll(()=>requests,{timeout:15000}).toBe(2);
});
test('failing next page retries that page twice without replaying page one forever',async({page})=>{
 test.setTimeout(60000);const pages=[];
 await page.route('https://api.wikimapia.org/**',r=>{const n=Number(new URL(r.request().url()).searchParams.get('page'));pages.push(n);return n===1?r.fulfill({json:{folder:[{id:1,name:'First',polygon}],found:100}}):r.abort();});
 await start(page,16);await expect.poll(()=>pages.length,{timeout:35000}).toBe(4);
 await page.waitForTimeout(9000);expect(pages).toEqual([1,2,2,2]);await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
});
test('stale disk contours remain available offline and never store the API key',async({page})=>{
 const {nativeVault}=await import('./helpers.js');await tiles(page);await nativeVault(page,{key:'never-in-area-cache',calls:[]});
 await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{folder:[{id:1,name:'Offline area',polygon}],found:1}}));
 await page.goto('/');await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
 await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('wikireader-areas',1);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
  await new Promise((resolve,reject)=>{const tx=db.transaction('areas','readwrite');const s=tx.objectStore('areas');const r=s.getAll();r.onsuccess=()=>{for(const item of r.result){item.updated=Date.now()-300001;s.put(item);}};tx.oncomplete=resolve;tx.onabort=reject;});db.close();
 });
 await page.unroute('https://api.wikimapia.org/**');await page.route('https://api.wikimapia.org/**',r=>r.abort());await page.reload();
 await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);await expect(page.locator('.status')).toContainText('подключиться');
 const saved=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('wikireader-areas');r.onsuccess=()=>resolve(r.result);});const rows=await new Promise(resolve=>{const r=db.transaction('areas').objectStore('areas').getAll();r.onsuccess=()=>resolve(r.result);});db.close();return JSON.stringify(rows);});
 expect(saved).toContain('Offline area');expect(saved).not.toContain('never-in-area-cache');expect(saved).not.toContain('key=');
});

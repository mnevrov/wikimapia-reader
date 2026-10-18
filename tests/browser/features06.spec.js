import {test,expect} from '@playwright/test';
import {tiles,nativeVault,screen,map} from './helpers.js';
const polygon=[{x:37.617,y:55.751},{x:37.619,y:55.751},{x:37.619,y:55.753},{x:37.617,y:55.753}];
async function start(page,folder=[{id:1,name:'Small',polygon}],found=folder.length){
 await tiles(page);await nativeVault(page,{key:'scope-test-key',calls:[]});
 await page.route('https://api.wikimapia.org/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.searchParams.get('function')==='box'?{folder,found}:{id:Number(u.searchParams.get('id')),title:'Chosen object',description:'Chosen detail',polygon}});});
 await page.goto('/');await expect(page.locator('path.leaflet-interactive')).toHaveCount(folder.length);
}
test('refresh with existing contours is silent, cancellation leaves no loading notice',async({page})=>{
 await start(page);await page.getByRole('button',{name:'Загрузить область',exact:true}).click();
 await expect(page.getByRole('button',{name:'Загрузить область',exact:true})).toHaveAttribute('aria-busy','true');
 await expect(page.locator('.status')).toHaveCount(0);
 await screen(page,'Настройки');await page.getByLabel('Автозагрузка области').uncheck();await map(page);
 await expect(page.getByRole('button',{name:'Загрузить область',exact:true})).toBeEnabled();await expect(page.locator('.status')).toHaveCount(0);
});
test('cache statistics retention and pin survive reload and ordinary clearing',async({page})=>{
 await start(page);await screen(page,'Настройки');await expect(page.locator('.cache-stats')).toContainText('1 из 32');
 await page.getByLabel('Хранить незакреплённые области').selectOption('7');await expect(page.locator('.toast')).toContainText('Срок хранения изменён');
 await page.getByRole('button',{name:'Закрепить текущую область',exact:true}).click();await expect(page.locator('.cache-stats')).toContainText('Закреплено: 1');
 await page.getByRole('button',{name:'Очистить кэш областей',exact:true}).click();await expect(page.locator('.toast')).toContainText('Кэш областей очищен');await expect(page.locator('.cache-stats')).toContainText('1 из 32');
 await page.reload();await screen(page,'Настройки');await expect(page.getByLabel('Хранить незакреплённые области')).toHaveValue('7');await expect(page.locator('.cache-stats')).toContainText('Закреплено: 1');
 await page.locator('.cached-areas summary').click();await page.getByRole('button',{name:'Показать область на карте'}).click();await expect(page.locator('.app-screen')).toHaveCount(0);await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
});
test('normal polygons have no fill and an overlap opens a choice, not a random card',async({page})=>{
 const big=[{x:37.614,y:55.748},{x:37.622,y:55.748},{x:37.622,y:55.756},{x:37.614,y:55.756}];
 await start(page,[{id:1,name:'Small',polygon},{id:2,name:'Large',polygon:big}]);
 for(const p of await page.locator('path.leaflet-interactive').all())await expect(p).toHaveAttribute('fill','none');
 const b=await page.locator('path.leaflet-interactive').first().boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
 await expect(page.getByRole('dialog',{name:'Объекты в этой точке'})).toBeVisible();await expect(page.locator('.object-options button').first()).toContainText('Small');await expect(page.locator('.sheet')).toHaveCount(0);
 await page.locator('.object-options button').first().click();await expect(page.locator('.sheet h2')).toHaveText('Chosen object',{timeout:15000});
});
test('chooser closes with Back and map drag, and fits a short landscape screen',async({page})=>{
 const big=polygon.map(p=>({x:37.618+(p.x-37.618)*2,y:55.752+(p.y-55.752)*2}));await start(page,[{id:1,name:'Small',polygon},{id:2,name:'Large',polygon:big}]);
 const tap=async()=>{const b=await page.locator('path.leaflet-interactive').first().boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await expect(page.locator('.object-chooser')).toBeVisible();};
 await tap();await page.keyboard.press('Escape');await expect(page.locator('.object-chooser')).toHaveCount(0);await tap();
 await page.setViewportSize({width:844,height:390});await expect(page.locator('.object-chooser')).toHaveCount(0);await tap();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(844);const b=await page.locator('.object-chooser').boundingBox();expect(b.height).toBeLessThan(334);
 await page.getByLabel('Закрыть выбор объектов').click();const m=await page.locator('.map').boundingBox();await page.mouse.move(m.width*.25,m.height*.5);await page.mouse.down();await page.mouse.move(m.width*.25+45,m.height*.5,{steps:10});await page.mouse.up();await expect(page.locator('.object-chooser')).toHaveCount(0);
});
test('pin survives an API refresh; deleting all requires a separate explicit action',async({page})=>{
 await start(page);await screen(page,'Настройки');await page.getByRole('button',{name:'Закрепить текущую область',exact:true}).click();await expect(page.locator('.cache-stats')).toContainText('Закреплено: 1');await map(page);
 await page.getByRole('button',{name:'Загрузить область',exact:true}).click();await expect(page.getByRole('button',{name:'Загрузить область',exact:true})).toBeEnabled({timeout:15000});
 await screen(page,'Настройки');await expect(page.locator('.cache-stats')).toContainText('Закреплено: 1');await page.getByRole('button',{name:'Удалить весь кэш…'}).click();await expect(page.getByRole('group',{name:'Удаление всего кэша'})).toBeVisible();
 await page.getByRole('button',{name:'Отмена',exact:true}).click();await expect(page.locator('.cache-stats')).toContainText('1 из 32');await page.getByRole('button',{name:'Удалить весь кэш…'}).click();await page.getByRole('button',{name:'Удалить всё',exact:true}).click();await expect(page.locator('.cache-stats')).toContainText('0 из 32');
});
test('v1 cache migrates without losing contours or making a fresh network request',async({page})=>{
 const {connect}=await import('./helpers.js');await tiles(page);let calls=0;await page.route('https://api.wikimapia.org/**',r=>{calls++;return r.fulfill({json:{folder:[],found:0}});});await page.goto('/');
 await page.evaluate(async polygon=>{
  const bbox=[37.60,55.74,37.635,55.775];const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('wikireader-areas',1);r.onupgradeneeded=()=>r.result.createObjectStore('areas',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
  await new Promise((resolve,reject)=>{const tx=db.transaction('areas','readwrite');tx.objectStore('areas').put({id:bbox.join(','),bbox,updated:Date.now(),state:{places:[{id:1,title:'Migrated',coords:polygon.map(p=>[p.y,p.x])}],page:1,found:1,more:false}});tx.oncomplete=resolve;tx.onabort=reject;});db.close();
 },polygon);
 await connect(page);await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);expect(calls).toBe(0);await screen(page,'Настройки');await expect(page.locator('.cache-stats')).toContainText('1 из 32');
 const version=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('wikireader-areas');r.onsuccess=()=>resolve(r.result);});const v=db.version;db.close();return v;});expect(version).toBe(2);
});
test('failed pin write reports failure without losing the saved area',async({page})=>{
 await start(page);await screen(page,'Настройки');await expect(page.locator('.cache-stats')).toContainText('Закреплено: 0');
 await page.evaluate(()=>{window.originalCachePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='areas')throw new DOMException('simulated disk full','QuotaExceededError');return window.originalCachePut.apply(this,args);};});
 await page.getByRole('button',{name:'Закрепить текущую область',exact:true}).click();await expect(page.locator('.toast')).toContainText('Не удалось изменить кэш');await expect(page.locator('.cache-stats')).toContainText('Закреплено: 0');
 await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalCachePut;});await page.reload();await screen(page,'Настройки');await expect(page.locator('.cache-stats')).toContainText('1 из 32');await expect(page.locator('.cache-stats')).toContainText('Закреплено: 0');
});
test('a detail without geometry keeps its known selected contour',async({page})=>{
 await start(page);await page.unroute('https://api.wikimapia.org/**');await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{id:1,title:'Without geometry',description:'Existing contour remains'}}));
 const b=await page.locator('path.leaflet-interactive').first().boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await expect(page.locator('.sheet h2')).toHaveText('Without geometry',{timeout:15000});
 await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);await expect(page.locator('path.leaflet-interactive')).toHaveAttribute('fill-opacity','0.12');
});

import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const liveProjection=JSON.parse(fs.readFileSync(new URL('../fixtures/place-55.projection.json',import.meta.url)));
test.beforeEach(async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')}));
 await page.route('https://photos.wikimapia.org/**',r=>r.abort());
});
test('demo: polygon, tabs, expand and close at mobile width',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.status')).toContainText('ДЕМО');
 await page.locator('path.leaflet-interactive').first().click({force:true});
 await expect(page.locator('.sheet')).toBeVisible();
 await page.getByRole('tab',{name:/Фото/}).click();
 await expect(page.locator('.sheet-scroll')).toBeVisible();
 await page.getByTitle('Развернуть').click();
 await expect(page.locator('.sheet')).toHaveClass(/expanded/);
 await page.getByTitle('Закрыть').click();
 await expect(page.locator('.sheet')).toHaveCount(0);
});
test('no requests while typing a key; applies once; live detail by id',async({page})=>{
 let requests=[];
 await page.route('https://api.wikimapia.org/**',r=>{requests.push(r.request().url());return r.fulfill({json:liveProjection});});
 await page.goto('/');await page.getByRole('button',{name:'⚙ Настройки'}).click();
 await page.locator('#api-key').pressSequentially('private-test-key');
 expect(requests).toHaveLength(0);
 await page.getByRole('button',{name:'Применить ключ'}).click();
 await page.locator('#place-id').fill('55');await page.getByRole('button',{name:'Открыть по ID'}).click();
 await expect(page.locator('.sheet h2')).toHaveText('Eiffel Tower');
 expect(requests).toHaveLength(1);
 await expect(page.locator('.description')).toContainText('Champ de Mars');
 expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('private-test-key');
});
test('ambiguous area response is an error and never silently says zero objects',async({page})=>{
 await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:[]}));
 await page.goto('/');await page.getByRole('button',{name:'⚙ Настройки'}).click();
 await page.locator('#api-key').fill('private-test-key');await page.getByRole('button',{name:'Применить ключ'}).click();
 await page.getByLabel('Закрыть настройки').click();
 await page.getByRole('button',{name:'Загрузить область'}).click();
 await expect(page.locator('.status')).toContainText('структура');
});
test('late detail is ignored after switching to demo',async({page})=>{
 let deliver;const held=new Promise(r=>deliver=r);
 await page.route('https://api.wikimapia.org/**',async r=>{await held;await r.fulfill({json:liveProjection});});
 await page.goto('/');await page.getByRole('button',{name:'⚙ Настройки'}).click();
 await page.locator('#api-key').fill('private-test-key');await page.getByRole('button',{name:'Применить ключ'}).click();
 await page.locator('#place-id').fill('55');await page.getByRole('button',{name:'Открыть по ID'}).click();
 await page.getByRole('button',{name:'Включить демо'}).click();deliver();
 await expect(page.locator('.status')).toContainText('ДЕМО');await expect(page.locator('.sheet')).toHaveCount(0);
});
test('box area contours lead to a detail card',async({page})=>{
 const area=JSON.parse(fs.readFileSync(new URL('../fixtures/box-moscow.projection.json',import.meta.url)));
 // Keep one real polygon; choose a coordinate inside it via its bounds using Leaflet click dispatch.
 const place=area.folder.find(p=>p.id==='5195049');
 await page.route('https://api.wikimapia.org/**',r=>{
  const method=new URL(r.request().url()).searchParams.get('function');
  return r.fulfill({json:method==='box'?{...area,folder:[place]}:{id:Number(place.id),title:place.name,description:'Синтетическое описание для проверки перехода из контура',polygon:place.polygon}});
 });
 await page.goto('/');await page.getByRole('button',{name:'⚙ Настройки'}).click();
 await page.locator('#api-key').fill('test-key');await page.getByRole('button',{name:'Применить ключ'}).click();
 await page.getByLabel('Закрыть настройки').click();await page.getByRole('button',{name:'Загрузить область'}).click();
 await expect(page.locator('.status')).toContainText('1 объектов');
 // DOM event targets the loaded Leaflet polygon; coordinate hit-testing is a device smoke check.
 await page.locator('path.leaflet-interactive').first().dispatchEvent('click');
 await expect(page.locator('.sheet h2')).toHaveText('Московский Кремль',{timeout:15000});
 await expect(page.locator('.description')).toContainText('Синтетическое',{timeout:15000});
});

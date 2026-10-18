import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {clickContour,tiles,connect,openId,screen,map} from './helpers.js';
const detail=JSON.parse(fs.readFileSync(new URL('../fixtures/place-55.projection.json',import.meta.url)));
test.beforeEach(async({page})=>tiles(page));
test('demo card tabs reading mode and close',async({page})=>{
 await page.goto('/');await expect(page.locator('.status')).toContainText('Демо');
 await clickContour(page);
 await expect(page.locator('.sheet')).toBeVisible();await page.getByRole('tab',{name:/Фото/}).click();
 await expect(page.locator('.sheet')).toHaveClass(/expanded/);await page.getByLabel('Закрыть карточку').click();await expect(page.locator('.sheet')).toHaveCount(0);
});
test('typing key never requests data; web key stays out of persistent storage',async({page})=>{
 const methods=[];await page.route('https://api.wikimapia.org/**',r=>{methods.push(new URL(r.request().url()).searchParams.get('function'));return r.fulfill({json:detail});});
 await page.goto('/');await screen(page,'Настройки');await page.locator('#api-key').pressSequentially('private-test-key');expect(methods).toHaveLength(0);
 await page.getByRole('button',{name:'Сохранить и подключить'}).click();await openId(page);
 await expect(page.locator('.sheet h2')).toHaveText('Eiffel Tower');await expect(page.locator('.description')).toContainText('Champ de Mars');
 expect(methods).toEqual(['place.getbyid']);expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('private-test-key');
});
test('ambiguous area response never reports zero successfully',async({page})=>{
 await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:[]}));await page.goto('/');await connect(page);
 await expect(page.locator('.status')).toContainText('структура');
});
test('late detail ignored after switching to demo from navigation',async({page})=>{
 let deliver;const held=new Promise(r=>deliver=r);await page.route('https://api.wikimapia.org/**',async r=>{await held;await r.fulfill({json:detail});});
 await page.goto('/');await connect(page);await openId(page);await screen(page,'Настройки');await page.getByRole('button',{name:'Открыть деморежим'}).click();deliver();
 await expect(page.locator('.status')).toContainText('Демо');await expect(page.locator('.sheet')).toHaveCount(0);
});
test('box contour leads to real-shaped detail',async({page})=>{
 const area=JSON.parse(fs.readFileSync(new URL('../fixtures/box-moscow.projection.json',import.meta.url)));const p=area.folder.find(p=>p.id==='5195049');
 await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:new URL(r.request().url()).searchParams.get('function')==='box'?{...area,folder:[p]}:{id:Number(p.id),title:p.name,description:'Синтетическое описание',polygon:p.polygon}}));
 await page.goto('/');await connect(page);await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);await clickContour(page);
 await expect(page.locator('.sheet h2')).toHaveText('Московский Кремль',{timeout:15000});
});
test('demo favorites never open a real object sharing the same id',async({page})=>{
 const requests=[];await page.route('https://api.wikimapia.org/**',r=>{requests.push(r.request().url());return r.fulfill({json:{folder:[],found:0}});});
 await page.goto('/');await clickContour(page);await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByLabel('Закрыть карточку').click();await connect(page);await screen(page,'Избранное');
 const before=requests.length;await page.locator('.saved-open').click();await expect(page.locator('.sheet h2')).toContainText('Демонстрационный');expect(requests.length).toBe(before);
});

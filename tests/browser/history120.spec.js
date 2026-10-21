import {test,expect} from '@playwright/test';
import {connect,openId,screen} from './helpers.js';
const details={id:55,title:'Башня тестовая',description:'Уникальная архитектура крепости',photos:{photo:[]},comments:{comment:[]}};
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-auto','false'));
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:details}));
});
test('successful real read appears in history, is deduplicated and persists',async({page})=>{
 await page.goto('/');await connect(page);await openId(page);
 await expect(page.locator('.sheet h2')).toHaveText('Башня тестовая');
 await screen(page,'Избранное');
 await expect(page.locator('.history-list .saved-open')).toHaveCount(1);
 await page.locator('.history-list .saved-open').click();
 await expect(page.locator('.sheet h2')).toHaveText('Башня тестовая');
 await page.reload();await screen(page,'Избранное');
 await expect(page.locator('.history-list .saved-open')).toHaveCount(1);
 const raw=await page.evaluate(()=>localStorage.getItem('wikireader-reading-history-v1'));
 expect(raw).not.toContain('local-test');expect(JSON.parse(raw)[0].id).toBe(55);
});
test('disable history deletes it but preserves favorites',async({page})=>{
 await page.goto('/');await connect(page);await openId(page);
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await screen(page,'Избранное');
 await expect(page.locator('.history-list .saved-open')).toHaveCount(1);
 await page.locator('#history-enabled').uncheck();
 await expect(page.locator('.history-list')).toHaveCount(0);
 await expect(page.locator('.saved-list .saved-open')).toContainText('Башня тестовая');
 await page.reload();await screen(page,'Избранное');
 await expect(page.locator('#history-enabled')).not.toBeChecked();
 await expect(page.locator('.history-list')).toHaveCount(0);
});
test('failed details never enter history',async({page})=>{
 await page.route('https://api.wikimapia.org/**',r=>r.fulfill({status:500,body:'error'}));
 await page.goto('/');await connect(page);await openId(page);
 await expect(page.locator('.sheet').getByRole('alert')).toBeVisible();
 await screen(page,'Избранное');
 await expect(page.locator('.history-list')).toHaveCount(0);
});
test('offline full text search is local; clearing history preserves offline copies',async({page})=>{
 await page.goto('/');await connect(page);await openId(page);
 await page.getByRole('button',{name:'Действия с объектом'}).click();await page.getByRole('button',{name:'Сохранить для чтения без сети'}).click();
 await expect(page.getByRole('button',{name:'Удалить офлайн-копию'})).toBeVisible();
 await screen(page,'Избранное');
 await page.locator('#saved-library-search').fill('архитектура');
 await expect(page.locator('.offline-list .saved-open')).toHaveCount(1);
 await expect(page.locator('.history-list')).toHaveCount(0);
 await page.locator('#saved-library-search').fill('');
 await page.getByRole('button',{name:'Очистить всю историю…'}).click();
 await expect(page.getByRole('group',{name:'Подтверждение очистки истории'})).toBeVisible();
 await page.getByRole('button',{name:'Удалить историю'}).click();
 await expect(page.locator('.history-list')).toHaveCount(0);
 await expect(page.locator('.offline-list .saved-open')).toHaveCount(1);
});

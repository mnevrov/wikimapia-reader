import {test,expect} from '@playwright/test';
import {tiles,screen,connect,nativeVault} from './helpers.js';
test.beforeEach(async({page})=>{await tiles(page);await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{folder:[],found:0}}));});
test('native vault restored across reload without exposing input or web storage',async({page})=>{
 const state={key:null,calls:[]};await nativeVault(page,state);await page.goto('/');await connect(page,'persistent-test-secret');
 expect(state.key).toBe('persistent-test-secret');await page.reload();await screen(page,'Настройки');
 await expect(page.getByText('Ключ сохранён на устройстве',{exact:true})).toBeVisible();await expect(page.locator('#api-key')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage}))).not.toContain('persistent-test-secret');
 await expect(page.locator('body')).not.toContainText('persistent-test-secret');expect(state.calls.filter(x=>x==='load').length).toBe(2);
});
test('replace and forget persist through reload; demo keeps saved key',async({page})=>{
 const state={key:'original-secret',calls:[]};await nativeVault(page,state);await page.goto('/');await screen(page,'Настройки');
 await page.getByRole('button',{name:'Заменить ключ'}).click();await page.locator('#api-key').fill('replacement-secret');await page.getByRole('button',{name:'Сохранить и подключить'}).click();expect(state.key).toBe('replacement-secret');
 await screen(page,'Настройки');await page.getByRole('button',{name:'Открыть деморежим'}).click();expect(state.key).toBe('replacement-secret');await page.reload();
 await screen(page,'Настройки');await page.getByRole('button',{name:'Удалить ключ',exact:true}).click();await page.getByRole('button',{name:'Удалить с устройства',exact:true}).click();await expect(page.locator('#api-key')).toBeVisible();expect(state.key).toBeNull();await page.reload();await screen(page,'Настройки');await expect(page.getByText('Чтение с сайта',{exact:true})).toBeVisible();
});
test('failed save never claims success or changes the old credential',async({page})=>{
 const state={key:'old-key',calls:[],fail:'save'};await nativeVault(page,state);await page.goto('/');await screen(page,'Настройки');await page.getByRole('button',{name:'Заменить ключ'}).click();await page.locator('#api-key').fill('new-key');await page.getByRole('button',{name:'Сохранить и подключить'}).click();
 await expect(page.getByRole('alert')).toContainText('не сохранён');expect(state.key).toBe('old-key');await expect(page.locator('.app-screen')).toBeVisible();
});
test('unreadable vault has recovery controls; failed delete keeps saved key',async({page})=>{
 const state={key:'old-key',calls:[],fail:'load'};await nativeVault(page,state);await page.goto('/');await screen(page,'Настройки');await expect(page.getByRole('alert')).toContainText('восстановить');
 await expect(page.getByRole('button',{name:'Удалить сохранённую запись'})).toBeVisible();state.fail=null;await page.getByRole('button',{name:'Удалить сохранённую запись'}).click();expect(state.key).toBeNull();
});
test('failed removal preserves active credential and reports the failure',async({page})=>{
 const state={key:'old-key',calls:[],fail:'clear'};await nativeVault(page,state);await page.goto('/');await screen(page,'Настройки');await page.getByRole('button',{name:'Удалить ключ',exact:true}).click();await page.getByRole('button',{name:'Удалить с устройства',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Не удалось удалить');expect(state.key).toBe('old-key');await expect(page.getByText('Ключ сохранён на устройстве',{exact:true})).toBeVisible();
});
test('restored real key never mounts synthetic polygons during startup',async({page})=>{
 await nativeVault(page,{key:'restored-key',calls:[]});
 await page.addInitScript(()=>{
  window.syntheticPathsSeen=0;
  new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes){if(node.nodeType===1){if(node.matches('path.leaflet-interactive'))window.syntheticPathsSeen++;window.syntheticPathsSeen+=node.querySelectorAll('path.leaflet-interactive').length;}}}).observe(document,{childList:true,subtree:true});
 });
 await page.goto('/');await expect(page.locator('.status')).toContainText('Здесь пока нет объектов');
 expect(await page.evaluate(()=>window.syntheticPathsSeen)).toBe(0);
});

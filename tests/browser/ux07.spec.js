import {test,expect} from '@playwright/test';
import {tiles,connect,screen,clickContour,nativeVault} from './helpers.js';
const polygon=[{x:37.617,y:55.751},{x:37.619,y:55.751},{x:37.619,y:55.753}];
async function real(page){await tiles(page);await page.route('https://api.wikimapia.org/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.searchParams.get('function')==='search'?{folder:[{id:55,name:'Tower',polygon}],found:1}:u.searchParams.get('function')==='box'?{folder:[],found:0}:{id:55,title:'Tower',description:'Readable detail',polygon}});});await page.goto('/');await connect(page);}
test('closing a search result returns to its query and results',async({page})=>{
 await real(page);await screen(page,'Поиск');await page.locator('#place-query').fill('Tower');await page.getByRole('button',{name:'Найти',exact:true}).click();await page.locator('.search-results button').click();await expect(page.locator('.description')).toHaveText('Readable detail',{timeout:15000});await page.getByLabel('Закрыть карточку').click();await expect(page.locator('#place-query')).toHaveValue('Tower');await expect(page.locator('.search-results button')).toContainText('Tower');
});
test('search accepts an official object link without an extra search request',async({page})=>{
 await real(page);await screen(page,'Поиск');await page.locator('#place-query').fill('https://wikimapia.org/55/ru/Tower');await page.getByRole('button',{name:'Найти',exact:true}).click();await expect(page.locator('.sheet h2')).toHaveText('Tower',{timeout:15000});
});
test('favorites deletion offers undo without losing other saved places',async({page})=>{
 await tiles(page);await page.goto('/');await clickContour(page);await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByLabel('Закрыть карточку').click();await screen(page,'Избранное');await page.getByRole('button',{name:/Удалить .* из избранного/}).click();await expect(page.locator('.saved-list li')).toHaveCount(0);await page.getByRole('button',{name:'Вернуть',exact:true}).click();await expect(page.locator('.saved-list li')).toHaveCount(1);await page.reload();await screen(page,'Избранное');await expect(page.locator('.saved-list li')).toHaveCount(1);
});
test('deleting the API key requires a clear confirmation and can be cancelled',async({page})=>{
 const state={key:'saved-test-key',calls:[]};await tiles(page);await nativeVault(page,state);await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{folder:[],found:0}}));await page.goto('/');await screen(page,'Настройки');await page.getByRole('button',{name:'Удалить ключ',exact:true}).click();expect(state.key).toBe('saved-test-key');await expect(page.getByRole('group',{name:'Удаление API-ключа'})).toBeVisible();await page.getByRole('button',{name:'Отмена',exact:true}).click();expect(state.key).toBe('saved-test-key');await page.getByRole('button',{name:'Удалить ключ',exact:true}).click();await page.getByRole('button',{name:'Удалить с устройства',exact:true}).click();await expect(page.locator('#api-key')).toBeVisible();expect(state.key).toBeNull();
});
test('object tabs support arrow navigation and a single tab stop',async({page})=>{
 await tiles(page);await page.goto('/');await clickContour(page);const description=page.getByRole('tab',{name:'Описание',exact:true});await description.focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:/Фото/})).toBeFocused();await expect(page.getByRole('tab',{name:/Фото/})).toHaveAttribute('aria-selected','true');await expect(description).toHaveAttribute('tabindex','-1');
});
test('offline state explains cache limits and disappears when the connection returns',async({page})=>{
 await tiles(page);await page.goto('/');await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await expect(page.locator('.network-hint')).toContainText('Нет подключения');await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.locator('.network-hint')).toHaveCount(0);
});
test('map controls and card actions have 48px targets even in landscape',async({page})=>{
 await tiles(page);await page.goto('/');for(const p of [{width:320,height:640},{width:844,height:390}]){await page.setViewportSize(p);for(const selector of ['.map-tools .icon-btn','.leaflet-bar a'])for(const b of await page.locator(selector).all()){const box=await b.boundingBox();expect(box.width).toBeGreaterThanOrEqual(48);expect(box.height).toBeGreaterThanOrEqual(48);}}
});
test('removing a saved place from its card offers the same undo',async({page})=>{
 await tiles(page);await page.goto('/');await clickContour(page);await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByRole('button',{name:'Убрать из избранного',exact:true}).click();await page.getByRole('button',{name:'Вернуть',exact:true}).click();await expect(page.getByRole('button',{name:'Убрать из избранного',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('Back cancels key deletion before leaving settings',async({page})=>{
 await tiles(page);await nativeVault(page,{key:'test-key',calls:[]});await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{folder:[],found:0}}));await page.goto('/');await screen(page,'Настройки');await page.getByRole('button',{name:'Удалить ключ',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('group',{name:'Удаление API-ключа'})).toHaveCount(0);await expect(page.locator('.settings-panel')).toBeVisible();
});
test('favorites filter is local and a removed row can be restored among other places',async({page})=>{
 await tiles(page);await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-favorites',JSON.stringify([{id:101,source:'demo',title:'Квартал'},{id:102,source:'demo',title:'Здание'}])));await page.goto('/');await screen(page,'Избранное');await page.getByLabel('Найти в избранном').fill('Квартал');await expect(page.locator('.saved-list li')).toHaveCount(1);await page.getByRole('button',{name:'Удалить Квартал из избранного'}).click();await page.getByRole('button',{name:'Вернуть',exact:true}).click();await page.getByLabel('Найти в избранном').fill('');await expect(page.locator('.saved-list li')).toHaveCount(2);await expect(page.locator('.saved-list li').nth(1)).toContainText('Здание');
});
test('return restores a long result list position and the triggering button focus',async({page})=>{
 await tiles(page);await page.route('https://api.wikimapia.org/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.searchParams.get('function')==='search'?{folder:Array.from({length:30},(_,i)=>({id:55+i,name:'Result '+i,polygon})),found:30}:{id:Number(u.searchParams.get('id')),title:'Chosen',description:'Text',polygon}});});await page.goto('/');await connect(page);await screen(page,'Поиск');await page.locator('#place-query').fill('Result');await page.getByRole('button',{name:'Найти',exact:true}).click();const row=page.locator('.search-results button').nth(20);await row.scrollIntoViewIfNeeded();const position=await page.locator('.search-page').evaluate(el=>el.scrollTop);await row.click();await expect(page.locator('.description')).toHaveText('Text',{timeout:15000});await page.getByLabel('Закрыть карточку').click();await expect(row).toBeFocused();expect(await page.locator('.search-page').evaluate(el=>el.scrollTop)).toBeCloseTo(position,0);
});
test('leaving a key confirmation never makes Back consume an invisible step',async({page})=>{
 await tiles(page);await nativeVault(page,{key:'test-key',calls:[]});await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{folder:[],found:0}}));await page.goto('/');await screen(page,'Настройки');await page.getByRole('button',{name:'Удалить ключ',exact:true}).click();await screen(page,'Поиск');await page.keyboard.press('Escape');await expect(page.locator('.app-screen')).toHaveCount(0);
});

import {test,expect} from '@playwright/test';
import {tiles,nativeVault} from './helpers.js';
test('map controls stay compact while search opens over map',async({page})=>{
 await tiles(page);await page.goto('/');const rail=page.getByRole('toolbar',{name:'Управление картой'});await expect(rail).toBeVisible();await expect(rail).not.toContainText('Найти место');
 for(const size of [{width:320,height:640},{width:844,height:390}]){await page.setViewportSize(size);const bounds=await rail.boundingBox();expect(bounds.width).toBeLessThanOrEqual(52);for(const name of ['Найти место','Приблизить карту','Отдалить карту','Моё местоположение']){const b=await rail.getByRole('button',{name,exact:true}).boundingBox();expect(b.width).toBeGreaterThanOrEqual(48);expect(b.height).toBeGreaterThanOrEqual(48);}}
 await rail.getByRole('button',{name:'Приблизить карту',exact:true}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wikimapia-reader-view')||'null')?.zoom)).toBe(17);
 await rail.getByRole('button',{name:'Найти место',exact:true}).click();await expect(page.getByRole('region',{name:'Поиск на карте',exact:true})).toBeVisible();
});
test('startup has a brand and honest status while native credentials are pending',async({page})=>{
 let release;const pending=new Promise(resolve=>release=resolve);await tiles(page);await nativeVault(page,{key:null,calls:[],beforeLoad:()=>pending});
 await page.goto('/');await expect(page.locator('.startup-symbol')).toBeVisible();await expect(page.getByRole('heading',{name:'WikiReader',exact:true})).toBeVisible();await expect(page.locator('.startup')).toContainText('Открываем карту');release();await expect(page.locator('.startup')).toHaveCount(0);await expect(page.locator('.map')).toBeVisible();
});
test('a partially loaded area exposes one 48px icon for continuation, not a large panel',async({page})=>{
 await tiles(page);await nativeVault(page,{key:'test-key',calls:[]});await page.route('https://api.wikimapia.org/**',r=>{const n=Number(new URL(r.request().url()).searchParams.get('page'));return r.fulfill({json:{folder:[{id:n,name:'Object '+n,polygon:[{x:37.617,y:55.751},{x:37.619,y:55.751},{x:37.619,y:55.753}]}],found:4}});});await page.goto('/');const more=page.getByRole('button',{name:'Догрузить область',exact:true});await expect(more).toBeVisible({timeout:20000});const b=await more.boundingBox();expect(b.width).toBe(48);expect(b.height).toBe(48);await expect(page.locator('.map-tools .area-action')).toHaveCount(1);await expect(page.locator('.map-feedback')).toHaveCount(0);
});

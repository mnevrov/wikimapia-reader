import {test,expect} from '@playwright/test';
import {tiles,nativeVault} from './helpers.js';

const polygon=[{x:37.617,y:55.751},{x:37.619,y:55.751},{x:37.619,y:55.753}];
const response=(page,found=3)=>({folder:[{id:page,name:'Object '+page,polygon}],found});
async function start(page,handler) {
 await tiles(page);
 await nativeVault(page,{key:'area-action-test',calls:[]});
 await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-auto','false'));
 await page.route('https://api.wikimapia.org/**',route=>handler(route,Number(new URL(route.request().url()).searchParams.get('page'))));
 await page.goto('/');
}

test('one action switches from download to busy spinner to refresh without duplicates',async({page})=>{
 let pending;
 await start(page,(route,n)=>n===2?(pending=route):route.fulfill({json:response(n)}));
 const action=page.locator('.map-tools .area-action');
 await expect(action).toHaveCount(1);
 await expect(action).toHaveAttribute('aria-label','Обновить область');
 await action.click();
 await expect(action).toHaveAttribute('aria-label','Догрузить область',{timeout:20000});
 await expect(action.locator('svg path')).toHaveAttribute('d',/M12 3v12/);
 await action.click();
 await expect(action).toHaveAttribute('aria-label','Догружаем область');
 await expect(action).toHaveAttribute('aria-busy','true');
 await expect(action).toBeDisabled();
 await page.getByRole('button',{name:'Список объектов области'}).click();
 await expect(page.getByRole('region',{name:'Объекты на карте'}).getByText('Догружаем: 1 из 3 объектов')).toBeVisible();
 await expect.poll(()=>!!pending).toBe(true);
 await pending.fulfill({json:response(2)});
 await expect(action).toHaveAttribute('aria-label','Обновить область',{timeout:25000});
 await expect(action).toBeEnabled();
 await expect(action).toHaveCount(1);
 await expect(page.getByRole('region',{name:'Объекты на карте'}).getByText('Получено 3 из 3 объектов')).toBeVisible();
});

test('the object panel keeps forced refresh even when continuation is available',async({page})=>{
 const pages=[];
 await start(page,(route,n)=>{pages.push(n);return route.fulfill({json:response(n,4)});});
 const action=page.locator('.map-tools .area-action');
 await expect(action).toHaveAttribute('aria-label','Обновить область');
 await action.click();
 await expect(action).toHaveAttribute('aria-label','Догрузить область',{timeout:20000});
 await page.getByRole('button',{name:'Список объектов области'}).click();
 await page.getByRole('button',{name:'Обновить область с сервера'}).click();
 await expect.poll(()=>pages.length,{timeout:25000}).toBe(2);
 expect(pages).toEqual([1,1]);
 await expect(action).toHaveCount(1);
});

test('a failed next page becomes retryable without discarding loaded objects',async({page})=>{
 let secondPageAttempts=0;
 await start(page,(route,n)=>{
   if(n===2&&++secondPageAttempts===1)return route.fulfill({status:503,json:{error:'Temporary outage'}});
   return route.fulfill({json:response(n)});
 });
 const action=page.locator('.map-tools .area-action');
 await expect(action).toHaveAttribute('aria-label','Обновить область');
 await action.click();
 await expect(action).toHaveAttribute('aria-label','Догрузить область',{timeout:20000});
 await action.click();
 await expect(action).toHaveAttribute('aria-label','Повторить догрузку',{timeout:25000});
 await expect(action).toHaveClass(/has-error/);
 await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
 await action.click();
 await expect(action).toHaveAttribute('aria-label','Обновить область',{timeout:25000});
 expect(secondPageAttempts).toBe(2);
});

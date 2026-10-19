import {test,expect} from '@playwright/test';
import {tiles,screen,map} from './helpers.js';

const key='00000000-1111-4222-8333-444444444444';
async function setup(page,handler){
 await tiles(page);
 await page.route('https://api-maps.yandex.ru/v3/**',handler);
 await page.goto('/');
 await screen(page,'Настройки');
 await page.locator('#yandex-api-key').fill(key);
 await page.locator('#yandex-referer').check();
 await page.getByRole('button',{name:'Яндекс Карты'}).click();
 await map(page);
 await screen(page,'Настройки');
}
test('network/script error has precise safe diagnosis while OSM remains usable',async({page})=>{
 await setup(page,r=>r.abort('failed'));
 const card=page.getByRole('status',{name:'Диагностика подключения Яндекс Карт'});
 await expect(card).toBeVisible();
 await expect(card).toContainText('script-load-error');
 await expect(card).toContainText('api-maps.yandex.ru');
 await expect(card).toContainText('Адрес страницы WebView: http://127.0.0.1:5173');
 await expect(page.getByRole('button',{name:'OpenStreetMap'})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('path.leaflet-interactive').first()).toBeVisible();
 const text=await card.innerText();
 expect(text).not.toContain(key);
});
test('repeated attempt without waiting has a useful cooldown code',async({page})=>{
 let requests=0;
 await setup(page,r=>{requests++;return r.abort('failed');});
 const card=page.getByRole('status',{name:'Диагностика подключения Яндекс Карт'});
 await expect(card).toContainText('script-load-error');
 await page.getByRole('button',{name:'Яндекс Карты'}).click();
 await expect(card).toContainText('retry-cooldown');
 await expect(card).toContainText('script-load-error');
 expect(requests).toBe(1);
});
test('SDK ready rejection is different from JS load failure',async({page})=>{
 await setup(page,r=>r.fulfill({status:200,contentType:'text/javascript',body:"window.ymaps3={ready:Promise.reject(new Error('third-party rejected'))};"}));
 await expect(page.getByRole('status',{name:'Диагностика подключения Яндекс Карт'})).toContainText('sdk-ready-error');
});
test('map constructor failure is reported separately from connectivity',async({page})=>{
 await setup(page,r=>r.fulfill({status:200,contentType:'text/javascript',body:"window.ymaps3={ready:Promise.resolve(),YMap:class{constructor(){throw Error('WebGL unsupported')}},YMapDefaultSchemeLayer:class{}};"}));
 await expect(page.getByRole('status',{name:'Диагностика подключения Яндекс Карт'})).toContainText('sdk-map-error');
});

import {test,expect} from '@playwright/test';
import {tiles,screen,map,clickContour} from './helpers.js';
const testKey='00000000-1111-4222-8333-444444444444';
async function configure(page){
 await screen(page,'Настройки');
 await page.locator('#yandex-api-key').fill(testKey);
 await page.locator('#yandex-referer').check();
}
test.beforeEach(async({page})=>{await tiles(page);});
test('Yandex SDK is not downloaded unless user explicitly enables it',async({page})=>{
 let loads=0;
 await page.route('https://api-maps.yandex.ru/**',r=>{loads++;return r.abort();});
 await page.goto('/');
 await configure(page);
 await map(page);
 await clickContour(page);
 await page.getByRole('button',{name:'Открыть режим чтения'}).click();
 await page.getByRole('button',{name:'Закрыть режим чтения'}).click();
 expect(loads).toBe(0);
});
test('mock Yandex dark underlay keeps Leaflet polygons and uses one SDK load',async({page})=>{
 let loads=0;
 await page.route('https://api-maps.yandex.ru/v3/**',r=>{
  loads++;
  return r.fulfill({status:200,contentType:'text/javascript',body:`
   window.ymaps3={
    ready:Promise.resolve(),
    YMap:class{
     constructor(host,config){this.host=host;this.config=config;host.dataset.mockYandex='loaded';host.dataset.mockTheme=config.theme;}
     addChild(){return this;}
     update(props){if(props.theme)this.host.dataset.mockTheme=props.theme;this.config={...this.config,...props};}
     destroy(){this.host.removeAttribute('data-mock-yandex');}
    },
    YMapDefaultSchemeLayer:class{}
   };
  `});
 });
 await page.goto('/');
 await configure(page);
 await page.getByRole('button',{name:'Яндекс · тёмная карта'}).click();
 await map(page);
 await expect(page.locator('.map-stack.has-yandex')).toBeVisible();
 await expect(page.locator('.yandex-underlay')).toHaveAttribute('data-mock-yandex','loaded');
 await expect(page.locator('.yandex-underlay')).toHaveAttribute('data-mock-theme','dark');
 await expect(page.locator('path.leaflet-interactive').first()).toBeVisible();
 await clickContour(page);
 await expect(page.locator('.sheet')).toBeVisible();
 await page.getByRole('button',{name:'Закрыть карточку'}).click();
 await screen(page,'Настройки');await map(page);
 expect(loads).toBe(1);
 await screen(page,'Настройки');
 await page.getByRole('button',{name:'Светлая',exact:true}).click();
 await map(page);
 await expect(page.locator('.yandex-underlay')).toHaveAttribute('data-mock-theme','light');
 await screen(page,'Настройки');
 await page.getByRole('button',{name:'OpenStreetMap'}).click();
 await map(page);
 await expect(page.locator('.map-stack')).not.toHaveClass(/has-yandex/);
 expect(loads).toBe(1);
});
test('Yandex request error safely restores OSM without retry storm',async({page})=>{
 let loads=0;
 await page.route('https://api-maps.yandex.ru/v3/**',r=>{loads++;return r.abort('failed');});
 await page.goto('/');
 await configure(page);
 await page.getByRole('button',{name:'Яндекс · тёмная карта'}).click();
 await map(page);
 await expect(page.locator('.map-stack')).not.toHaveClass(/has-yandex/);
 await screen(page,'Настройки');
 await expect(page.getByRole('button',{name:'OpenStreetMap'})).toHaveAttribute('aria-pressed','true');
 expect(loads).toBe(1);
});

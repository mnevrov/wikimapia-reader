import {test,expect} from '@playwright/test';
import {screen,map,tiles} from './helpers.js';

const key='00000000-1111-4222-8333-444444444444';
async function mockYandex(page){
 let loads=0;
 await page.route('https://api-maps.yandex.ru/v3/**',route=>{
  loads++;
  return route.fulfill({status:200,contentType:'text/javascript',body:`
   window.__yandexMapConstructions=0;
   window.__yandexMapThemeUpdates=0;
   window.__yandexSchemeThemeUpdates=0;
   window.ymaps3={
     ready:Promise.resolve(),
     YMap:class{
       constructor(host,options){
         this.host=host;this.options=options;
         window.__yandexMapConstructions++;
         host.dataset.mapTheme=options.theme;
         host.dataset.mapCreated=String(window.__yandexMapConstructions);
       }
       addChild(layer){this.layer=layer;return this;}
       update(props){
         if(props.theme){
           window.__yandexMapThemeUpdates++;
           this.host.dataset.mapTheme=props.theme;
         }
         this.options={...this.options,...props};
       }
       destroy(){this.host.dataset.destroyed='true';}
     },
     YMapDefaultSchemeLayer:class{
       constructor(options){this.options=options;document.querySelector('.yandex-underlay').dataset.schemeTheme=options.theme;}
       update(props){
         window.__yandexSchemeThemeUpdates++;
         this.options={...this.options,...props};
         document.querySelector('.yandex-underlay').dataset.schemeTheme=this.options.theme;
       }
     }
   };
  `});
 });
 return ()=>loads;
}
async function enableYandex(page){
 await screen(page,'Настройки');
 await page.locator('#yandex-api-key').fill(key);
 await page.locator('#yandex-referer').check();
 await page.getByRole('button',{name:'Яндекс Карты'}).click();
 await map(page);
 await expect(page.locator('.map-stack.has-yandex')).toBeVisible();
}
async function expectTheme(page,theme){
 await expect(page.locator('.yandex-underlay')).toHaveAttribute('data-map-theme',theme);
 await expect(page.locator('.yandex-underlay')).toHaveAttribute('data-scheme-theme',theme);
}
test.beforeEach(async({page})=>tiles(page));
test('dark by default; light and dark app settings update both YMap and map layer without new SDK downloads',async({page})=>{
 const loads=await mockYandex(page);
 await page.goto('/');
 await enableYandex(page);
 await expectTheme(page,'dark');
 await screen(page,'Настройки');
 await page.getByRole('button',{name:'Светлая',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expectTheme(page,'light');
 await page.getByRole('button',{name:'Чёрная',exact:true}).click();
 await expectTheme(page,'dark');
 await map(page);
 await expect(page.locator('path.leaflet-interactive').first()).toBeVisible();
 expect(loads()).toBe(1);
 const count=await page.evaluate(()=>({maps:window.__yandexMapConstructions,mapTheme:window.__yandexMapThemeUpdates,schemeTheme:window.__yandexSchemeThemeUpdates}));
 expect(count.maps).toBe(1);
 expect(count.mapTheme).toBe(2);
 expect(count.schemeTheme).toBe(2);
});
test('Yandex loads directly with light palette when app theme is light',async({page})=>{
 const loads=await mockYandex(page);
 await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-theme','light'));
 await page.goto('/');
 await enableYandex(page);
 await expectTheme(page,'light');
 expect(loads()).toBe(1);
 expect(await page.evaluate(()=>window.__yandexSchemeThemeUpdates)).toBe(0);
});
test('system theme changes recolor Yandex without API reload, repeated same theme is a no-op',async({page})=>{
 const loads=await mockYandex(page);
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('/');
 await screen(page,'Настройки');
 await page.getByRole('button',{name:'Как в системе',exact:true}).click();
 await page.locator('#yandex-api-key').fill(key);
 await page.locator('#yandex-referer').check();
 await page.getByRole('button',{name:'Яндекс Карты'}).click();
 await map(page);
 await expectTheme(page,'light');
 await page.emulateMedia({colorScheme:'dark'});
 await expectTheme(page,'dark');
 await page.emulateMedia({colorScheme:'light'});
 await expectTheme(page,'light');
 const counters=await page.evaluate(()=>({map:window.__yandexMapThemeUpdates,scheme:window.__yandexSchemeThemeUpdates,instances:window.__yandexMapConstructions}));
 expect(counters).toEqual({map:2,scheme:2,instances:1});
 expect(loads()).toBe(1);
});

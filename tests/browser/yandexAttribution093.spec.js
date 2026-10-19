import {test,expect} from '@playwright/test';
import {tiles,screen,map} from './helpers.js';

// Only the real Yandex JavaScript SDK is allowed to provide map copyrights,
// logo and legal links. The application's duplicate credit is never rendered.
test('Yandex attribution is SDK-owned and not duplicated by WikiReader',async({page})=>{
 await tiles(page);
 let sdkLoads=0;
 await page.route('https://api-maps.yandex.ru/v3/**',r=>{
  sdkLoads++;
  return r.fulfill({status:200,contentType:'text/javascript',body:`
   window.ymaps3={
    ready:Promise.resolve(),
    YMap:class{
     constructor(host){
       this.host=host;
       const branding=document.createElement('div');
       branding.className='mock-sdk-attribution';
       branding.innerHTML='<a href="https://yandex.ru/maps/">Яндекс Карты</a><a href="https://yandex.ru/legal/maps_termsofuse/">Условия использования</a>';
       host.appendChild(branding);
     }
     addChild(){return this;}
     update(){}
     destroy(){this.host.replaceChildren();}
    },
    YMapDefaultSchemeLayer:class{update(){}}
   };
  `});
 });
 await page.goto('/');
 await screen(page,'Настройки');
 await page.locator('#yandex-api-key').fill('00000000-1111-4222-8333-444444444444');
 await page.locator('#yandex-referer').check();
 await page.getByRole('button',{name:'Яндекс Карты'}).click();
 await map(page);
 await expect(page.locator('.map-stack.has-yandex')).toBeVisible();
 await expect(page.locator('.yandex-underlay .mock-sdk-attribution')).toBeVisible();
 await expect(page.locator('.yandex-underlay .mock-sdk-attribution a')).toHaveCount(2);
 await expect(page.locator('.yandex-provider-link')).toHaveCount(0);
 await expect(page.locator('.leaflet-control-attribution')).toBeHidden();
 expect(sdkLoads).toBe(1);

 await screen(page,'Настройки');
 await page.getByRole('button',{name:'Светлая',exact:true}).click();
 await map(page);
 await expect(page.locator('.map-stack.has-yandex')).toBeVisible();
 await expect(page.locator('.yandex-underlay .mock-sdk-attribution')).toBeVisible();
 await expect(page.locator('.yandex-provider-link')).toHaveCount(0);
 expect(sdkLoads).toBe(1);

 await screen(page,'Настройки');
 await page.getByRole('button',{name:'OpenStreetMap'}).click();
 await map(page);
 await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
 await expect(page.locator('.yandex-provider-link')).toHaveCount(0);
});

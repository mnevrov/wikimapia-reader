import {test,expect} from '@playwright/test';
import {tiles,screen,map,clickContour} from './helpers.js';

// Regression: SDK copyright elements keep their own native appearance.
// WikiReader must not change their size/opacity/position or duplicate branding.
test('Yandex SDK legal controls are not restyled; map notices do not cover lower corners',async({page})=>{
 await tiles(page);
 await page.route('https://api-maps.yandex.ru/v3/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:`
   window.ymaps3={ready:Promise.resolve(),
    YMap:class{
      constructor(host){
        this.host=host;
        const legal=document.createElement('div');
        legal.className='mock-yandex-legal';
        legal.style.cssText='position:absolute;bottom:8px;left:8px;z-index:1';
        const link=document.createElement('a');
        link.href='https://yandex.ru/legal/maps_termsofuse/';
        link.textContent='Условия Яндекс Карт';
        legal.append(link);
        const button=document.createElement('button');
        button.textContent='Открыть в Картах';
        button.className='mock-yandex-button';
        legal.append(button);
        host.append(legal);
      }
      addChild(){return this;}
      update(){}
      destroy(){this.host.replaceChildren();}
    },
    YMapDefaultSchemeLayer:class{update(){}}
   };
 `}));
 await page.goto('/');
 await screen(page,'Настройки');
 await page.locator('#yandex-api-key').fill('00000000-1111-4222-8333-444444444444');
 await page.locator('#yandex-referer').check();
 await page.getByRole('button',{name:'Яндекс Карты'}).click();
 await map(page);
 await expect(page.locator('.map-stack.has-yandex')).toBeVisible();
 const styles=await page.evaluate(()=>{
  const legal=document.querySelector('.mock-yandex-legal');
  const button=legal.querySelector('button'),link=legal.querySelector('a');
  const appButton=document.querySelector('.map-tools button');
  return {
   buttonBorder:getComputedStyle(button).borderTopStyle,
   sdkTouch:getComputedStyle(button).touchAction,
   linkDecoration:getComputedStyle(link).textDecorationLine,
   sdkTransform:getComputedStyle(legal).transform,
   sdkOpacity:getComputedStyle(legal).opacity,
   appTouch:getComputedStyle(appButton).touchAction,
   appHeight:Math.round(appButton.getBoundingClientRect().height)
  };
 });
 expect(styles.buttonBorder).not.toBe('none');
 expect(styles.sdkTouch).toBe('auto');
 expect(styles.linkDecoration).toContain('underline');
 expect(styles.sdkTransform).toBe('none');
 expect(styles.sdkOpacity).toBe('1');
 expect(styles.appTouch).toBe('manipulation');
 expect(styles.appHeight).toBeGreaterThanOrEqual(48);
 await page.evaluate(()=>{
   const notice=document.createElement('div');
   notice.className='map-feedback';
   notice.textContent='Загрузка области завершена';
   document.querySelector('.map-stage').append(notice);
 });
 const bounds=await page.evaluate(()=>{
  const legal=document.querySelector('.mock-yandex-legal').getBoundingClientRect();
  const notice=document.querySelector('.map-stage>.map-feedback').getBoundingClientRect();
  return{noticeAbove:notice.bottom<legal.top,noticeTop:notice.top,legalTop:legal.top};
 });
 expect(bounds.noticeAbove).toBe(true);
 await screen(page,'Настройки');
 await page.getByRole('button',{name:'OpenStreetMap'}).click();
 await map(page);
 await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
});

test('scoped CSS resets do not override touch handling of the details sheet',async({page})=>{
 await tiles(page);
 await page.goto('/');
 await clickContour(page);
 await expect(page.locator('.sheet')).toBeVisible();
 await expect(page.locator('.handle')).toHaveCSS('touch-action','none');
});

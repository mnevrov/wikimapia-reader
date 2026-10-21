import {test,expect} from '@playwright/test';
import {tiles,screen,map,clickContour} from './helpers.js';

// Regression: SDK copyright elements keep their own native appearance.
// WikiReader must not change their size/opacity/position or duplicate branding.
test('Yandex SDK legal controls are not restyled; map notices do not cover lower corners',async({page})=>{
 await tiles(page);
 await page.route('https://api-maps.yandex.ru/v3/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:`
   window.ymaps3={ready:Promise.resolve(),
    YMap:class{
      constructor(host,options){
        this.host=host;
        host.dataset.distributionPosition=options.distributionPosition;
        host.dataset.copyrightsPosition=options.copyrightsPosition;
        const legal=document.createElement('div');
        legal.className='mock-yandex-legal';
        legal.style.cssText='position:absolute;top:8px;left:8px;z-index:1';
        const link=document.createElement('a');
        link.href='https://yandex.ru/legal/maps_termsofuse/';
        link.textContent='Условия Яндекс Карт';
        legal.append(link);
        const button=document.createElement('button');
        button.textContent='Открыть в Картах';
        button.className='mock-yandex-button';
        legal.append(button);
        const copyrights=document.createElement('div');
        copyrights.className='mock-yandex-copyrights';
        copyrights.style.cssText='position:absolute;bottom:8px;right:8px;width:160px;height:32px;display:grid;place-items:center;z-index:1';
        copyrights.textContent='© Яндекс';
        host.append(legal,copyrights);
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
 await expect(page.locator('.yandex-underlay')).toHaveAttribute('data-distribution-position','top left');
 await expect(page.locator('.yandex-underlay')).toHaveAttribute('data-copyrights-position','bottom right');
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
  const copyrights=document.querySelector('.mock-yandex-copyrights').getBoundingClientRect();
  const stage=document.querySelector('.map-stage').getBoundingClientRect();
  const notice=document.querySelector('.map-stage>.map-feedback').getBoundingClientRect();
  const tools=document.querySelector('.map-tools').getBoundingClientRect();
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  return{noticeVsLogo:overlaps(notice,legal),toolsVsCopy:overlaps(tools,copyrights),toolsVsLogo:overlaps(tools,legal),logoVsCopy:overlaps(legal,copyrights),toolsTop:tools.top,copyGap:copyrights.top-tools.bottom,noticeBottomGap:stage.bottom-notice.bottom};
 });
 expect(bounds.noticeVsLogo).toBe(false);
 expect(bounds.noticeBottomGap).toBeGreaterThanOrEqual(76);
 expect(bounds.toolsVsCopy).toBe(false);
 expect(bounds.toolsVsLogo).toBe(false);
 expect(bounds.toolsTop).toBeGreaterThanOrEqual(8);
 expect(bounds.logoVsCopy).toBe(false);
 expect(bounds.copyGap).toBeGreaterThanOrEqual(16);
 // A warning goes to the top LEFT, below the provider logo and away from tools.
 await page.locator('.map-stage>.map-feedback').first().evaluate(node=>node.classList.add('is-error'));
 const warning=await page.evaluate(()=>{
  const stage=document.querySelector('.map-stage').getBoundingClientRect();
  const n=document.querySelector('.map-stage>.map-feedback').getBoundingClientRect();
  const logo=document.querySelector('.mock-yandex-legal').getBoundingClientRect();
  const copy=document.querySelector('.mock-yandex-copyrights').getBoundingClientRect();
  const toolbar=document.querySelector('.map-tools').getBoundingClientRect();
  const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  return {top:n.top-stage.top,inside:n.top>=stage.top&&n.bottom<=stage.bottom,
   logo:hit(n,logo),copyright:hit(n,copy),toolbar:hit(n,toolbar)};
 });
 expect(warning.top).toBeGreaterThanOrEqual(80);
 expect(warning.top).toBeLessThan(160);
 expect(warning.inside).toBe(true);
 expect(warning.logo).toBe(false);
 expect(warning.copyright).toBe(false);
 expect(warning.toolbar).toBe(false);
 await page.locator('.map-stage>.map-feedback').first().evaluate(node=>node.classList.remove('is-error'));
 // Landscape should retain the same clearance without off-screen controls.
 await page.setViewportSize({width:844,height:390});
 const landscape=await page.evaluate(()=>{
  const a=document.querySelector('.map-tools').getBoundingClientRect();
  const b=document.querySelector('.mock-yandex-copyrights').getBoundingClientRect();
  const logo=document.querySelector('.mock-yandex-legal').getBoundingClientRect();
  const overlaps=(x,y)=>x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;
  return {top:a.top,bottom:a.bottom,copyTop:b.top,overlapLogo:overlaps(a,logo),overlapCopyright:overlaps(a,b),columns:getComputedStyle(document.querySelector('.map-tools')).gridTemplateColumns};
 });
 expect(landscape.bottom).toBeLessThan(landscape.copyTop-16);
 expect(landscape.overlapLogo).toBe(false);
 expect(landscape.overlapCopyright).toBe(false);
 expect(landscape.top).toBeGreaterThanOrEqual(8);
 expect(landscape.top).toBeLessThan(60);
 expect(landscape.columns.split(' ').length).toBe(3);
 await page.setViewportSize({width:390,height:844});
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

import {test,expect} from '@playwright/test';
import {tiles} from './helpers.js';

test.use({reducedMotion:'reduce'});

test('all map statuses share one top-left position alongside toolbar and beneath Yandex controls',async({page})=>{
 await tiles(page);await page.goto('/');
 const feedback=page.locator('.map-stage>.map-feedback');
 await expect(feedback).toBeVisible();
 const measure=async()=>page.evaluate(()=>{
   const stage=document.querySelector('.map-stage').getBoundingClientRect();
   const banner=document.querySelector('.map-stage>.map-feedback').getBoundingClientRect();
   const tools=document.querySelector('.map-tools').getBoundingClientRect();
   const nav=document.querySelector('.bottom-nav').getBoundingClientRect();
   const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
   return {top:banner.top-stage.top,left:banner.left-stage.left,bottom:banner.bottom-stage.top,
     height:banner.height,inside:banner.top>=stage.top&&banner.bottom<=stage.bottom,
     hitsTools:intersects(banner,tools),hitsNav:intersects(banner,nav)};
 });
 for(const [width,height] of [[390,844],[320,640],[844,390]]){
   await page.setViewportSize({width,height});
   for(const yandex of [false,true]){
     await page.locator('.map-stack').evaluate((node,active)=>node.classList.toggle('has-yandex',active),yandex);
     const info=await measure();
     expect(info.top).toBeGreaterThanOrEqual(yandex?80:8);
     expect(info.top).toBeLessThan(yandex?105:35);
     expect(info.left).toBeGreaterThanOrEqual(8);
     expect(info.inside).toBe(true);
     expect(info.hitsTools).toBe(false);
     expect(info.hitsNav).toBe(false);
     expect(info.height).toBeLessThan(145);
     await feedback.evaluate(node=>node.classList.add('is-error'));
     const warning=await measure();
     expect(Math.abs(warning.top-info.top)).toBeLessThan(5);
     expect(Math.abs(warning.left-info.left)).toBeLessThan(2);
     expect(warning.hitsTools).toBe(false);
     await feedback.evaluate(node=>node.classList.remove('is-error'));
   }
 }
});

test('network hint uses same slot and suppresses map feedback rather than overlapping it',async({page})=>{
 await tiles(page);await page.goto('/');
 await expect(page.locator('.map-stage>.map-feedback')).toBeVisible();
 const result=await page.evaluate(()=>{
   const status=document.querySelector('.map-feedback');
   const hint=document.createElement('div');hint.className='network-hint';hint.textContent='Нет подключения';
   document.querySelector('.map-stage').append(hint);
   const sharedTop=getComputedStyle(hint).top===getComputedStyle(status).top;
   const hidden=getComputedStyle(status).display==='none';
   hint.remove();
   return {sharedTop,hidden,restored:getComputedStyle(status).display!=='none'};
 });
 expect(result).toEqual({sharedTop:true,hidden:true,restored:true});
});

test('map confirmation/undo feedback also appears in the same top slot',async({page})=>{
 await tiles(page);await page.goto('/');
 await expect(page.locator('.map-stage>.map-feedback')).toBeVisible();
 const result=await page.evaluate(()=>{
   const main=document.querySelector('main'),status=document.querySelector('.map-feedback');
   const initial=getComputedStyle(status).visibility;
   main.classList.add('has-toast');
   const toast=document.createElement('div');toast.className='toast';toast.textContent='Готово';main.append(toast);
   const withToast=getComputedStyle(status).visibility;
   const sameTop=getComputedStyle(toast).top===getComputedStyle(status).top;
   const undo=document.createElement('div');undo.className='undo-toast';undo.textContent='Вернуть';main.append(undo);
   const withUndo=getComputedStyle(status).visibility;
   const undoSameTop=getComputedStyle(undo).top===getComputedStyle(status).top;
   const toastHidden=getComputedStyle(toast).visibility==='hidden';
   toast.remove();undo.remove();main.classList.remove('has-toast');
   return {initial,withToast,withUndo,sameTop,undoSameTop,toastHidden,restored:getComputedStyle(status).visibility};
 });
 expect(result).toEqual({initial:'visible',withToast:'hidden',withUndo:'hidden',sameTop:true,
    undoSameTop:true,toastHidden:true,restored:'visible'});
});

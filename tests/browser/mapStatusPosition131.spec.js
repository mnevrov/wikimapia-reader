import {test,expect} from '@playwright/test';
import {tiles} from './helpers.js';

// Geometry assertions must inspect the final position, not the 140 ms entrance transform.
test.use({reducedMotion:'reduce'});

test('persistent map status stays in lower-left safe zone on portrait and landscape OSM',async({page})=>{
 await tiles(page);await page.setViewportSize({width:390,height:844});await page.goto('/');
 const feedback=page.locator('.map-stage .map-feedback').first();await expect(feedback).toBeVisible();
 for(const [width,height] of [[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  const bounds=await page.evaluate(()=>{
   const stage=document.querySelector('.map-stage').getBoundingClientRect();
   const status=document.querySelector('.map-feedback').getBoundingClientRect();
   const tools=document.querySelector('.map-tools').getBoundingClientRect();
   const nav=document.querySelector('.bottom-nav').getBoundingClientRect();
   const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
   return {gap:stage.bottom-status.bottom,inside:status.top>=stage.top&&status.bottom<=stage.bottom,
    overlapTools:overlaps(status,tools),overlapNav:overlaps(status,nav)};
  });
  expect(bounds.inside).toBe(true);
  expect(bounds.gap).toBeGreaterThanOrEqual(height<500?42:76);
  expect(bounds.overlapTools).toBe(false);
  expect(bounds.overlapNav).toBe(false);
 }
});

test('confirmation and undo toasts take priority over background map status',async({page})=>{
 await tiles(page);await page.goto('/');
 const feedback=page.locator('.map-stage .map-feedback').first();await expect(feedback).toBeVisible();
 const result=await page.evaluate(()=>{
  const main=document.querySelector('main'),status=document.querySelector('.map-feedback');
  const initial=getComputedStyle(status).visibility;
  main.classList.add('has-toast');const withToast=getComputedStyle(status).visibility;
  main.classList.remove('has-toast');
  const undo=document.createElement('div');undo.className='undo-toast';main.append(undo);
  const withUndo=getComputedStyle(status).visibility;
  undo.remove();const restored=getComputedStyle(status).visibility;
  return {initial,withToast,withUndo,restored};
 });
 expect(result).toEqual({initial:'visible',withToast:'hidden',withUndo:'hidden',restored:'visible'});
});

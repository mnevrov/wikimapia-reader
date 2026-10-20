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
  // Pixel differences during animations/compositing must not be interpreted as
  // real overlap. Assert safe *zone*, not a brittle exact CSS offset.
  expect(bounds.gap).toBeGreaterThanOrEqual(height<500?30:60);
  expect(bounds.gap).toBeLessThanOrEqual(height<500?80:120);
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

test('warning moves to upper-left safe slot while normal progress stays below',async({page})=>{
 await tiles(page);await page.goto('/');
 const status=page.locator('.map-stage>.map-feedback').first();
 await expect(status).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 const box=async()=>page.evaluate(()=>{
  const p=document.querySelector('.map-stage>.map-feedback').getBoundingClientRect();
  const m=document.querySelector('.map-stage').getBoundingClientRect();
  const b=document.querySelector('.map-tools').getBoundingClientRect();
  const nav=document.querySelector('.bottom-nav').getBoundingClientRect();
  const hit=(x,y)=>x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;
  return {top:p.top-m.top,bottom:m.bottom-p.bottom,inMap:p.top>=m.top&&p.bottom<=m.bottom,
    hitToolbar:hit(p,b),hitNav:hit(p,nav)};
 });
 const progress=await box();
 expect(progress.bottom).toBeGreaterThan(55);
 await status.evaluate(node=>node.classList.add('is-error'));
 for(const [width,height] of [[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  const warning=await box();
  expect(warning.inMap).toBe(true);
  expect(warning.top).toBeGreaterThanOrEqual(8);
  expect(warning.top).toBeLessThan(40);
  expect(warning.hitToolbar).toBe(false);
  expect(warning.hitNav).toBe(false);
 }
 await status.evaluate(node=>node.classList.remove('is-error'));
 expect((await box()).bottom).toBeGreaterThan(25);
});

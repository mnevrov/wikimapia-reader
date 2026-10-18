import {test,expect} from '@playwright/test';
import {tiles,screen,clickContour,connect} from './helpers.js';
async function watch(page){await tiles(page);await page.addInitScript(()=>{window.motionExits=[];new MutationObserver(records=>{for(const r of records){const el=r.target;if(r.type==='attributes'&&el.matches?.('.motion-layer[data-phase="exit"]'))window.motionExits.push({kind:el.dataset.motion,inert:el.inert,hidden:el.getAttribute('aria-hidden'),children:el.childElementCount});}}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-phase']});});}
test('card exits visibly but becomes inert and hidden from accessibility immediately',async({page})=>{
 await watch(page);await page.goto('/');await clickContour(page);await page.getByLabel('Закрыть карточку').click();await expect(page.locator('.sheet')).toHaveCount(0);const exits=await page.evaluate(()=>window.motionExits);expect(exits.some(e=>e.kind==='sheet'&&e.inert&&e.hidden==='true'&&e.children>0)).toBe(true);
});
test('rapid screen changes and reopening cancel stale exit completion',async({page})=>{
 await watch(page);await page.goto('/');await screen(page,'Настройки');await screen(page,'Поиск');await screen(page,'Избранное');await screen(page,'Карта');await screen(page,'Настройки');await page.waitForTimeout(350);await expect(page.locator('.app-screen')).toHaveCount(1);await expect(page.locator('.settings-panel')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.app-screen')).toHaveCount(0);expect((await page.evaluate(()=>window.motionExits)).some(e=>e.kind==='screen'&&e.inert)).toBe(true);
});
test('reduced motion skips entrance and exit transitions',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await watch(page);await page.goto('/');await clickContour(page);await expect(page.locator('[data-motion="sheet"]')).toHaveAttribute('data-phase','idle');expect(await page.locator('[data-motion="sheet"]').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);await page.getByLabel('Закрыть карточку').click();await expect(page.locator('.sheet')).toHaveCount(0);expect(await page.evaluate(()=>window.motionExits.length)).toBe(0);
});
test('disclosure animates both directions and keeps native summary behavior',async({page})=>{
 await watch(page);await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{folder:[],found:0}}));await page.goto('/');await connect(page);await screen(page,'Поиск');const summary=page.locator('.id-disclosure summary');await summary.click();await expect(page.locator('#place-id')).toBeVisible();await summary.click();await expect(page.locator('.open-id')).toHaveCount(0);await expect(page.locator('.id-disclosure')).not.toHaveAttribute('open');expect((await page.evaluate(()=>window.motionExits)).some(e=>e.kind==='disclosure'&&e.inert)).toBe(true);
});
test('reversing a disclosure exit preserves the reopened content and keyboard works',async({page})=>{
 await watch(page);await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{folder:[],found:0}}));await page.goto('/');await connect(page);await screen(page,'Поиск');const summary=page.locator('.id-disclosure summary');await summary.focus();await page.keyboard.press('Enter');await expect(page.locator('#place-id')).toBeVisible();await summary.click();await summary.click();await page.waitForTimeout(300);await expect(page.locator('#place-id')).toBeVisible();await expect(summary).toHaveAttribute('aria-expanded','true');
});
test('backgrounding completes an exit and reduced motion can change at runtime',async({page})=>{
 await watch(page);await page.goto('/');await clickContour(page);await page.getByLabel('Закрыть карточку').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('.sheet')).toHaveCount(0);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await screen(page,'Настройки');await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('[data-motion="screen"]')).toHaveAttribute('data-phase','idle');expect(await page.locator('[data-motion="screen"]').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
});
test('reversing a screen transition continues from its current opacity',async({page})=>{
 await watch(page);await page.goto('/');await screen(page,'Настройки');
 const result=await page.evaluate(async()=>{
  const panel=document.querySelector('.app-screen'),animation=panel.getAnimations()[0];animation.currentTime=30;
  const before=Number(getComputedStyle(panel).opacity);panel.querySelector('[aria-label="Вернуться на карту"]').click();await new Promise(requestAnimationFrame);
  const closing=Number(getComputedStyle(panel).opacity);document.querySelector('.bottom-nav button:last-child').click();await new Promise(requestAnimationFrame);
  return {before,closing,reopened:Number(getComputedStyle(document.querySelector('.app-screen')).opacity)};
 });
 expect(Math.abs(result.closing-result.before)).toBeLessThan(.25);expect(Math.abs(result.reopened-result.closing)).toBeLessThan(.25);await page.waitForTimeout(300);await expect(page.locator('.settings-panel')).toBeVisible();
});

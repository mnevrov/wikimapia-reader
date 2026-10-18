import {test,expect} from '@playwright/test';
import {tiles,clickContour,connect,openId} from './helpers.js';
async function ready(page){await tiles(page);await page.goto('/');await clickContour(page);await expect(page.locator('[data-motion=sheet]')).toHaveAttribute('data-phase','idle');}
async function start(page){const b=await page.locator('.handle').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();return {x:b.x+b.width/2,y:b.y+b.height/2};}
test('sheet follows downward drag and short release returns without closing',async({page})=>{
 await ready(page);const top=(await page.locator('.sheet').boundingBox()).y,p=await start(page);await page.mouse.move(p.x,p.y+22,{steps:5});expect((await page.locator('.sheet').boundingBox()).y-top).toBeGreaterThan(15);await page.waitForTimeout(150);await page.mouse.up();await expect.poll(async()=>Math.abs((await page.locator('.sheet').boundingBox()).y-top)).toBeLessThan(2);await expect(page.locator('.sheet')).toHaveCount(1);
});
test('dismissal continues from dragged position without a backward jump',async({page})=>{
 await ready(page);const p=await start(page);await page.mouse.move(p.x,p.y+125,{steps:10});const before=(await page.locator('.sheet').boundingBox()).y;await page.mouse.up();const after=await page.locator('.sheet').boundingBox();if(after)expect(after.y).toBeGreaterThanOrEqual(before-2);await expect(page.locator('.sheet')).toHaveCount(0);
});
test('expanded sheet follows drag and settles to collapsed height',async({page})=>{
 await ready(page);await page.locator('.handle').click();await page.waitForTimeout(280);const height=(await page.locator('.sheet').boundingBox()).height,p=await start(page);await page.mouse.move(p.x,p.y+90,{steps:8});expect((await page.locator('.sheet').boundingBox()).height).toBeLessThan(height-60);await page.mouse.up();await expect(page.locator('.sheet')).not.toHaveClass(/expanded/);await page.waitForTimeout(300);expect((await page.locator('.sheet').boundingBox()).height).toBeLessThan(height-60);
});
test('pointer cancellation returns sheet without closing',async({page})=>{
 await ready(page);const top=(await page.locator('.sheet').boundingBox()).y,p=await start(page);await page.mouse.move(p.x,p.y+35);await page.locator('.handle').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await expect.poll(async()=>Math.abs((await page.locator('.sheet').boundingBox()).y-top)).toBeLessThan(2);await expect(page.locator('.sheet')).toHaveCount(1);
});

test('return to search keeps outgoing sheet visible until exit completes',async({page})=>{
 await tiles(page);await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-auto','false'));await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{id:55,title:'Place',description:'Description'}}));await page.goto('/');await connect(page);await openId(page);await expect(page.locator('.description')).toHaveText('Description');
 const visible=await page.evaluate(async()=>{document.querySelector('[aria-label="Закрыть карточку"]').click();await new Promise(requestAnimationFrame);const sheet=document.querySelector('.sheet');return sheet&&getComputedStyle(sheet).visibility==='visible'&&sheet.closest('.motion-layer').inert;});expect(visible).toBe(true);await expect(page.locator('.sheet')).toHaveCount(0);await expect(page.locator('.search-page')).toBeVisible();
});
test('touch drag follows the finger and dismisses after release',async({page,context})=>{
 await ready(page);const session=await context.newCDPSession(page),b=await page.locator('.handle').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,top=(await page.locator('.sheet').boundingBox()).y;
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+110}]});expect((await page.locator('.sheet').boundingBox()).y-top).toBeGreaterThan(90);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('.sheet')).toHaveCount(0);
});
test('scrolling the description preserves sheet anchor and reduced motion has no settling animation',async({page})=>{
 await ready(page);const top=(await page.locator('.sheet').boundingBox()).y;await page.locator('.sheet-scroll').hover();await page.mouse.wheel(0,150);expect((await page.locator('.sheet').boundingBox()).y).toBeCloseTo(top,0);await page.emulateMedia({reducedMotion:'reduce'});const p=await start(page);await page.mouse.move(p.x,p.y+18);await page.mouse.up();expect(await page.locator('.sheet').evaluate(el=>el.getAnimations().length)).toBe(0);expect((await page.locator('.sheet').boundingBox()).y).toBeCloseTo(top,0);
});

test('cancellation before movement releases fixed height so expand still works',async({page})=>{
 await ready(page);await start(page);await page.locator('.handle').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();expect(await page.locator('.sheet').evaluate(el=>el.style.height)).toBe('');const before=(await page.locator('.sheet').boundingBox()).height;await page.locator('.handle').click();await expect.poll(async()=> (await page.locator('.sheet').boundingBox()).height).toBeGreaterThan(before+50);
});
test('grabbing a returning sheet and dragging upward keeps the visible position',async({page})=>{
 await ready(page);const p=await start(page);await page.mouse.move(p.x,p.y+35);await page.waitForTimeout(130);await page.mouse.up();await page.locator('.sheet').evaluate(el=>{const a=el.getAnimations()[0];a.pause();a.currentTime=30;});
 const q=await start(page),before=(await page.locator('.sheet').boundingBox()).y;await page.mouse.move(q.x,q.y-8);const after=(await page.locator('.sheet').boundingBox()).y;expect(Math.abs((after-before)+8)).toBeLessThan(3);await page.locator('.handle').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
});

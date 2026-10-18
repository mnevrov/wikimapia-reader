import {test,expect} from '@playwright/test';
import {tiles,screen,map} from './helpers.js';
test.beforeEach(async({page})=>tiles(page));
test('black default, controls and persistent light preference',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await screen(page,'Настройки');await expect(page.locator('.settings-group').first()).toHaveCSS('background-color','rgb(16, 18, 20)');
 await expect(page.locator('#api-key')).toHaveCSS('background-color','rgb(32, 36, 40)');await page.getByRole('button',{name:'Светлая',exact:true}).click();
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await screen(page,'Настройки');await page.getByRole('button',{name:'Чёрная',exact:true}).click();await map(page);
 await page.locator('path.leaflet-interactive').first().dispatchEvent('click');await expect(page.locator('.sheet')).toHaveCSS('background-color','rgb(16, 18, 20)');
});
test('system theme reacts while open',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});await page.goto('/');await screen(page,'Настройки');await page.getByRole('button',{name:'Как в системе',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
test('system inset stays opaque in both themes without blocking controls',async({page})=>{
 await page.goto('/');await page.addStyleTag({content:':root{--safe-top:24px;--safe-bottom:16px}'});
 const inset=()=>page.evaluate(()=>{const s=getComputedStyle(document.querySelector('main'),'::before');return{height:s.height,background:s.backgroundColor,pointer:s.pointerEvents};});
 expect(await inset()).toEqual({height:'24px',background:'rgb(0, 0, 0)',pointer:'none'});
 await screen(page,'Настройки');await page.getByRole('button',{name:'Светлая',exact:true}).click();expect((await inset()).background).toBe('rgb(244, 246, 245)');
});

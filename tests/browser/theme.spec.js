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

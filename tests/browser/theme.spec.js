import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
});
test('black default covers settings, card, controls and survives reload',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'⚙ Настройки'}).click();
 await expect(page.locator('.settings-panel')).toHaveCSS('background-color','rgb(16, 18, 20)');
 await expect(page.locator('#api-key')).toHaveCSS('background-color','rgb(32, 36, 40)');
 await expect(page.locator('#api-key')).toHaveCSS('color','rgb(241, 245, 249)');
 await page.getByRole('button',{name:'Светлая',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('button',{name:'⚙ Настройки'}).click();
 await page.getByRole('button',{name:'Чёрная',exact:true}).click();
 await page.getByLabel('Закрыть настройки').click();
 await page.locator('path.leaflet-interactive').first().click({force:true});
 await expect(page.locator('.sheet')).toHaveCSS('background-color','rgb(16, 18, 20)');
 await expect(page.locator('.sheet')).toHaveCSS('color','rgb(241, 245, 249)');
});
test('system option responds to system appearance while app stays open',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});await page.goto('/');
 await page.getByRole('button',{name:'⚙ Настройки'}).click();
 await page.getByRole('button',{name:'Как в системе',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.emulateMedia({colorScheme:'dark'});
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(page.getByRole('button',{name:'Как в системе',exact:true})).toHaveAttribute('aria-pressed','true');
});

import {test,expect} from '@playwright/test';
import {tiles,clickContour,screen} from './helpers.js';

test('normal navigation and cards do not initialize the paid provider',async({page})=>{
 const requests=[];
 await tiles(page);
 await page.route('https://api-maps.yandex.ru/**',async route=>{
  requests.push(route.request().url());
  await route.abort();
 });
 await page.goto('/');
 await clickContour(page);
 await page.getByRole('button',{name:'Открыть режим чтения'}).click();
 await expect(page.getByRole('dialog',{name:'Режим чтения'})).toBeVisible();
 await page.getByRole('button',{name:'Закрыть режим чтения'}).click();
 await page.getByRole('button',{name:'Закрыть карточку'}).click();
 await screen(page,'Настройки');
 await expect(page.locator('main')).toBeVisible();
 expect(requests).toHaveLength(0);
});

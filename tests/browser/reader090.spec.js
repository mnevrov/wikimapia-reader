import {test,expect} from '@playwright/test';
import {tiles,connect,openId} from './helpers.js';

const sample={
 id:55,title:'Тестовая башня',
 description:'Первый абзац.\n\nВторой абзац, без HTML.\nТретья строка.',
 photos:{photo:[
  {big_url:'https://photos.wikimapia.org/test-1.jpg',author_name:'Автор 1'},
  {big_url:'https://photos.wikimapia.org/test-2.jpg',author_name:'Автор 2'}
 ]},
 comments:{comment:[]}
};
async function openDetails(page){
 await tiles(page);
 await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-auto','false'));
 await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:sample}));
 await page.goto('/');await connect(page);await openId(page);
 await expect(page.locator('.sheet h2')).toContainText('Тестовая башня');
}
test('reader shows all text without rewriting paragraphs and restores card',async({page})=>{
 await openDetails(page);
 await page.getByRole('button',{name:'Открыть режим чтения'}).click();
 const reader=page.getByRole('dialog',{name:'Режим чтения'});
 await expect(reader).toBeVisible();
 await expect(page.locator('main')).toHaveAttribute('inert','');
 await expect(reader.locator('.reader-text p')).toHaveCount(2);
 await expect(reader.locator('.reader-text')).toContainText('Третья строка.');
 await expect(reader.locator('.reader-text')).toHaveCSS('font-size','18px');
 await reader.getByRole('button',{name:'Увеличить текст'}).click();
 await expect(reader.locator('.reader-text')).toHaveCSS('font-size','20px');
 await reader.getByRole('button',{name:'Закрыть режим чтения'}).click();
 await expect(reader).toHaveCount(0);
 await expect(page.locator('main')).not.toHaveAttribute('inert','');
 await expect(page.locator('.sheet')).toBeVisible();
 await page.getByRole('button',{name:'Открыть режим чтения'}).click();
 await expect(page.locator('.reader-text')).toHaveCSS('font-size','20px');
});
test('gallery opens inline, changes photos and returns to photo tab',async({page})=>{
 await openDetails(page);
 await page.getByRole('tab',{name:/Фото/}).click();
 await page.getByRole('button',{name:'Открыть фото 1'}).click();
 const gallery=page.getByRole('dialog',{name:'Просмотр фотографий'});
 await expect(gallery).toBeVisible();
 await expect(gallery).toContainText('1 из 2');
 await gallery.getByRole('button',{name:'Следующее фото'}).click();
 await expect(gallery).toContainText('2 из 2');
 await gallery.getByRole('button',{name:'Увеличить фото'}).click();
 await expect(gallery.getByRole('button',{name:'Сбросить масштаб'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(gallery).toHaveCount(0);
 await expect(page.getByRole('tab',{name:/Фото/})).toHaveAttribute('aria-selected','true');
});
test('gallery keyboard navigation and reader accessibility in reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await openDetails(page);
 await page.getByRole('tab',{name:/Фото/}).click();
 await page.getByRole('button',{name:'Открыть фото 2'}).click();
 await page.keyboard.press('ArrowRight');
 await expect(page.getByRole('dialog',{name:'Просмотр фотографий'})).toContainText('1 из 2');
 await expect(page.locator('.viewer-overlay')).toHaveCSS('animation-name','none');
 await page.getByRole('button',{name:'Закрыть галерею'}).click();
 await expect(page.locator('.sheet')).toBeVisible();
});

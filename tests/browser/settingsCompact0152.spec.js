import {test,expect} from '@playwright/test';
import {screen,tiles,expandSettings} from './helpers.js';

test.beforeEach(async({page})=>{
 await tiles(page);
 await page.goto('/');
 await screen(page,'Настройки');
});

test('everyday map controls appear first; infrequent groups start collapsed',async({page})=>{
 const map=page.locator('[data-settings-section="map"]');
 await expect(map).toBeVisible();
 await expect(map.getByRole('button',{name:'OpenStreetMap'})).toBeVisible();
 await expect(map.getByRole('button',{name:'Светлая',exact:true})).toBeVisible();
 await expect(map.getByLabel('Автозагрузка области')).toBeVisible();
 await expect(map.locator('#density-setting')).toBeVisible();

 const sections=await page.locator('[data-settings-section="map"], .settings-accordion').evaluateAll(nodes=>
   nodes.map(node=>node.getAttribute('data-settings-section')));
 expect(sections).toEqual(['map','connection','storage','advanced']);

 for(const id of ['connection','storage','advanced']){
  const section=page.locator('[data-settings-section="'+id+'"]');
  await expect(section).toBeVisible();
  await expect(section).not.toHaveAttribute('open','');
 }
 await expect(page.locator('#api-key')).not.toBeVisible();
 await expect(page.locator('.cache-stats')).not.toBeVisible();
 await expect(page.getByRole('button',{name:/Открыть деморежим|Вернуться к реальным данным/})).not.toBeVisible();
 await expandSettings(page,'connection');
 await expect(page.locator('#api-key')).toBeVisible();
 await expandSettings(page,'storage');
 await expect(page.locator('.cache-settings')).toBeVisible();
 await expandSettings(page,'advanced');
 await expect(page.getByRole('button',{name:/Открыть деморежим|Вернуться к реальным данным/})).toBeVisible();
});

test('map source credentials are progressive disclosure and remain accessible by keyboard',async({page})=>{
 const source=page.locator('[data-settings-section="phone-key"]');
 await expect(source).toBeVisible();
 await expect(source).not.toHaveAttribute('open','');
 const summary=source.locator('summary');
 await summary.focus();
 await page.keyboard.press('Enter');
 await expect(source).toHaveAttribute('open','');
 await expect(page.locator('#yandex-api-key')).toBeVisible();
 await summary.focus();
 await page.keyboard.press('Enter');
 await expect(page.locator('#yandex-api-key')).not.toBeVisible();
});

test('compact settings avoid horizontal overflow at narrow and enlarged font sizes',async({page})=>{
 for(const size of [320,390]){
  await page.setViewportSize({width:size,height:700});
  await expect(page.locator('.settings-primary')).toBeVisible();
  const width=await page.evaluate(()=>({view:innerWidth,html:document.documentElement.scrollWidth}));
  if(width.html>width.view+1){
   const overflowing=await page.evaluate(()=>[...document.querySelectorAll('.settings-compact *')]
    .filter(element=>{
      const box=element.getBoundingClientRect();
      return box.width>0&&box.right>innerWidth+1&&getComputedStyle(element).display!=='none';
    })
    .slice(0,12).map(element=>({tag:element.tagName,selector:element.className?.toString()?.slice(0,60),
      text:element.textContent?.trim()?.slice(0,45),right:Math.round(element.getBoundingClientRect().right)})));
   console.log('Settings overflow elements:',JSON.stringify(overflowing));
  }
  expect(width.html).toBeLessThanOrEqual(width.view+1);
  const controls=page.locator('.settings-primary .basemap-choice button');
  for(const button of await controls.all()){
   const box=await button.boundingBox();
   expect(box).toBeTruthy();
   expect(box.x).toBeGreaterThanOrEqual(0);
   expect(box.x+box.width).toBeLessThanOrEqual(size+1);
  }
 }
 await page.addStyleTag({content:'.settings-compact button,.settings-compact summary,.settings-compact label{font-size:20px!important}'});
 await page.setViewportSize({width:320,height:700});
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
 await expandSettings(page,'connection');
 await expect(page.locator('#api-key')).toBeVisible();
});

test('changing map preferences still persists across reopen',async({page})=>{
 await page.getByRole('button',{name:'Светлая',exact:true}).click();
 await page.getByLabel('Автозагрузка области').uncheck();
 await page.locator('#density-setting').selectOption('calm');
 await page.reload();
 await screen(page,'Настройки');
 await expect(page.getByRole('button',{name:'Светлая',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Автозагрузка области')).not.toBeChecked();
 await expect(page.locator('#density-setting')).toHaveValue('calm');
});

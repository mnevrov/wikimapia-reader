import {test,expect} from '@playwright/test';
import {tiles,connect,screen} from './helpers.js';
const polygon=[{x:37.617,y:55.751},{x:37.619,y:55.751},{x:37.619,y:55.753}];

test('visible area list stays on the map and restores after opening an object',async({page})=>{
 await tiles(page);await page.goto('/');
 await page.getByRole('button',{name:'Список объектов области'}).click();
 const panel=page.getByRole('region',{name:'Объекты на карте'});
 await expect(panel).toBeVisible();
 await expect.poll(()=>panel.locator('.discovery-scroll').evaluate(el=>el.clientHeight)).toBeGreaterThan(150);
 await expect.poll(()=>panel.locator('.discovery-place-list strong').first().evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(100);
 await expect(panel.getByText('Демонстрационный квартал')).toBeVisible();
 await panel.getByRole('button',{name:/Демонстрационный квартал/}).click();
 await expect(page.locator('.sheet h2')).toHaveText('Демонстрационный квартал');
 await page.getByLabel('Закрыть карточку').click();
 await expect(page.getByRole('region',{name:'Объекты на карте'})).toBeVisible();
 await expect(page.locator('.app-screen')).toHaveCount(0);
});
test('map-density preference persists across list and settings',async({page})=>{
 await tiles(page);await page.goto('/');
 await page.getByRole('button',{name:'Список объектов области'}).click();
 await page.locator('#map-density').selectOption('calm');
 await screen(page,'Настройки');
 await expect(page.locator('#density-setting')).toHaveValue('calm');
 await page.reload();await screen(page,'Настройки');
 await expect(page.locator('#density-setting')).toHaveValue('calm');
 await page.locator('#density-setting').selectOption('detailed');
 await screen(page,'Карта');await page.getByRole('button',{name:'Список объектов области'}).click();
 await expect(page.locator('#map-density')).toHaveValue('detailed');
});
test('map search opens on top of map, finds objects, and returns to results',async({page})=>{
 await tiles(page);
 await page.route('https://api.wikimapia.org/**',route=>{
  const u=new URL(route.request().url());const fn=u.searchParams.get('function');
  const data=fn==='box'?{folder:[],found:0}:fn==='search'?{folder:[{id:55,name:'Tower',polygon}],found:1}:{id:55,title:'Tower',description:'Readable detail',polygon};
  return route.fulfill({json:data});
 });
 await page.goto('/');await connect(page);
 await page.getByRole('button',{name:'Найти место'}).click();
 await expect(page.getByRole('region',{name:'Поиск на карте'})).toBeVisible();
 await expect(page.locator('.app-screen')).toHaveCount(0);
 await page.locator('#map-query').fill('Tower');
 await page.getByRole('region',{name:'Поиск на карте'}).getByRole('button',{name:'Найти',exact:true}).click();
 await expect(page.locator('.discovery-results button')).toContainText('Tower',{timeout:18000});
 await page.locator('.discovery-results button').click();
 await expect(page.locator('.description')).toHaveText('Readable detail',{timeout:18000});
 await page.getByLabel('Закрыть карточку').click();
 await expect(page.getByRole('region',{name:'Поиск на карте'})).toBeVisible();
 await expect(page.locator('#map-query')).toHaveValue('Tower');
});
test('density changes keep existing Leaflet polygon elements',async({page})=>{
 await tiles(page);await page.goto('/');
 const polygon=page.locator('path.leaflet-interactive').first();
 await expect(polygon).toBeVisible();
 await page.evaluate(()=>{window.__contourPath=document.querySelector('path.leaflet-interactive');});
 await page.getByRole('button',{name:'Список объектов области'}).click();
 await page.locator('#map-density').selectOption('calm');
 expect(await page.evaluate(()=>window.__contourPath?.isSameNode(document.querySelector('path.leaflet-interactive')))).toBe(true);
 await page.locator('#map-density').selectOption('detailed');
 expect(await page.evaluate(()=>window.__contourPath?.isSameNode(document.querySelector('path.leaflet-interactive')))).toBe(true);
});
test('Escape dismisses map discovery without navigating away',async({page})=>{
 await tiles(page);await page.goto('/');
 await page.getByRole('button',{name:'Список объектов области'}).click();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('region',{name:'Объекты на карте'})).toHaveCount(0);
 await expect(page.locator('.app-screen')).toHaveCount(0);
});

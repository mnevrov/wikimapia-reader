import {test,expect} from '@playwright/test';
const polygon=[{x:37.617,y:55.751},{x:37.619,y:55.751},{x:37.619,y:55.753}];
import {clickContour,tiles,connect,openId,screen,map} from './helpers.js';
async function setup(page){await tiles(page);await page.goto('/');await connect(page);}
test('auto area pagination merges pages without duplicates',async({page})=>{
 const pages=[];
 await page.route('https://api.wikimapia.org/**',r=>{
  const n=Number(new URL(r.request().url()).searchParams.get('page'));pages.push(n);
  return r.fulfill({json:{folder:(n===1?[1,2]:[2,3]).map(id=>({id,name:'Object '+id,polygon})),found:3}});
 });
 await setup(page);
 await expect(page.locator('path.leaflet-interactive')).toHaveCount(3,{timeout:15000});
 await expect(page.locator('.map-feedback')).toHaveCount(0);
 expect(pages).toEqual([1,2]);await expect(page.locator('path.leaflet-interactive')).toHaveCount(3);
});
test('real-shaped comment date displayed; Escape closes settings before card',async({page})=>{
 // Isolate this scenario from automatic area requests and the shared 6s API queue.
 await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-auto','false'));
 await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{id:55,title:'Tower',description:'Text',polygon,comments:[{name:'Author',message:'Comment',date:1163698281},{name:'No date',message:'Undated'}]}}));
 await setup(page);await openId(page);
 await expect(page.locator('.sheet h2')).toHaveText('Tower');
 await screen(page,'Настройки');await page.keyboard.press('Escape');await expect(page.locator('.settings-panel')).toHaveCount(0);await expect(page.locator('.sheet')).toBeVisible();
 await page.getByRole('tab',{name:/Комментарии/}).click();
 await expect(page.locator('.comment time').first()).toHaveText('16 ноября 2006 г.');
 await expect(page.locator('.comment time').first()).toHaveAttribute('datetime','2006-11-16T17:31:21.000Z');
 await page.keyboard.press('Escape');await expect(page.locator('.sheet')).toHaveCount(0);
});
test('geolocation after explicit tap centers the map',async({page,context})=>{
 await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-auto','false'));
 await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{folder:[],found:0}}));
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:55.75,longitude:37.61});
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());await page.goto('/');
 await page.getByRole('button',{name:'Моё местоположение'}).click();
 await expect.poll(async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('wikimapia-reader-view')))?.zoom).toBe(17);
 expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('wikimapia-reader-view'))).zoom).toBe(17);
});
test('manual mode: moving map disables old pagination and makes no automatic request',async({page})=>{
 // Disable auto before connecting; otherwise a startup request may occupy the 6-second gate.
 await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-auto','false'));
 let requests=0;
 await page.route('https://api.wikimapia.org/**',r=>{requests++;return r.fulfill({json:{folder:[{id:1,name:'One',polygon}],found:100}});});
 await setup(page);await screen(page,'Настройки');await page.getByLabel('Автозагрузка области').uncheck();await map(page);
 await page.getByRole('button',{name:'Обновить область'}).click();await expect(page.getByRole('button',{name:'Догрузить область'})).toBeVisible({timeout:15000});
 await page.getByRole('button',{name:'Приблизить карту',exact:true}).click();
 await expect(page.getByRole('button',{name:'Догрузить область'})).toHaveCount(0);
 await page.waitForTimeout(1500);expect(requests).toBe(1);
});
test('search shows documented results and opens selected object',async({page})=>{
 // Isolate this scenario from automatic area requests and the shared 6s API queue.
 await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-auto','false'));
 const methods=[];
 await page.route('https://api.wikimapia.org/**',r=>{
  const u=new URL(r.request().url()),m=u.searchParams.get('function');methods.push(m);
  return r.fulfill({json:m==='search'?{folder:[{id:55,name:'Tower',polygon}],found:1}:{id:55,title:'Tower',description:'Found detail',polygon}});
 });
 await setup(page);await screen(page,'Поиск');await page.locator('#place-query').fill('Tower');await page.getByRole('button',{name:'Найти',exact:true}).click();
 await page.locator('.search-results button').click();await expect(page.locator('.description')).toHaveText('Found detail',{timeout:15000});
 expect(methods).toEqual(['search','place.getbyid']);
});
test('permission denial is handled and geolocation is never requested on launch',async({page})=>{
 await page.addInitScript(()=>{window.geoRequests=0;navigator.geolocation.getCurrentPosition=(_success,error)=>{window.geoRequests++;error({code:1});};});
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());await page.goto('/');
 expect(await page.evaluate(()=>window.geoRequests)).toBe(0);
 await page.getByRole('button',{name:'Моё местоположение'}).click();
 await expect(page.locator('.status')).toContainText('Местоположение недоступно');expect(await page.evaluate(()=>window.geoRequests)).toBe(1);
});
test('auto pan debounces; background cancels queued load and resume reuses covering cache',async({page})=>{
 let requests=0;
 await page.route('https://api.wikimapia.org/**',r=>{requests++;return r.fulfill({json:{folder:[{id:requests,name:'Area',polygon}],found:1}});});
 await setup(page);await expect.poll(()=>requests).toBe(1);
 await page.getByRole('button',{name:'Приблизить карту',exact:true}).click();await page.getByRole('button',{name:'Приблизить карту',exact:true}).click();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(6500);expect(requests).toBe(1);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(1400);expect(requests).toBe(1);await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
});
test('card stays readable and attribution remains visible in portrait and landscape',async({page})=>{
 await tiles(page);await page.goto('/');
 await clickContour(page);await page.getByRole('button',{name:'Развернуть карточку',exact:true}).click();
 for(const viewport of [{width:320,height:640},{width:844,height:390},{width:768,height:1024}]){
  await page.setViewportSize(viewport);await expect(page.locator('.sheet-attribution')).toBeVisible();
  await expect.poll(async()=> (await page.locator('.sheet-scroll').boundingBox()).height).toBeGreaterThan(60);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);
 }
});

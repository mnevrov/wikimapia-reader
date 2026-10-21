import {test,expect} from '@playwright/test';
import {nativeVault,openId,tiles} from './helpers.js';
const title='Жилой комплекс «Западный порт» (Москва)';
const card=`<meta property="og:url" content="https://wikimapia.org/55/Test"><h1>${title}</h1><div id="place-description">Возведён на берегу реки Москвы. ${'Подробное описание объекта. '.repeat(45)}</div><div id="place-photos"></div><div id="comments"><li class="comment" id="comment-1"><strong id="comment-creator-1">Наталья (гость)</strong><div class="comment-content">Дорога только с правой стороны от комплекса.</div><span class="time">18 лет назад</span></li><li class="comment" id="comment-2"><strong id="comment-creator-2">Читатель</strong><div class="comment-content">Текст</div><time datetime="2020-01-02T10:00:00Z">6 лет назад</time></li></div>`;
async function start(page){
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('https://wikimapia.org/**',r=>r.fulfill({contentType:'text/html',body:card}));
 await nativeVault(page,{key:null,calls:[],site:true});
 await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-auto','false'));
 await page.goto('/');await openId(page);
 await expect(page.locator('.description')).toContainText('Возведён');
}
test.use({reducedMotion:'reduce'});
test('GPS warning has content height on Yandex and OSM, including short screens',async({page,context})=>{
 await tiles(page);await context.grantPermissions(['geolocation']);
 await context.setGeolocation({latitude:55.75,longitude:37.61,accuracy:2000});
 await page.goto('/');await page.getByRole('button',{name:'Моё местоположение'}).click();
 const notice=page.locator('.gps-feedback');await expect(notice).toContainText('Низкая точность');
 for(const [width,height] of [[390,844],[320,640],[844,390]]){
  await page.setViewportSize({width,height});
  for(const yandex of [false,true]){
   await page.locator('.map-stack').evaluate((n,active)=>n.classList.toggle('has-yandex',active),yandex);
   const box=await notice.boundingBox();expect(box.height).toBeLessThan(100);
   expect(box.y).toBeLessThan(height/2);expect(box.y+box.height).toBeLessThan(height-72);
   const tools=await page.locator('.map-tools').boundingBox();expect(box.x+box.width).toBeLessThanOrEqual(tools.x);
  }
 }
});
test('compact card leaves room to read and secondary actions live in labelled menu',async({page})=>{
 await start(page);
 await page.getByRole('button',{name:'Свернуть карточку',exact:true}).click();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  const panel=await page.locator('#object-content').boundingBox();expect(panel.height).toBeGreaterThan(200);
  await expect(page.locator('.sheet-shortcuts,.sheet-footer')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Поделиться',exact:true})).toBeHidden();
  await page.getByRole('button',{name:'Действия с объектом'}).click();
  await expect(page.getByRole('button',{name:'Поделиться',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/Открыть в Wikimapia/})).toBeVisible();
  await expect(page.getByText('Объект #55',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Действия с объектом'})).toBeFocused();
 }
 await page.getByRole('button',{name:'Развернуть карточку'}).click();
 await page.getByRole('tab',{name:/Комментарии/}).click();
 const panel=await page.locator('#object-content').boundingBox();expect(panel.height).toBeGreaterThan(450);
 await expect(page.locator('#object-content')).toHaveCSS('opacity','1');
 await page.screenshot({path:'test-results/card-comments-320.png'});
});
test('website comment dates remain visible after offline save and reload',async({page})=>{
 await start(page);await page.getByRole('tab',{name:/Комментарии/}).click();
 await expect(page.locator('.comment time').first()).toHaveText('18 лет назад');
 await expect(page.locator('.comment time').nth(1)).toHaveText('2 января 2020 г.');
 await page.getByRole('button',{name:'Действия с объектом'}).click();
 await page.getByRole('button',{name:'Сохранить для чтения без сети',exact:true}).click();
 await expect(page.locator('.offline-card-status')).toContainText('доступно без сети');
 await page.reload();await page.route('https://wikimapia.org/**',r=>r.abort());await openId(page);
 await page.getByRole('tab',{name:/Комментарии/}).click();
 await expect(page.locator('.comment time').first()).toHaveText('18 лет назад');
});

test('large text keeps content scrollable and actions inside the card',async({page})=>{
 await start(page);await page.setViewportSize({width:320,height:640});
 await page.addStyleTag({content:'.sheet h2,.sheet.expanded h2{font-size:26px}.sheet .tabs button{font-size:18px}.comment p{font-size:22px}.comment b{font-size:20px}.comment time{font-size:16px}'});
 await page.getByRole('tab',{name:/Комментарии/}).click();
 const content=page.locator('#object-content');await expect(content).toHaveCSS('opacity','1');
 expect((await content.boundingBox()).height).toBeGreaterThan(180);
 expect(await page.locator('.sheet').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
 await page.screenshot({path:'test-results/card-large-text-320.png'});
 await page.getByRole('button',{name:'Действия с объектом'}).click();
 await expect(page.getByRole('button',{name:'Поделиться',exact:true})).toBeVisible();
});

test('menu commands restore keyboard focus to the trigger',async({page})=>{
 await start(page);const trigger=page.getByRole('button',{name:'Действия с объектом'});
 await trigger.click();
 await page.locator('#object-actions').getByRole('button',{name:'Свернуть карточку',exact:true}).focus();
 await page.keyboard.press('Enter');
 await expect(trigger).toBeFocused();
 await trigger.click();await page.getByRole('button',{name:'Поделиться',exact:true}).focus();
 await page.keyboard.press('Enter');await expect(trigger).toBeFocused();
});

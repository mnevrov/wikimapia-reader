import {test,expect} from '@playwright/test';
import {connect,tiles} from './helpers.js';
test('GPS Follow has explicit start, manual pause, resume and stop',async({page,context})=>{
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('https://api.wikimapia.org/**',r=>r.fulfill({json:{folder:[],found:0}}));
 await context.grantPermissions(['geolocation']);
 await context.setGeolocation({latitude:55.752,longitude:37.618,accuracy:12});
 await page.goto('/');
 const button=page.getByRole('button',{name:'Моё местоположение'});
 await expect(button).toHaveAttribute('aria-pressed','false');
 await button.click();
 await expect(button).toHaveAttribute('aria-pressed','true');
 await expect(button).toHaveAttribute('title','Выключить GPS Follow');
 await page.mouse.move(180,350);
 await page.mouse.down();await page.mouse.move(260,410,{steps:6});await page.mouse.up();
 await expect(button).toHaveAttribute('aria-pressed','false');
 await expect(button).toHaveAttribute('title','Возобновить GPS Follow');
 await button.click();
 await expect(button).toHaveAttribute('aria-pressed','true');
 await button.click();
 await expect(button).toHaveAttribute('aria-pressed','false');
 await expect(button).toHaveAttribute('title','Следовать за GPS');
});

test('GPS Follow keeps automatic Wikimapia area loading active after moving to a new area',async({page,context})=>{
 await tiles(page);
 const bounds=[];
 await page.route('https://api.wikimapia.org/**',route=>{
   const url=new URL(route.request().url());
   if(url.searchParams.get('function')==='box')bounds.push(url.searchParams.get('bbox'));
   return route.fulfill({json:{folder:[],found:0}});
 });
 await context.grantPermissions(['geolocation']);
 await context.setGeolocation({latitude:55.752,longitude:37.618,accuracy:12});
 await page.goto('/');
 await connect(page,'test-gps-request');
 await expect.poll(()=>bounds.length,{timeout:20000}).toBeGreaterThan(0);
 const first=bounds[0];
 const button=page.getByRole('button',{name:'Моё местоположение'});
 await button.click();
 await expect(button).toHaveAttribute('aria-pressed','true');
 await context.setGeolocation({latitude:55.770,longitude:37.660,accuracy:12});
 await expect.poll(()=>bounds.some(b=>b!==first),{timeout:25000}).toBe(true);
 await expect(button).toHaveAttribute('aria-pressed','true');
});

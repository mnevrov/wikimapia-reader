import {test,expect} from '@playwright/test';
import {tiles,screen} from './helpers.js';

test.beforeEach(async({page})=>{
 await tiles(page);
 await page.addInitScript(()=>localStorage.setItem('wikimapia-reader-auto','false'));
});

test('local discovery filters and map preview work without any Wikimapia API request',async({page})=>{
 let wikimapiaCalls=0;
 await page.route('https://api.wikimapia.org/**',route=>{wikimapiaCalls++;return route.abort();});
 await page.goto('/');
 await page.getByRole('button',{name:'Список объектов области'}).click();
 const panel=page.getByRole('region',{name:'Объекты на карте'});
 await expect(panel.locator('.discovery-place-list li')).toHaveCount(3);
 await panel.locator('#discover-query').fill('исторического');
 await expect(panel.locator('.discovery-place-list li')).toHaveCount(1);
 await panel.locator('#discover-query').fill('');
 await panel.locator('#discover-sort').selectOption('area');
 await expect(panel.locator('.discovery-place-list li')).toHaveCount(3);
 await panel.getByRole('button',{name:'Показать контур #101'}).click();
 await expect(panel).toHaveCount(0);
 await expect(page.locator('path.leaflet-interactive').first()).toBeVisible();
 await page.getByRole('button',{name:'Список объектов области'}).click();
 await expect(page.locator('.discovery-place-list li.discover-active')).toContainText('Демонстрационный квартал');
 expect(wikimapiaCalls).toBe(0);
});

test('backup import prompts for confirmation and merges only public offline text',async({page})=>{
 await page.goto('/');
 await screen(page,'Избранное');
 const imported={format:'wikireader-library',version:1,mediaIncluded:false,exportedAt:'2026-10-20T00:00:00.000Z',
  favorites:[{id:55,source:'wikimapia',title:'Башня'}],history:[],
  offline:[{id:55,title:'Башня',description:'Сохранённая история места',savedAt:1760000000000,comments:[]}]};
 await page.locator('.backup-file-input').setInputFiles({name:'wikireader-library.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
 await expect(page.getByRole('group',{name:'Подтверждение импорта'})).toBeVisible();
 await expect(page.locator('.offline-list')).toHaveCount(0);
 await page.getByRole('button',{name:'Импортировать'}).click();
 await expect(page.locator('.offline-list .saved-open')).toContainText('Башня');
 await expect(page.locator('.saved-list .saved-open[data-place-id="55"][data-source="wikimapia"]')).toContainText('Башня');
 await page.reload();await screen(page,'Избранное');
 await expect(page.locator('.offline-list .saved-open')).toContainText('Башня');
 const raw=await page.evaluate(()=>localStorage.getItem('wikimapia-reader-favorites'));
 expect(raw).not.toContain('apiKey');
});

test('import rejects unknown schema and retains current library',async({page})=>{
 await page.goto('/');await screen(page,'Избранное');
 await page.locator('.backup-file-input').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"unknown"}')});
 await expect(page.locator('.library-backup [role="status"]')).toContainText('Неизвестный формат');
 await expect(page.getByRole('group',{name:'Подтверждение импорта'})).toHaveCount(0);
});

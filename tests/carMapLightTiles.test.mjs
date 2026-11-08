import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const renderer=readFileSync(new URL('../android/app/src/main/java/org/example/wikimapreader/car/MapRenderer.java',import.meta.url),'utf8');
const tiles=readFileSync(new URL('../android/app/src/main/java/org/example/wikimapreader/car/TileSource.java',import.meta.url),'utf8');

test('car map retains original light raster colors in both car themes',()=>{
 assert.doesNotMatch(renderer,/isDarkMode\s*\(/);
 assert.doesNotMatch(renderer,/ColorMatrix|setColorFilter\s*\(\s*new/);
 assert.match(renderer,/drawBitmap\(b,null/);
 assert.match(renderer,/drawColor\(Color\.rgb\(230,235,238\)\)/);
});
test('Yandex compact attribution stays visible without an extra white panel',()=>{
 assert.match(renderer,/yandex_tiles_attribution/);
 assert.match(renderer,/attributionBounds=new RectF/);
 assert.doesNotMatch(renderer,/drawRoundRect\(new RectF\(left,top,left\+logoWidth/);
 assert.match(renderer,/Math\.min\(62\*density/);
});
test('nighttime does not change the selected basemap, but API errors still fall back',()=>{
 assert.doesNotMatch(tiles,/CarBasemapPolicy|nightPolicy|isDarkMode/);
 assert.match(tiles,/yandexBlockedUntil/);
 assert.match(tiles,/return "yandex"\.equals\(settings\.selected\(\)\)/);
});

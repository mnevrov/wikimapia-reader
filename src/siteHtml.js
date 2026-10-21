// This module never executes scripts and never inserts fetched markup into the live DOM.
function documentOf(html){if(typeof html!=='string'||html.length>4194304)throw Error('Некорректная страница Wikimapia');return new DOMParser().parseFromString(html,'text/html');}
function text(node){if(!node)return '';const copy=node.cloneNode(true);copy.querySelectorAll('script,style,iframe,object,embed,noscript').forEach(x=>x.remove());copy.querySelectorAll('br').forEach(x=>x.replaceWith('\n'));copy.querySelectorAll('p,div,li').forEach(x=>x.append('\n'));return copy.textContent.replace(/\u00a0/g,' ').replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
function photoUrl(raw){try{const u=new URL(raw);if(!['http:','https:'].includes(u.protocol)||u.hostname!=='photos.wikimapia.org'||u.username||u.password||u.port||!/^\/p\/(?:\d{2}\/){4}\d{2}_(?:big|full|\d+)\.jpg$/.test(u.pathname))return null;u.protocol='https:';u.search='';u.hash='';return u.href;}catch{return null;}}
export function parseSitePlace(html,expectedId){
 if(!Number.isSafeInteger(expectedId)||expectedId<1)throw Error('Неверный ID');
 const doc=documentOf(html),identity=doc.querySelector('meta[property="og:url"]')?.content||doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
 let identified=false;
 if(identity){try{const u=new URL(identity);identified=['wikimapia.org','www.wikimapia.org'].includes(u.hostname)&&Number(u.pathname.split('/')[1])===expectedId;}catch{}if(!identified)throw Error('Страница другого объекта');}
 // Numeric literal only, never eval. Some website layouts omit canonical metadata.
 if(!identified){for(const script of doc.scripts){const id=script.textContent.match(/\bplace\s*=\s*\{[^}]*?\bid\s*:\s*(\d+)/)?.[1];if(id){if(Number(id)!==expectedId)throw Error('Страница другого объекта');identified=true;break;}}}
 if(!identified||!doc.querySelector('h1'))throw Error('Не удалось распознать карточку Wikimapia');
 const title=text(doc.querySelector('h1')),desc=doc.querySelector('#place-description'),photosRoot=doc.querySelector('#place-photos'),commentsRoot=doc.querySelector('#comments');
 const description=text(desc),blocked=/RK\s*n\.?\s*22|информация недоступна|information unavailable/i.test(description);
 const photos=[],photoIds=new Set();let badPhoto=!!photosRoot&&photosRoot.children.length>0&&!photosRoot.querySelector('a.thumb-link');
 for(const a of doc.querySelectorAll('#place-photos a.thumb-link')){const src=photoUrl(a.getAttribute('data-full-url')||a.getAttribute('href')),id=a.getAttribute('data-id')||src;if(!src){badPhoto=true;continue;}if(photoIds.has(id))continue;photoIds.add(id);photos.push({src,author:a.getAttribute('data-user-name')||''});}
 const comments=[],commentIds=new Set();let badComment=!!commentsRoot&&commentsRoot.children.length>0&&!commentsRoot.querySelector('li.comment,ul.comments-root,ul.comments-list,#more-comments,#comments-form-toggle');
 for(const el of doc.querySelectorAll('#comments li.comment')){const id=el.id.match(/^comment-(\d+)$/)?.[1];if(!id){badComment=true;continue;}if(commentIds.has(id))continue;commentIds.add(id);const content=el.querySelector('.comment-content');if(!content){badComment=true;continue;}if(content.getAttribute('style')?.replaceAll(' ','').includes('display:none'))continue;const value=text(content);if(!value)continue;const author=text(el.querySelector('[id^="comment-creator-"]'))||'Участник Wikimapia';const raw=el.querySelector('time[datetime]')?.getAttribute('datetime');const time=raw&&/^\d{4}-\d\d-\d\dT/.test(raw)?Date.parse(raw):NaN;const dateLabel=text(el.querySelector('.time, time')).slice(0,100);comments.push({author,text:value,...(dateLabel?{dateLabel}:{}),date:Number.isFinite(time)&&time<=Date.now()+86400000?new Date(time).toISOString():null});}
 const blocks={title:title&&!/^\s*\([^)]*\)\s*$/.test(title)?'ok':'unavailable',description:!desc?'unavailable':blocked?'unavailable':description?'ok':'empty',photos:!photosRoot?'unavailable':badPhoto?'unavailable':photos.length?'ok':'empty',comments:!commentsRoot?'unavailable':badComment?'unavailable':comments.length?'ok':'empty'};
 return {place:{id:expectedId,title:blocks.title==='ok'?title:`Объект #${expectedId}`,description:blocked?'':description,url:`https://wikimapia.org/${expectedId}/ru/`,photos,comments},blocks};
}
export function parseSiteSearch(html){
 const doc=documentOf(html);if(!doc.querySelector('#search-query')||!doc.querySelector('.searchlist'))throw Error('Не удалось распознать поиск сайта Wikimapia');
 const places=[];
 if(doc.querySelector('.searchlist').children.length>0&&!doc.querySelector('.search-result-item'))throw Error('Неизвестная структура поиска');
 for(const [i,el] of [...doc.querySelectorAll('.search-result-item')].entries()){
  const lat=Number(el.getAttribute('data-latitude')),lon=Number(el.getAttribute('data-longitude')),zoom=Number(el.getAttribute('data-zoom'));
  if(!el.hasAttribute('data-latitude')||!el.hasAttribute('data-longitude')||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)throw Error('Некорректный результат поиска');
  const title=text(el.querySelector('strong'));if(!title)continue;
  places.push({id:`site-location-${i}`,title,coords:[],searchLocation:{lat,lon,zoom:Number.isInteger(zoom)&&zoom>=14&&zoom<=19?zoom:16}});
 }
 return {places:places.slice(0,20),complete:!doc.querySelector('.pager .active [data-start]')};
}

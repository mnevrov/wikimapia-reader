// Interpret text locally. Never fetch a URL pasted into the search field.
export function searchIntent(value){
 const text=String(value??'').trim();
 if(!text)return {kind:'invalid'};
 const id=value=>/^\d+$/.test(value??'')&&Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
 if(/^\d+$/.test(text)){const n=id(text);return n?{kind:'place',id:n}:{kind:'invalid'};}
 if(/^[a-z][a-z\d+.-]*:/i.test(text)){
  try{const u=new URL(text);if(!['https:','http:'].includes(u.protocol)||!['wikimapia.org','www.wikimapia.org'].includes(u.hostname)||u.username||u.password||u.port)return {kind:'invalid'};
   const n=id(u.pathname.match(/^\/(\d+)(?:\/|$)/)?.[1]??u.searchParams.get('show')??new URLSearchParams(u.hash.slice(1)).get('show'));return n?{kind:'place',id:n}:{kind:'invalid'};
  }catch{return {kind:'invalid'};}
 }
 return {kind:'query',query:text};
}

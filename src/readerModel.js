// Description content is plain text from Wikimapia. Never interpret HTML from the API.
export const READER_SIZE_KEY='wikimapia-reader-font-size';
export const FONT_SIZES=[16,18,20,22,24,26];
export function validReaderSize(value){
 const numeric=Number(value);
 return FONT_SIZES.includes(numeric)?numeric:18;
}
export function splitParagraphs(value){
 const text=String(value??'').replace(/\r\n?/g,'\n').trim();
 return text?text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean):[];
}
export function nextPhotoIndex(index,total,delta){
 if(!Number.isSafeInteger(total)||total<1)return 0;
 return ((index+delta)%total+total)%total;
}
export function hapticTap(){
 // Only called on direct user action. Unsupported platforms quietly ignore it.
 try{navigator.vibrate?.(8);}catch{}
}

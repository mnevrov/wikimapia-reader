export const intersects=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
export const contains=(a,b)=>a[0]<=b[0]&&a[1]<=b[1]&&a[2]>=b[2]&&a[3]>=b[3];
// Subtract each covered rectangle from disjoint remaining pieces. No raster
// approximation: narrow gaps and holes must still cause a network request.
export function isCovered(view,boxes){
 let missing=[view];
 for(const box of boxes){
  const next=[];
  for(const r of missing){
   if(!intersects(r,box)){next.push(r);continue;}
   const [w,s,e,n]=[Math.max(r[0],box[0]),Math.max(r[1],box[1]),Math.min(r[2],box[2]),Math.min(r[3],box[3])];
   if(r[0]<w)next.push([r[0],r[1],w,r[3]]);
   if(e<r[2])next.push([e,r[1],r[2],r[3]]);
   if(r[1]<s)next.push([w,r[1],e,s]);
   if(n<r[3])next.push([w,n,e,r[3]]);
  }
  missing=next;if(!missing.length)return true;
 }
 return false;
}

function area(points){let a=0;for(let i=0,j=points.length-1;i<points.length;j=i++)a+=points[j].x*points[i].y-points[i].x*points[j].y;return Math.abs(a)/2;}
function distance2(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=dx||dy?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy))):0;return (p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;}
export function hitTestPlaces(places,point,project,tolerance=8){
 const target=project([point.lat,point.lng]);const matches=[];
 for(const place of places){
  if(!Array.isArray(place.coords)||place.coords.length<3)continue;
  const points=place.coords.map(project);let inside=false,near=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[j],b=points[i];
   if(distance2(target,a,b)<=tolerance*tolerance)near=true;
   if((a.y>target.y)!==(b.y>target.y)&&target.x<(b.x-a.x)*(target.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  if(inside||near)matches.push({place,area:area(points)});
 }
 return matches.sort((a,b)=>a.area-b.area||a.place.id-b.place.id).map(m=>m.place);
}

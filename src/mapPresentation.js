// Pure geometry and visual-density helpers. No Leaflet or DOM dependencies.
export const DENSITY_MODES = ['auto','detailed','calm'];
export const validDensity = value => DENSITY_MODES.includes(value) ? value : 'auto';

export function polygonBounds(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return null;
  let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
  for (const point of coords) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const [lat,lng]=point;
    if (!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
    south=Math.min(south,lat); north=Math.max(north,lat);
    west=Math.min(west,lng); east=Math.max(east,lng);
  }
  return [west,south,east,north];
}

// view is [west,south,east,north]; inclusive intersections retain boundary objects.
export function inMapView(place,view) {
  if (!Array.isArray(view) || view.length !== 4) return false;
  const b=polygonBounds(place?.coords);
  return !!b && b[0]<=view[2] && b[2]>=view[0] && b[1]<=view[3] && b[3]>=view[1];
}
export function visibleInMap(places,view) {
  return places.filter(place=>inMapView(place,view));
}
export function contourStyle(mode,count,zoom,selected=false) {
  if (selected) return {color:'#f1a23b',weight:3,opacity:1,fill:true,fillColor:'#f1a23b',fillOpacity:.12};
  const compact=validDensity(mode)==='calm' || (validDensity(mode)==='auto' && (count>160 || zoom<15));
  return {color:'#16ac8d',weight:compact?1:1.5,opacity:compact?.55:.95,fill:false,smoothFactor:compact?2:1};
}

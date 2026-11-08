// Pure transitions and filtering: Android location subscriptions remain UI-owned.
export function nextFollowState(state,event){
  if(event==='manual-pan')return state==='following'?'paused':state;
  if(event==='tap')return state==='following'?'off':'following';
  if(event==='permission-denied')return 'off';
  if(event==='background')return state;
  return state;
}
export function acceptableFix(coords){
  return !!coords&&Number.isFinite(coords.latitude)&&Math.abs(coords.latitude)<=90&&Number.isFinite(coords.longitude)&&Math.abs(coords.longitude)<=180&&Number.isFinite(coords.accuracy)&&coords.accuracy>=0&&coords.accuracy<=250;
}
// Android may initially deliver only approximate coordinates (hundreds of
// metres or a few kilometres). Do not hide a usable position while waiting for
// GPS precision: show its uncertainty and refine the location when GPS locks.
export function usableFix(coords){
  return !!coords
    &&Number.isFinite(coords.latitude)&&Math.abs(coords.latitude)<=90
    &&Number.isFinite(coords.longitude)&&Math.abs(coords.longitude)<=180
    &&Number.isFinite(coords.accuracy)&&coords.accuracy>=0&&coords.accuracy<=5000;
}
export function followZoom(accuracy,currentZoom,hasPreviousFix=false){
  if(!Number.isFinite(accuracy)||!Number.isFinite(currentZoom))return currentZoom;
  if(accuracy<=250)return Math.max(17,currentZoom);
  if(hasPreviousFix)return currentZoom; // Never override the user's later zoom.
  const safe=accuracy<=500?15:accuracy<=1500?13:11;
  return Math.min(currentZoom,safe);
}
export function followMovement(distanceMetres,elapsedMs,accuracyMetres){
  return Number.isFinite(distanceMetres)&&distanceMetres>=Math.max(15,(Number.isFinite(accuracyMetres)?accuracyMetres:100)*.4)&&elapsedMs>=3000;
}

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
export function followMovement(distanceMetres,elapsedMs,accuracyMetres){
  return Number.isFinite(distanceMetres)&&distanceMetres>=Math.max(15,(Number.isFinite(accuracyMetres)?accuracyMetres:100)*.4)&&elapsedMs>=3000;
}

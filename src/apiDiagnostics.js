// Memory-only, allowlisted diagnostics: never store URLs, request options,
// credentials, coordinates, object IDs, response bodies or raw error messages.
const METHODS = ['box','place.getbyarea','place.getbyid','search'];
const SITE_METHODS = ['tiles','place','search'];
const FAILURES = ['offline','auth','quota','schema','api','timeout','network','input','unknown'];
const empty = () => ({requests:0,success:0,errors:Object.fromEntries(FAILURES.map(k=>[k,0])),latencyTotalMs:0});
let methods = Object.fromEntries(METHODS.map(k=>[k,empty()]));
let coverage = {complete:0,partial:0,unknown:0};
let siteMethods = Object.fromEntries(SITE_METHODS.map(k=>[k,empty()]));
let siteParseFailures = {tiles:0};
const TILE_REASONS = ['html','header','rows','empty','body','unknown'];
const emptyTileReasons = () => Object.fromEntries(TILE_REASONS.map(k=>[k,0]));
let tileParseReasons = emptyTileReasons();
let tileDecode = {complete:0,partial:0,parent:0};
const emptyRefresh = () => ({pressed:0,started:0,blocked:{busy:0,map:0,zoom:0,demo:0}});
let manualRefresh = emptyRefresh();

export function recordApiMetric(method, elapsedMs, failureKind = null) {
  if (!Object.hasOwn(methods, method)) return;
  if (failureKind === 'cancelled') return;
  const item = methods[method];
  item.requests++;
  if (failureKind === null) item.success++;
  else item.errors[FAILURES.includes(failureKind) ? failureKind : 'unknown']++;
  const ms = Number(elapsedMs);
  if (Number.isFinite(ms) && ms >= 0) item.latencyTotalMs += Math.min(Math.round(ms), 60000);
}
export function recordCoverage(loaded, found, complete) {
  // Only counts and completeness are aggregated, never a location or polygon.
  if (!Number.isSafeInteger(loaded) || loaded < 0) return;
  if (complete === true) coverage.complete++;
  else if (complete === false && Number.isSafeInteger(found) && found >= loaded) coverage.partial++;
  else coverage.unknown++;
}
// Website traffic is separate from REST API usage. Do not record tile IDs,
// URLs, coordinates, credentials, raw responses or exception messages.
export function recordSiteMetric(method, elapsedMs, failureKind = null) {
  if (!Object.hasOwn(siteMethods, method) || failureKind === 'cancelled') return;
  const item = siteMethods[method];
  item.requests++;
  if (failureKind === null) item.success++;
  else item.errors[FAILURES.includes(failureKind) ? failureKind : 'unknown']++;
  const ms = Number(elapsedMs);
  if (Number.isFinite(ms) && ms >= 0) item.latencyTotalMs += Math.min(Math.round(ms), 60000);
}
export function recordSiteParseFailure(method,reason='unknown') {
  if (!Object.hasOwn(siteParseFailures, method)) return;
  siteParseFailures[method]++;
  tileParseReasons[TILE_REASONS.includes(reason)?reason:'unknown']++;
}
export function recordTileDecode(partial=false,parent=false){
  tileDecode[partial?'partial':'complete']++;
  if(parent)tileDecode.parent++;
}
export function recordManualRefreshEvent(event) {
  if (event === 'pressed' || event === 'started') manualRefresh[event]++;
  else if (typeof event === 'string' && event.startsWith('blocked_')) {
    const reason = event.slice('blocked_'.length);
    if (Object.hasOwn(manualRefresh.blocked, reason)) manualRefresh.blocked[reason]++;
  }
}
const metricSnapshot = item => ({
  total:item.requests, success:item.success, failures:{...item.errors},
  averageLatencyMs:item.requests ? Math.round(item.latencyTotalMs/item.requests) : null
});
export function diagnosticSnapshot() {
  return {
    schema: 4,
    storage: 'memory-only',
    sharing: 'manual',
    requests: Object.fromEntries(METHODS.map(name => [name,metricSnapshot(methods[name])])),
    site: Object.fromEntries(SITE_METHODS.map(name => [name,metricSnapshot(siteMethods[name])])),
    siteParseFailures:{...siteParseFailures},
    tileParseReasons:{...tileParseReasons},
    tileDecode:{...tileDecode},
    manualRefresh:{...manualRefresh,blocked:{...manualRefresh.blocked}},
    coverage:{...coverage}
  };
}
export function clearDiagnostics() {
  methods = Object.fromEntries(METHODS.map(k=>[k,empty()]));
  coverage = {complete:0,partial:0,unknown:0};
  siteMethods = Object.fromEntries(SITE_METHODS.map(k=>[k,empty()]));
  siteParseFailures = {tiles:0};
  tileParseReasons = emptyTileReasons();
  tileDecode = {complete:0,partial:0,parent:0};
  manualRefresh = emptyRefresh();
}

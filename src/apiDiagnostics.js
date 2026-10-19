// Memory-only, allowlisted diagnostics: never store URLs, request options,
// credentials, coordinates, object IDs, response bodies or raw error messages.
const METHODS = ['box','place.getbyarea','place.getbyid','search'];
const FAILURES = ['offline','auth','quota','schema','timeout','network','input','unknown'];
const empty = () => ({requests:0,success:0,errors:Object.fromEntries(FAILURES.map(k=>[k,0])),latencyTotalMs:0});
let methods = Object.fromEntries(METHODS.map(k=>[k,empty()]));
let coverage = {complete:0,partial:0,unknown:0};

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
export function diagnosticSnapshot() {
  return {
    schema: 1,
    storage: 'memory-only',
    sharing: 'manual',
    requests: Object.fromEntries(METHODS.map(name => {
      const item = methods[name];
      return [name, {
        total:item.requests,
        success:item.success,
        failures:{...item.errors},
        averageLatencyMs:item.requests ? Math.round(item.latencyTotalMs/item.requests) : null
      }];
    })),
    coverage:{...coverage}
  };
}
export function clearDiagnostics() {
  methods = Object.fromEntries(METHODS.map(k=>[k,empty()]));
  coverage = {complete:0,partial:0,unknown:0};
}

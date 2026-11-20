import test from 'node:test';
import assert from 'node:assert/strict';
import {clearDiagnostics,diagnosticSnapshot,recordManualRefreshEvent,recordSiteMetric,recordSiteParseFailure} from '../src/apiDiagnostics.js';

test('manual refresh is observable even when no API request was made',()=>{
  clearDiagnostics();
  recordManualRefreshEvent('pressed');
  recordManualRefreshEvent('started');
  recordManualRefreshEvent('pressed');
  recordManualRefreshEvent('blocked_zoom');
  recordManualRefreshEvent('blocked_invalid'); // Ignore unexpected labels.
  const data=diagnosticSnapshot();
  assert.equal(data.schema,2);
  assert.equal(data.manualRefresh.pressed,2);
  assert.equal(data.manualRefresh.started,1);
  assert.equal(data.manualRefresh.blocked.zoom,1);
  assert.equal(data.manualRefresh.blocked.map,0);
  assert.equal(data.requests.box.total,0);
  clearDiagnostics();
  assert.equal(diagnosticSnapshot().manualRefresh.pressed,0);
});

test('website tile traffic, parse errors, and REST API are accounted separately',()=>{
  clearDiagnostics();
  recordSiteMetric('tiles',75);
  recordSiteMetric('tiles',150,'network');
  recordSiteMetric('place',40,'quota');
  recordSiteMetric('search',12,'cancelled');
  recordSiteParseFailure('tiles');
  const data=diagnosticSnapshot();
  assert.equal(data.site.tiles.total,2);
  assert.equal(data.site.tiles.success,1);
  assert.equal(data.site.tiles.failures.network,1);
  assert.equal(data.site.tiles.averageLatencyMs,113);
  assert.equal(data.site.place.failures.quota,1);
  assert.equal(data.site.search.total,0);
  assert.equal(data.siteParseFailures.tiles,1);
  assert.equal(data.requests.box.total,0);
  clearDiagnostics();
  assert.equal(diagnosticSnapshot().site.tiles.total,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {clearDiagnostics,diagnosticSnapshot,recordManualRefreshEvent,recordSiteMetric,recordSiteParseFailure,recordTileDecode} from '../src/apiDiagnostics.js';

test('manual refresh is observable even when no API request was made',()=>{
  clearDiagnostics();
  recordManualRefreshEvent('pressed');
  recordManualRefreshEvent('started');
  recordManualRefreshEvent('pressed');
  recordManualRefreshEvent('blocked_zoom');
  recordManualRefreshEvent('blocked_invalid'); // Ignore unexpected labels.
  const data=diagnosticSnapshot();
  assert.equal(data.schema,4);
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
  recordSiteParseFailure('tiles','html');
  recordSiteParseFailure('tiles','header');
  recordTileDecode();
  recordTileDecode(true);
  recordTileDecode(false,true);
  const data=diagnosticSnapshot();
  assert.equal(data.site.tiles.total,2);
  assert.equal(data.site.tiles.success,1);
  assert.equal(data.site.tiles.failures.network,1);
  assert.equal(data.site.tiles.averageLatencyMs,113);
  assert.equal(data.site.place.failures.quota,1);
  assert.equal(data.site.search.total,0);
  assert.equal(data.siteParseFailures.tiles,2);
  assert.equal(data.tileParseReasons.html,1);
  assert.equal(data.tileParseReasons.header,1);
  assert.equal(data.tileDecode.complete,1);
  assert.equal(data.tileDecode.partial,1);
  assert.equal(data.tileDecode.parent,1);
  assert.equal(data.requests.box.total,0);
  clearDiagnostics();
  assert.equal(diagnosticSnapshot().site.tiles.total,0);
  assert.equal(diagnosticSnapshot().tileParseReasons.html,0);
  assert.equal(diagnosticSnapshot().tileDecode.complete,0);
  assert.equal(diagnosticSnapshot().tileDecode.parent,0);
});

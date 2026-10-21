# WikiReader Next 0.8.0 — map discovery implementation

Status: candidate branch `feat/map-discovery-080`; not a published release.
Base: Next 0.7.3; Android Auto PR #12 remains independent.

## Scope
- The top search icon opens a non-modal search panel **over the map**. Existing bottom-navigation Search remains supported.
- A neighboring map icon opens the list of polygons that intersect the current map viewport (already loaded or cached). The list is not a claim of complete Wikimapia coverage.
- Opening an object from either panel preserves its panel and search query. Closing its card restores the previous panel.
- The polygon display preference is Auto / Detailed / Calm, available both in the list and in Settings and stored independently of the API key.
- Layer reconciliation updates unchanged Leaflet objects in place, replaces geometry on fresh responses, and removes layers that are no longer in the viewport instead of clearing all layers per page.
- Density styles change opacity and width, **never erase objects from hit testing or source data**.
- The API endpoint, 6-second request interval, cache structure and encryption remain unchanged.

## Acceptance and regression checklist
- [ ] Node unit tests for viewport intersection, invalid coordinates, selection contrast and density preference.
- [ ] Playwright demo list -> object -> list and back navigation.
- [ ] Playwright live/mock API search over map, query preservation and card return.
- [ ] Playwright density persistence through Settings and reload.
- [ ] Legacy search, object chooser, sheet gestures, cached areas and UI regression suite.
- [ ] Android JVM unit test, lint and APK build, signed with preserved Next key.
- [ ] Independent review of changed code and Android package identity.
- [ ] Physical Android: at least small portrait + short landscape, accessibility and performance in dense areas.
- [ ] GitHub Release APK+SHA256 from the signed, accepted commit.

## Deferred from 0.8
Reading improvements, photo viewer, true dark map, offline place details, GPS follow and deprecated-API resilience remain in subsequent iterations. Do not merge Android Auto PR #12 into this work.

Known limits: The visible-object list includes polygons returned so far; incomplete API paging may leave out objects. A polygon's bounding rectangle can intersect a viewport without its surface intersecting it, so the list errs on the side of inclusion. Viewport culling reduces work; actual frame-rate improvement needs a physical-device benchmark.

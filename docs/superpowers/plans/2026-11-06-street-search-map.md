# Street Search Map Implementation Plan

> **For agentic workers:** Use executing-plans inline and test-driven-development. Track the steps here.

**Goal:** Replace walking GPS navigation with four real algorithm search animations on the same small street map.
**Architecture:** Reuse local Leaflet and the map-mode seam. Bundle a licensed real OSM graph; pure JS solvers produce immutable recorded events and an independent four-track player. The map controller renders those events using one frame scheduler.
**Tech Stack:** Existing vanilla JS/Leaflet 1.9.4 and C++ static server; Node/Python/native test suite.
**Spec:** `docs/superpowers/specs/2026-11-06-street-search-map.md`

## Constraints and review focus

- Preserve maze algorithms, controls, shared playback, saved data and public APIs. No new dependency, GPS, live route service, comparison table, or playback-progress UI.
- Four simultaneous maps share graph/endpoints; each solver keeps its own actual visited/frontier/path state and completion.
- Validate graph weights/geometry and endpoint selections. A* must match Dijkstra; BFS must minimize represented edges, not geographic distance.
- Deterministic traces, disconnected/one-node/cyclic graphs, replay resets and cancellation after endpoint/mode changes need tests.
- Runtime measures browser search and trace/reconstruction only; graph parsing, network, and animation are outside it. A zero sample displays below timer resolution.
- No browser/device runs. Independent reviewer remains unavailable after the documented account limit; do a separate self-review and report this boundary.

## Task 1: Bundle graph and implement pure solver/playback

Files: create `public/berlin-network.json`; replace only owned GPS logic in `public/map-logic.js` and its `tests/map_logic_test.cjs`.
Interfaces: `prepareStreetGraph(raw)`, `streetDistance(a,b)`, `nearestStreetNode(graph,point)`, `runStreetSearch(graph,start,goal,algorithm,clock)`, `createStreetPlayback(results,nodeCount)`, `advanceStreetPlayback(player)`, `resetStreetPlayback(player)`.

- [x] Add failing tests for core-four paths/traces, shortest-distance and fewest-edge tradeoffs, no path/one node, deterministic ties, and independent playback/replay.
- [x] Generate local graph from the already fetched bounded OSM snapshot; retain junctions/ends and edge shape, distance, and provenance. Test source geometry lengths and connectivity.
- [x] Implement pure solvers, validated weights, actual recorded events, runtime, nearest-node selection, and four independent tracks; run Node checks.

## Task 2: Four-map interface and controller

Files: replace only owned GPS code in `public/map.js`/`tests/map_controller_test.cjs`; update `public/index.html`, `public/styles.css`, `public/app.js`, `tests/ui_structure_test.py`, and current guide.
Interfaces: `StreetMapController.open()/close()` retain the top map toggle seam. Render four lanes from canonical algorithms, common endpoint controls, and shared run/pause/step/replay/clear actions. Local graph fetch is abortable and map views are bounded/synchronized.

- [x] Add failing controller/static checks for four panes, actual animation/metrics, no GPS or routing-service calls, endpoint invalidation and mode cleanup.
- [x] Replace navigation controls/analytics with street-search UI, remove obsolete GPS code, and keep the maze unaffected.
- [x] Verify missing-library/data failures, keyboard selection, linked views, independent completion, pause/step/replay and state reset with controlled doubles.

## Task 3: Final proof and documentation

- [x] Update the current guide; annotate the prior walking spec as superseded rather than erasing historical work.
- [x] Run full `python3 tests/run_tests.py --no-browser`, formatting/syntax checks, real dataset solver checks and live asset delivery. Inspect current DB before/after without overwriting concurrent saves.
- [x] Perform separate self-review; record results and browser/device limits.

## Ledger

- Approval: user accepted the small Berlin area and explicitly requested seeing each algorithm operate. Four simultaneous panes satisfy that request without another selector/approval round.
- Ruling: existing directory is not a Git repository; edit in place with no worktree/commit scripts. Cost: no Git rollback history.
- Ruling: no repeat reviewer dispatch after the prior account-limit failure; use explicit self-review. Cost: no independent review of this feature.
- Pre-flight: graph indexes, event node/edge indexes, canonical algorithm order, and controller lane order must agree. Runtime formatting belongs to the controller; algorithms return numeric milliseconds.
- Data research: read-only Overpass request returned 978 OSM nodes and 397 ways for bbox 52.519,13.398,52.523,13.405 at OSM base timestamp 2026-11-06T07:26:52Z. Bounded/largest-component extraction and shape-node collapse yields 280 junction/end nodes and 371 edges before final metadata generation.
- RED→GREEN: pure tests failed on missing `runStreetSearch`, controller tests failed on missing `StreetMapController`, and static checks failed on absent four-map containers before implementation. Node solver/playback and controller checks now pass, as do all 12 structural checks. Weighted fixture shows BFS's 2-edge cost-21 route versus Dijkstra/A*'s 4-edge cost-4 route; 20 real snapshot pairs prove A*/Dijkstra distance agreement. No GPS or remote routing calls remain in active app modules.
- Data preservation baseline for this pass: current `algo.db` checksum `187b815949fee44c72fca7b9a88223c1667988c640ccfd5a954cafc4f0504471`; no database writes are part of this feature.
- Final proof: after formatting, `python3 tests/run_tests.py --no-browser` passes native build/CTest, existing maze analytics/playback, new street solver/controller tests, all 12 structural checks, and disposable API integration. Prettier checks pass. The full actual Berlin snapshot also completes all four tracks through the controller's controlled map/frame harness; A*/Dijkstra agree on distance. Keyboard selection, missing-library/data failure, outside-area clicks, hidden-page pause, and late-load cancellation pass.
- Live HTTP proof: HTML, CSS, controllers, pure logic, Leaflet assets, and the bundled graph match current files byte-for-byte. The graph delivered by the running server solves all four real traces and resets accurately through the pure model. Saved database checksum above remains unchanged. Optional browser scripts parse but were not run.
- Final review: self-review only, after implementation as a separate pass. Checked priority-queue ties/stale entries, positive-distance/A* lower-bound validation, path adjacency/weights, shared input with independent state/completion, frame cleanup, camera feedback guards, permanent endpoint labels, local-only graph fetching, and all native/GPS-removal boundaries. No substantive findings or deferred changes. No browser, device, screenshot, or actual Leaflet rendering check was performed; user owns interactive validation. No commits/pushes because the workspace has no Git repository.

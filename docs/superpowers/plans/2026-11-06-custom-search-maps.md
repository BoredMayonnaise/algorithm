# Two custom search maps

> Historical implementation record. The user subsequently requested removal of the entire Map feature and page; map code/assets/tests have been removed. The maze lab remains.

## Approved brief

Replace geographic map mode with two simple node-and-edge diagrams. Use larger, spaced-out nodes, randomized shared networks, and building boxes between roads. Each pane selects BFS, DFS, Dijkstra, or A*; defaults BFS/A*. Preserve shared endpoints, real traces, independent analytics/completion, pause/step/replay, maze lab, saved data, and public APIs. No tiles, geographic labels, GPS, route service, progress bar, or new dependencies. No browser/device/screenshot runs.

## Design

Reuse current typography and shell. Diagram palette: ground #101c2c, roads #8294aa, buildings #26384d, explored #3eb5cf, frontier #a78bfa, route #f6bf60. Two left-aligned panes: `[Algorithm | State] / diagram / metrics`. Use 24 numbered nodes, 44px native buttons, generous grid spacing with small jitter, simple SVG edges and rectangular buildings. Keep the diagram readable through local scrolling on narrow screens, not shrunken touch targets. Weight labels describe abstract cost, not metres. Buildings occupy road-free blocks; they are not nodes or traversable areas. No ornamental motion or new visual shell.

## Tasks

- [x] 1. Add failing pure tests for randomized connected planar graphs, node spacing, building/road separation, A*/Dijkstra agreement, and two-track replay. Implement `generateStreetNetwork(random=Math.random)` and planar graph support while preserving geographic helper compatibility.
- [x] 2. Add failing controller/structure tests for two selectors, defaults, shared randomization/endpoints, native keyboard node activation, playback cancellation/reset, real metrics, and zero external requests. Replace Leaflet rendering with SVG plus native node buttons; remove active geographic markup/includes and update styles.
- [x] 3. Update current guide and superseded spec. Run full browser-free suite, formatting, live asset delivery, and data preservation checks. Review the whole change and record limitations.

## Interfaces and verification

Task 1 produces raw `coordinateSystem: 'diagram'` graphs with Euclidean lower-bound edge costs and `buildings`; Task 2 prepares once and shares the same graph and endpoints across both lanes. Existing search and playback result/event structures stay unchanged. Two or four distinct core results are accepted by playback, preserving old callers. Selector collisions swap the other pane to keep algorithms distinct. Randomization cancels playback and clears all stale metrics.

Commands: `node tests/map_logic_test.cjs`, `node tests/map_controller_test.cjs`, `python3 tests/ui_structure_test.py`, `python3 tests/run_tests.py --no-browser`; each must pass after its implementation. Use existing cached Prettier, not a new package install.

## Ledger

- Approved scope is fully specified; no further design questions needed.
- Workspace has no Git repository. Edit in place; Git workspace/commit helpers do not apply. Keep this ledger permanently.
- Pre-flight: planar distance must be used both for graph weight validation and A*; renderer and solver must share node/edge indexes. Buildings must avoid all candidate roads, not only current selected edges.
- Keep inactive Berlin data and vendored Leaflet files for compatibility/history; remove all UI loads and network dependence. Do not delete unrelated files or touch the saved database.
- Task 1 RED: generator missing. GREEN: 60 seeded networks, all 24 nodes reachable, all start-to-node A*/Dijkstra costs equal, separated nodes/roads/buildings, two-track completion/reset, existing geographic/traces/edge-case tests pass. Building maximum reduced from 48 to 40 units after seed 50 exposed corner overlap with a 44px node bounding box.
- Task 2 RED: controller still had four lanes; structural check lacked selectors. Replacing only map renderer and controls; maze integration seam (`StreetMapController.open/close`) remains unchanged.
- Task 2 GREEN: controller tests and all 12 structural checks pass. Exactly two diagrams, selectable distinct core algorithms with BFS/A* defaults, shared native-button endpoints, buildings/roads, randomization clearing old tracks, replay, independent completion, actual metrics, same-node zero-cost path, mode/hidden-page pause, and no external calls. Native Enter/Space behavior and rendered geometry remain user-owned browser checks; the harness proves button semantics and activation handlers, not browser behavior.
- Verification baseline: saved database SHA-256 `187b815949fee44c72fca7b9a88223c1667988c640ccfd5a954cafc4f0504471`. No writes are part of this task.
- Final independent code review completed. One Important finding: `pagehide` disabled map controls without `pageshow` restoration. Verified against actual app lifecycle wiring, added failing restoration test, then a three-line persisted-pageshow handler. Controller tests now pass; visible map reactivates paused, hidden map stays closed.
- Review boundaries: reviewer did not judge browser geometry, actual native keyboard/device behavior, database integrity, or historical attribution without Git. Browser/device limits remain explicit; database integrity will be checked by SHA-256. Git history does not exist, so no historical regression attribution is claimed. No other findings or deferred minors.
- Final proof after the review fix: full `python3 tests/run_tests.py --no-browser` passes native build/CTest, maze analytics/playback, map logic/controller tests, all 12 structural checks, and disposable API integration. Prettier checks pass for all touched HTML/CSS/JS/tests. Live HTTP assets match current files byte-for-byte with exactly two map panes/selectors and no Leaflet or Berlin-data include. Saved database hash remains unchanged. No browser, screenshot, device, or emulator was run.
- No commits/pushes or destructive cleanup: workspace has no Git history. Implementation, tests, guide, and this ledger remain in place.

# Walking Map Implementation Plan

> **For agentic workers:** Use executing-plans inline and test-driven-development. Track progress here.

**Goal:** Add a minimal real walking map with foreground GPS directions and honest route analytics.
**Architecture:** Local Leaflet renders tiles; a small pure JavaScript module validates pedestrian routes and calculates progress; a separate controller owns GPS/network lifecycles. Keep the existing C++ solver, data, and maze playback intact.
**Tech Stack:** Existing vanilla JS/C++ static server; locally served Leaflet 1.9.4; OSM tiles and FOSSGIS OSRM foot service.
**Spec:** `docs/superpowers/specs/2026-11-06-walking-map.md`

## Global Constraints

- No browser/Playwright/device/emulator/screenshot runs; no user GPS requests from tools, paid services, accounts, data migrations, or persistent location history.
- External map/route requests start only through map interaction. GPS requires an explicit action and clear third-party disclosure.
- Preserve all maze behavior and core algorithm analytics; do not pretend the routing provider exposes algorithm internals.
- Community service limit: at most one route request/second; auto rerouting at most once/30 seconds and only after repeated accurate off-route fixes.

## Review Focus

- Wrong coordinate order, nonwalking steps, malformed or empty geometry, missing maneuvers: reject without misleading route output.
- Projection and arrival near loops/intersections, poor/stale/out-of-order GPS: do not advance guidance on unreliable fixes.
- New destinations, stopped/hidden GPS, hidden panel, delayed network responses: cancel and reject stale results.
- Repeated clicks and repeated off-route updates: serialized network requests, no automatic request storm.
- Map dependency/network/GPS failure: leave maze usable and display honest failure status.

## Tasks

### 1. Pure walking route logic

Files: new `public/map-logic.js`, `tests/map_logic_test.cjs`.
Interfaces: `walkingPoint`, `walkingDistance`, `parseWalkingRoute`, `walkingProgress`, `walkingInstruction`, `usableWalkingFix` as global functions for controller and Node VM tests. Coordinates use `[latitude,longitude]` internally and convert GeoJSON explicitly. Parsed routes include total distance/duration, points, cumulative geometry lengths, and ordered step offsets.

- [x] Write tests for route validation, pedestrian-only modes, endpoint snapping, projection/remaining distance, instructions, no-route/one-point cases, and fix freshness/accuracy; observe RED.
- [x] Implement pure functions with bounded geometry sizes and fail-closed validation; run tests GREEN.

### 2. Walking controller and minimal UI

Files: new `public/map.js`, `tests/map_controller_test.cjs`; local `public/leaflet.js`, `public/leaflet.css`, `public/leaflet-license.txt`; modify `public/index.html`, `public/styles.css`, `public/app.js`, `tests/ui_structure_test.py`, `tests/run_tests.py`.
Interfaces: map controller class `WalkingMapController` owns route state, explicit GPS, cancellation, throttling, and map rendering. Add top `mapModeBtn`, map panel, location/start/destination/route/stop buttons, plain directions, and metric fields. Maze pause integration remains a small app.js handler. Leaflet loads from local files and does not fetch tiles until the Map button opens the pane.

- [x] Write failing controlled-controller and markup checks before implementation.
- [x] Download official pinned mapping assets, retain license, and implement controller + minimal markup/styles. Use textContent for all external labels.
- [x] Check GPS opt-in/cancellation, route epoch guards, throttle, poor fixes, rerouting, hidden-page behavior, keyboard point selection, and safe failure without browsers.

### 3. Verification and current guide

Files: modify `docs/classroom-ui.md`, this plan/spec; no maze API changes.

- [x] Run full `python3 tests/run_tests.py --no-browser`, local JS formatting/syntax and optional browser-script syntax.
- [x] Self-review as a separate pass if independent review remains unavailable. Probe only public sample coordinates; verify walking step modes and exact live asset delivery; confirm database hash unchanged.
- [x] Record limitations: no real GPS/browser validation, no production navigation claim, community endpoint availability, HTTP-IP GPS limitation.

## Ledger

- Ruling: no Git repository; use existing workspace without Git/worktree/commit helper scripts. Cost: no Git rollback history.
- Ruling: independent builder check failed with `subscription_sharing_usage_limit_exceeded`; no repeated dispatch. Continue inline after user's “continue,” with self-review explicitly labeled. Cost: no fresh reviewer for this feature.
- Approval: user's “continue” follows walking/minimal/functional-map scope; implement this narrow foreground version, not a full navigation product.
- Pre-flight: Task 1 produces parsed route/progress/validation contracts consumed by Task 2. Task 2 owns external side effects and leaves maze state isolated. Verification uses disposable databases and controlled GPS/network doubles.
- Tasks 1–2: observed missing-module RED for pure logic/controller and absent-controls RED for markup before implementation. Added isolated modules, top mode switch, real map, route steps and analytics. Full browser-free suite passes with 12 static checks, native/maze/analytics/playback/API checks, and new map Node tests. Leaflet JS SHA-256 matches the pinned distribution integrity; CSS was cross-checked byte-for-byte against two independent pinned distributors, and the original license is retained.
- Self-review fixes: reproduced and fixed a 1500 m GPS jump advancing instructions, a short loop falsely advancing near its end, GPS failing to center the example map on the first real fix, and stale remaining-distance output on off-route fixes. Each regression failed before its narrow fix and now passes. Endpoint-change, no-route, and hidden-page cases also pass. No review subagent was retried after the account-limit failure.
- Live HTTP checks: current map/controller/local Leaflet assets match files exactly; JavaScript MIME types are correct. One public-coordinate FOSSGIS response passed through the actual pure parser/progress/instruction functions and returned pedestrian directions. No actual GPS or browser was used.
- Data preservation: the historical database checksum from earlier work no longer matches. Read-only inspection found an existing main-server `POST /api/mazes` at 07:01:33 UTC, matching the database mtime. This map implementation and smoke checks did not issue that save and do not modify the database. Preserve the current database (`187b815949fee44c72fca7b9a88223c1667988c640ccfd5a954cafc4f0504471`), do not restore the old checksum or discard the save.
- Final verification: after all source changes/formatting, the complete browser-free suite, Prettier checks, live asset equality checks, and optional Python script syntax checks pass. The current database checksum above remains unchanged across final verification. No source changes followed those passing checks.
- Final review: self-review only; independent review unavailable due the reported account limit. No deferred substantive findings. Native maze algorithms/data remain unchanged; provider route latency is explicitly not algorithm runtime. Foreground-only use, third-party coordinate logging, lack of service guarantees, HTTPS/localhost requirement, and lack of browser/physical GPS testing are disclosed in the UI and guide.

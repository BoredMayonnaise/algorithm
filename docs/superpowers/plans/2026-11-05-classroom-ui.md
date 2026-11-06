# Classroom UI Implementation Plan

> **For agentic workers:** Use executing-plans inline. Track progress below.

**Goal:** Implement the user's classroom demonstration brief, not a static mockup.
**Architecture:** Keep HTML, local CSS, vanilla JavaScript, DOM grid, Crow/C++17, and SQLite. Add optional event traces to existing API responses. Separate the editable maze, immutable request snapshots, recorded events, and frame-scheduled playback.
**Spec:** User's current classroom UI brief supersedes the older proposed improvement design. No Vite, framework migration, hosting, or database migration is needed.

## Design

- Navy `#0b1220`, panel `#111c2e`, border `#29384e`, text `#e5edf7`; exploration cyan `#4fc9dc`, frontier violet `#a78bfa`, route amber `#f6bf60`, start green, goal coral.
- Use local system sans-serif for labels; system monospace only for numerical readings.
- Wide, left-aligned workbench: board 74%, inspector 26%; compact header and playback toolbar. Comparison immediately follows the board, not the full inspector.
- The maze is the distinctive visual element. No decorative glow, external assets, giant headings, or decorative motion.
- Phone stacks panels; board has explicit Fit/Zoom/Pan controls and keyboard navigation. Presentation hides only secondary setup.

## Global constraints

- Keep all legacy success fields, algorithms, tie-breaking, saved data, and persistence endpoints.
- Four-direction movement only; positive entry weights, dimensions 1..60; generation 5..60. Reject invalid requests without clamping.
- Trace real insertion, expansion, stale removal, and reconstruction events. Report pending frontier entries, not unique cells.
- Single-run server times exclude transport/playback; identify trace overhead and single-sample limitations.
- Never use the user's SQLite file for tests. No new runtime dependencies.

## Review focus

- Late responses after edits/regeneration must never restore old traces.
- Invalid imports must leave the current workspace unchanged.
- Demo must preserve a restorable pre-demo workspace.
- Resizing/fitting must retain visible endpoints; touch pan must not draw.
- No-path and start-equals-goal results must not misreport successful path metrics.

## Tasks

- [x] 1. Add native algorithm trace tests; observe failure, then instrument solvers and generation without changing paths. Add CTest. Verify all solvers, weighted detour, pending-count accounting, deterministic replay, and no path.
- [x] 2. Add browser regression checks; observe missing behavior. Implement local HTML/CSS workbench and event-based playback, progressive path, live metrics/explanations, drawing/keyboard/touch, zoom/pan, demo restore, and presentation.
- [x] 3. Preserve comparison, persistence, import/export with atomic validation and stale-response protection. Verify live requests against an isolated temporary database.
- [x] 4. Build, run CTest and browser flows; inspect desktop/mobile screenshots; fix clipping. Document verified behavior and limitations.

## Evidence and rulings

- Baseline: Chromium on 1440×1000; Run produced 8 explored cells after 300 ms and 32 after 1000 ms. Animation exists. Frontier stays zero because no insertion events are returned or consumed. Completed metrics and “Path found” appear before visualization finishes. Grid is 795 px wide and clipped vertically at 700 px. Cells are re-created on every paint, invalidating listeners/visual state. Separate Run/Play and unguarded requests permit overlapping/stale playback.
- Ruling: Keep native CSS instead of adding a CSS build system; the current brief requires the existing stack and no unnecessary dependencies.
- Ruling: This folder has no Git repository; work in place and retain the progress record. Do not initialize Git or claim commits.
- Native RED→GREEN: missing trace accounting failed `expanded == run.exploredNodes`; optional real events now pass paths/weights/entry counts/determinism/unreachable/one-cell checks.
- Browser RED→GREEN: original UI had no frontier cells; marker save/load integration exposed dropped markers; both are covered and fixed.
- Final independent code review: found continued pointer strokes could mutate a keyboard-requested snapshot. Held-stroke regression failed before the fix, then passed after ending pointer capture before requests, comparison, and layout replacement. Added accessible frontier/explored cell labels as requested by review. No backend findings; no deferred review findings.
- Screenshot refinement: moved primary playback above the board, widened the deterministic example to 17×37, reduced phone overview whitespace, retained live narration near the phone board, and raised cell-state contrast. Phone overview regression failed before sizing change, then passed.
- Honest playback rate: generation rate label regression failed before the label reflected actual changes/s; label and scheduler now share rate calculation, including path reconstruction cap.
- Full verification: `python3 tests/run_tests.py` passes build, JavaScript syntax, CTest, API integration, Chromium desktop/phone/tablet/landscape, keyboard, reduced motion, held strokes, late requests, maximum-size reset, and emulated touch paint/pan. Uses disposable databases only.
- Runtime: restarted original local server on 8080; real frontier smoke passed. Repository `algo.db` SHA-256 stayed `6ccc4f768d0db7d2036c88260a8adff9838c8daf5ce659b52f29a4ff0dffc1c4` before/after restart.
- Limits: no physical-device, non-Chromium, or projector testing; demo backup is page-memory only; existing public-hosting/backend hardening remains out of scope.

## Scoped refinement pass

- User authorization: implement refinements, but do not run browsers or physical-device tests. Earlier browser evidence above belongs to the initial redesign, not this pass.
- Scope: simplify the main maze workflow without changing algorithms, playback, persistence, endpoints, or control IDs.
- Acceptance: board follows the compact app header; comparison stays directly reachable; replacement actions state their consequences; teaching guarantees and recovery instructions remain; HTML/CSS are readable; keyboard/ARIA bindings and actions survive structural checks.
- [x] Inspect current brief, instructions, UI sources, and existing checks; baseline native and static structural checks pass.
- [x] Remove repeated headings/taglines and redundant teaching copy; use New grid and Run demo; keep replacement/memory limits visible.
- [x] Format existing HTML/CSS and remove only styles for deleted decorative UI. Keep the navy palette, board states, breakpoints, and motion preferences.
- [x] Add browser-free structural checks and an explicit `--no-browser` runner option; update the existing guide.
- [x] Run browser-free build/native/API/static checks; inspect source changes and report unverified rendered/interactive behavior.
- Evidence: `python3 tests/run_tests.py --no-browser` passes the build, native trace test, JavaScript syntax, six structural/accessible-name checks, and three API integration groups on a disposable database. HTML/CSS pass the installed Prettier formatting check.
- Inspection: control IDs, keyboard handlers, solver/event handling, API payloads, import validation, and persistence behavior remain intact. Removed only decorative UI and its styles; kept the existing responsive rules, palette, and cell-state cascade. Comparison's scroll region now has a named keyboard entry and visible inset focus outline.
- Verification boundary: no browser, emulator, device, screenshot, interactive walkthrough, or real-user testing was run in this pass. Rendered layout, focus behavior, and visual consistency remain for the user to verify.
- Data: repository `algo.db` SHA-256 remains `6ccc4f768d0db7d2036c88260a8adff9838c8daf5ce659b52f29a4ff0dffc1c4`.

## Logic and analysis pass

- Scope: native solver correctness/input validation and useful same-maze comparison analysis; no telemetry, benchmark mode, new services, or browser/device tests.
- [x] Reproduce stale A* minimum-cost bug (expensive route chosen); derive bound from validated costs and reject malformed direct inputs before allocation. Native tests now include 80 seeded weighted-grid A*/Dijkstra checks.
- [x] Return actionable JSON 400s for malformed solver inputs and unknown/duplicate algorithm choices, retaining valid aliases and success response shapes.
- [x] Add a browser-free-testable comparison analysis helper: open/weighted cells, explored share, extra moves versus BFS, extra cost versus Dijkstra, and concrete A*/Dijkstra comparison. Handle no path, one-cell, ties, and small fractional weights without fake rankings.
- [x] Wire analysis into the existing comparison panel, retain measured timing caveats and full result precision, update guide, and run the non-browser suite against disposable data.
- RED→GREEN evidence: stale cached minimum made A* return cost 21 instead of 4; invalid native input lacked error reporting; fractional dimensions were accepted; analysis baselines/bar fractions were absent; tiny costs displayed zero and overly long fixed notation. Each regression now passes.
- Verification: `python3 tests/run_tests.py --no-browser` passes the native build/trace suite (including 80 seeded weighted grids), four pure Node analytics groups, seven static markup/script checks, and API integration/validation. HTML/CSS and new JS pass formatting checks with their existing quote conventions.
- Independent read-only review approved the scoped behavior with no blocking findings. No browser/device tools were used by implementer or reviewer.
- Runtime: restarted the existing 8080 server. HTTP health, exact delivery of tested `analysis.js`, and JSON 400 unknown-name behavior pass. Actual live comparison results also pass through the pure Node analytics model: the weighted fixture has fewest moves 2, lowest cost 4, and BFS extra cost 17. This was an API/Node check, not a browser walkthrough or benchmark.
- Boundaries: no new dependencies, telemetry, database tables, saved-data migrations, benchmark rankings, or timing averages. UI rendering/focus and real-user checks remain with the user. Broader generator, persistence-concurrency, and public-hosting hardening remain separate work.

## Simplified paired lab — 2026-11-06

- Target: one Generate button, automatically weighted mazes, fixed readable playback, and two algorithms on identical inputs. User's original immutable-maze comparison rule settles the shared-input decision; browser/device testing stays with the user.
- Acceptance: remove marker customization, row/column controls, generator options, manual weight controls, Current event narration, and speed slider; retain endpoints, draw/erase, save/load/import/export, four-algorithm analysis, pause/resume/step/replay/reset and presentation.
- Decisions: generated boards use 15×25; imported/saved dimensions remain intact. Keep four-way movement fixed for A* correctness/fairness. Default BFS and A*. Left board edits one shared layout, right board is explicitly read-only; zoom/scroll are linked. Generation adds loops and positive 2–9 weights, not a fabricated winner.
- [x] RED→GREEN: pure paired track model advances each unfinished trace, retains completed results, replays captured inputs, and rejects inconsistent traces. One RAF remains in the UI controller.
- [x] RED→GREEN: teaching generator returns solvable seeded weighted cyclic mazes, and its actual wall/cost events reconstruct the final grid. Legacy generator modes remain unchanged.
- [x] RED→GREEN: static checks require removed controls to be absent and both named boards to exist; local script loading order and action/ARIA references remain checked.
- [x] Complete source review and browser-free native/API/Node/static verification, including real solver traces through the pair model; update the existing guide and optional browser checks without launching them.
- Review found a cross-lane pacing issue: entering path reconstruction reduced the other board's rate. Mixed-phase regression failed with 60 versus 80 events/s. Fixed with the simpler shared constant 80 events/s for both search and path, rather than adding separate clock budgets. Generation remains 320 changes/s. Regression and full suite now pass.
- Evidence: `python3 tests/run_tests.py --no-browser` passes build/CTest (including 80 seeded weighted solver cases), pure analytics and pair-model tests, eight structural/ARIA/script checks, legacy API validation/persistence checks, and three seeded teaching-generator cases. Actual HTTP BFS/A* traces are played and reset through the Node pair model for each teaching seed.
- Optional browser scripts were updated for paired selectors, mirrored cells, removed controls, and dual-request cancellation. Only Python syntax was checked; they were not executed. No browsers, devices, screenshots, or real-user walkthroughs were used.
- Tradeoff: one editable input board and one read-only mirror make input equality explicit. New generation is fixed at 15×25; saved/imported layouts retain their dimensions and values. Marker rendering is standardized to S/G while legacy marker data stays in JSON. Movement is not randomized because that would undermine comparable solver rules and heuristic guarantees.
- Final runtime evidence: restarted the verified stale 8080 process with the current binary. Health is OK; HTML, CSS, analytics, playback, and controller assets match tested files byte-for-byte. A live seeded 15×25 teaching maze has 50 weighted cells; its real BFS/A* traces complete and reset through the Node pair model. The full browser-free suite passes again. `algo.db` SHA-256 remains `6ccc4f768d0db7d2036c88260a8adff9838c8daf5ce659b52f29a4ff0dffc1c4`. No browser/device checks, commit, or push performed.

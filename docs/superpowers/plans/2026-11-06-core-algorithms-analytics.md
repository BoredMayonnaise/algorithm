# Core Algorithms and Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Track each step here.

**Goal:** Prioritize the core four algorithms, add one optional greedy solver and meaningful per-board statistics, and remove branding/shortcut clutter.

**Architecture:** Extend the existing native solver/trace contract without changing existing algorithm behavior. Reuse the pure playback and analytics modules; render three small secondary metrics per board.

**Tech Stack:** Existing C++17 solver/Crow API, vanilla HTML/CSS/JavaScript, CTest, Node, Python.

**Spec:** `docs/superpowers/specs/2026-11-06-core-algorithms-analytics.md`

## Global Constraints

- Preserve BFS/A* defaults, existing four solver behaviors, legacy API/default comparison order and four-choice cap, persistence, saved data, and keyboard shortcuts.
- No dependencies, browser/device runs, screenshots, comparison table, or playback progress UI.
- UI follows existing colors, font, cell rendering, and layout. Align compact secondary statistics beneath each board; keep the maze as the focal point.

## Review Focus

- Greedy must use only heuristic priority and must not silently become A*; test an expensive direct route against Dijkstra's cheaper detour.
- No-path, one-cell, fractional-weight, and cyclic mazes must retain valid traces and honest unavailable average cost.
- Peak frontier must follow consumed events, remain stable during path reconstruction, and reset on replay.
- Removing branding/help must not remove actions, keyboard handlers, accessible workspace naming, or file controls.
- Core and optional choices must be grouped identically on both selectors, and all accepted solver names must replay successfully.

## Task 1: Optional Greedy Best-First solver

**Files:** `src/algo.h`, `src/algo.cpp`, `src/api.cpp`, `public/playback.js`, `tests/algo_test.cpp`, `tests/playback_test.cjs`, `tests/api_test.py`.

**Interfaces:** Keep `runAlgorithm(const MazeInput&, Algo, bool)` and trace shape unchanged. Add `Algo::GREEDY`, canonical name `Greedy Best-First`, accepted by `parseAlgo` and paired playback. Preserve comparison defaults/cap.

- [x] Add native and paired-model tests; observe unsupported-name failure before implementation.
- [x] Implement heuristic-only priority using existing deterministic neighbor/tie conventions, trace events, reconstruction, and measured runtime.
- [x] Check weighted nonoptimality, deterministic replay, unreachable/one-cell cases, 80 seeded reachability cases, and live API trace compatibility.
- [x] Run native/Node/API checks and record results.

## Task 2: Per-board analytics

**Files:** `public/playback.js`, `public/analysis.js`, `tests/playback_test.cjs`, `tests/analysis_test.cjs`.

**Interfaces:** Add `track.peakFrontier` initialized to zero and updated on events. Add `averageMoveCost(result)` returning total cost/moves for a successful positive-length route, otherwise `null`. Existing `formatExploration` supplies coverage.

- [x] Add failing tests for live peak/reset, average cost, no path, zero moves, and tiny fractional costs.
- [x] Implement minimal tracking/calculation; run Node suites.

## Task 3: Interface, documentation, final proof

**Files:** `public/index.html`, `public/styles.css`, `public/app.js`, `tests/ui_structure_test.py`, optional `tests/browser_test.py`, `docs/classroom-ui.md`, `docs/api.md`.

**Interfaces:** Both selectors group the existing four under “Core algorithms,” then Greedy under “More algorithms.” Add `peakValue`, `coverageValue`, `averageCostValue` with `Right` counterparts. Keep computation fields and playback handlers unchanged.

- [x] Add failing static checks for absent branding/cheat sheet, grouped choices, and named per-board fields.
- [x] Remove branding/help markup and associated styles, retain action header and accessible workspace title, and wire descriptions/metrics.
- [x] Update current guides and optional browser cases without executing browsers.
- [x] Run `python3 tests/run_tests.py --no-browser`, syntax-check optional scripts, review changes independently, then restart the verified local server and smoke-test assets/Greedy traces without database writes.

## Ledger

- Ruling: execute in the existing non-Git workspace, without worktree/commit helper scripts, because this directory has no Git repository. Cost: no Git rollback history; tests and this ledger provide the change record.
- Pre-flight: Task 1 produces the canonical name consumed by Task 3 selectors/descriptions and the existing playback allowlist. Task 2 produces live peak and average cost consumed by Task 3; these names match.
- Approval: user approved the scope and requested execution in the current session. Native implementation continues without another approval pause.
- Task 1 complete: native test failed on unsupported Greedy name and paired-model test rejected it before changes. Added deterministic heuristic-only solver without changing existing branches. `python3 tests/run_tests.py --no-browser` passes native, Node, static, and disposable API suites; includes actual Greedy traces through Node playback on three teaching mazes. No database writes to user data.
- Task 2 complete: new assertions failed on missing peak state and average-cost helper. Playback now tracks the actual peak as events are consumed and resets it on replay. Average cost excludes the starting cell via total cost/move count and is unavailable for no path or zero moves. Both Node suites pass, including tiny fractional costs and independent track completion.
- Task 3 implementation: three new static checks failed before markup changes (branding/cheat sheet, grouped choices, missing metric fields); all 11 structural checks now pass. Kept existing palette/type/layout, moved the accessible page heading to the workspace, and kept the maze dominant with a compact three-column secondary statistics row. No keyboard handlers, saved data, or public interfaces removed. JavaScript retains the existing single-quote formatting convention.
- Verification: the full `python3 tests/run_tests.py --no-browser` suite passes, including native tests with Greedy reachability/trace checks on 80 seeded grids, Node analytics/playback, 11 static checks, and disposable API integration. Prettier checks pass on all touched UI/Node files. Optional browser scripts parse but were not executed.
- Runtime: restarted the verified stale local process with the current build. Health and byte-for-byte delivery of HTML/CSS/controller/analytics/playback pass. Live BFS/Greedy traces on a generated maze complete through the pure model with peak counts matching server metrics, valid coverage/average cost, and zeroed live state on replay reset. `algo.db` SHA-256 remains `6ccc4f768d0db7d2036c88260a8adff9838c8daf5ce659b52f29a4ff0dffc1c4`. Independent review pending.
- Final review: independent reviewer approved with no substantive findings, blocking changes, or deferred minors. Reviewer additionally exercised actual controller metric rendering without a browser for all 10 canonical algorithm pairs, fractional costs, disconnected-cell coverage, and reset. Different core-option ordering intentionally retains BFS/A* defaults; internal progress and four-result analysis helpers do not restore removed UI. No source changes followed the final passing suite. Browser/device behavior remains unverified; no Git repository, commits, or pushes.

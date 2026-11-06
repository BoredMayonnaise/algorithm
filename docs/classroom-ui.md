# Classroom pathfinding lab

## Implemented stack

The running UI is `public/index.html`, `public/styles.css`, `public/analysis.js`, `public/playback.js`, and `public/app.js`. The Map feature, button, page, and map-only assets have been removed; only the maze lab remains.
It uses the existing DOM grid and vanilla JavaScript, with no CDN, framework migration,
runtime package install, external fonts, or paid services. C++17/Crow and SQLite remain
the server and storage engine. This implementation supersedes the UI/tooling proposals
in the older improvement design; it does not implement its unrelated hosting work.

UI editing entry points:

- `public/index.html`: sections, controls, labels, and consequence/recovery guidance. Keep control IDs aligned with `app.js` and the structural checks.
- `public/styles.css`: theme tokens, cell states, workspace layout, presentation mode, and responsive rules. Existing cascade order is retained.
- `public/app.js`: shared input, two-board rendering, one frame scheduler, request cancellation, controls, and persistence. `algorithmInfo` provides the selected solvers' descriptions and guarantees.
- `public/analysis.js`: pure maze profiles, comparison baselines, derived metrics, insights, and number formatting. Node tests exercise this code without a DOM or browser.
- `public/playback.js`: pure independent search tracks, trace preflight validation, paired stepping, progress, and recorded replay. It does not render or start its own animation loop.
- `tests/ui_structure_test.py`: browser-free checks for action hooks, labels, references, and keyboard-entry metadata. These are not interaction tests.

Rebuild and restart the server after updating C++:

```sh
cmake -S . -B build
cmake --build build -j2
./build/algo
```

Run from the repository root. The existing `PORT` environment variable still applies.
Do not start a second server on an occupied port.

## Watching a search

- The initial weighted example is deterministic and solvable. Normal page load never autoplays or saves anything.
- Choose two different algorithms. **Core algorithms** contains BFS, A*, Dijkstra, and DFS; **More algorithms** contains optional Greedy Best-First. Defaults remain BFS and A*. **Run both** captures one immutable layout/weight/endpoint snapshot and requests both real traces before starting playback.
- **Pause** and **Resume** control both boards. **Step** pauses and advances one event in each unfinished track. A completed board keeps its final state and metrics while the other continues.
- **Replay** resets those same recorded tracks; it does not generate inputs or recompute either search.
- **Clear search** cancels both requests and the shared animation loop, keeping layout, endpoints, and weights. Editing, loading/importing, regenerating, or changing either selected solver invalidates previous traces.
- There is no speed slider. Search and path reconstruction both use a fixed 80 recorded events per second per unfinished track; one board entering a new phase never changes the other's pace. Maze generation uses 320 recorded wall/weight changes per second. Event count is not node count, and animation finishing first does not mean lower compute time.
- Cyan means expanded, violet means pending frontier, white outlined `+` means current, and amber means reconstructed path. Start and goal retain labeled markers.
- Path reconstruction follows the real parent chain from goal back to start. Move/cost results appear when reconstruction finishes. No Path shows unavailable path metrics, not a successful zero-cost route.

Both boards use cached DOM cell references and a single bounded `requestAnimationFrame`
loop. The pure model validates recorded frontier/expansion/path counts before playback.
Each track keeps its own visited cells, frontier entries, path, index, and completion state.
Playback progress counts the actual events consumed across the two traces, not invented cells.

## Editing and presentation

- Edit the **left board** with Wall, Erase, Start, or Goal; the right board mirrors that same input and is read-only. Wall drawing never covers an endpoint. Erase resets that cell's entry weight to 1; Clear walls retains weights and endpoints.
- **Generate maze** is the only generation control. It replaces the layout with a fresh 15×25 seeded maze, adds alternate routes, and assigns visible positive weights 2–9 to some open cells. Start/goal use weight 1. Movement remains fixed up, right, down, left so both solvers and the A* heuristic use identical rules. Different routes or winners are not forced.
- Rows/columns, generator selection/density, manual weight input/tool, marker customization, Current event narration, and speed controls are removed. Markers always render as S/G. Legacy marker data remains preserved in saved/imported/exported layouts.
- Saved/imported layouts keep their original dimensions and weights, including valid weights outside the generated 2–9 range. JSON/API dimension limits remain 1–60; removing fields does not remove validation.
- Fit board includes every cell on both views. Zoom and scroll are linked. Use **+** and **Pan** when a large imported layout is too small for pointer editing.
- Focus the left grid, use arrow keys to select a cell, and Enter/Space to apply the tool. The read-only right grid supports arrow-key inspection. **1–4** select tools; **N** steps both; **P** toggles presentation; **Escape** exits it. Space runs/pauses when not used by a focused control or grid.
- **Run demo** keeps an in-memory snapshot of the previous layout, weights, endpoints, legacy marker, both selected algorithms, and maze name. It runs the deterministic weighted example with BFS/A*. **Restore my workspace** restores the snapshot. Save/export important work before reloading or closing the page.
- Presentation hides secondary editing/library controls and enlarges metrics. Reduced-motion preferences remove decorative cell transitions, not real algorithm events.
- Header branding, logo, subtitle, and the visible keyboard shortcut cheat sheet are removed. Run demo, Presentation mode, file controls, and keyboard shortcuts remain available. The workspace keeps an accessible page heading.

## Per-board metrics

The standalone Algorithm comparison section, Compare link, and Compare all action are
removed. The paired lab retains its two selectors, shared inputs, playback, and per-board
metrics. The `/api/compare` endpoint and pure analytics helpers remain available to API
clients and tests; the UI no longer requests the four-algorithm table.

Live exploration shows expanded nodes as a share of **all open cells**, including disconnected
areas. This is not a progress estimate or the percentage of reachable cells searched.
Path metrics remain unavailable when no route exists; start equal to goal has zero moves
and cost. Displays use six significant digits and scientific notation for costs below
`0.0001`; small positive costs never become a displayed zero. Cost values retain full
precision in tooltips.

Secondary metrics show **Peak frontier**, the largest pending-entry count reached so far;
**Explored %**, expanded nodes divided by all open cells, including disconnected areas;
and **Avg move cost**, the completed path's total entry cost divided by moves. The start
cell contributes no entry cost. Average cost stays unavailable until a positive-length
path completes; no path and start equal to goal both show `—`. Replay resets live peak
and coverage along with the trace; the completed lane retains its final values.

Each board displays **Computation time** from the server's `execTimeUs` in microseconds
(`µs`), available as soon as the solver returns. It stays unchanged during pause, step,
and recorded replay. The progress bar, event count, and playback-duration display are removed.
Computation time is a monotonic microsecond measurement of validation, setup, search, and reconstruction.
Single runs also include event recording. Comparison runs do not record events. Both exclude
JSON serialization, transport, and visualization. These are single samples affected by
system load, ordering, and measurement overhead, not reliable performance rankings.
Frontier size/peak counts pending stack, queue, or heap entries, including stale heap entries, not bytes or
necessarily unique cells. Peak includes the initial start entry.

DFS makes no shortest-path guarantee. BFS minimizes moves and only minimizes cost on
equal-cost edges. Dijkstra minimizes cost for nonnegative weights; this API accepts positive
weights. A* uses Manhattan distance times minimum traversable entry weight, which is
consistent for the supported four-directional grid and guarantees lowest cost here.
Greedy Best-First uses Manhattan distance alone, ignoring accumulated cost and weights
when ordering its frontier. Equal distances use insertion order. It finds reachable goals
on this finite grid, but guarantees neither fewest moves nor lowest cost.

## API and saved data compatibility

All prior endpoints and successful response fields remain. No database schema or existing
records are changed. A recognized optional `marker` is now saved inside maze JSON; older
records default to `S`. Save/load, JSON import/export, both generators, and weight painting remain.
Imports validate dimensions, shapes, costs, and endpoints completely before replacing state.
Files over 1 MiB are rejected. Both legacy numeric and object-cell grids are accepted.

Optional additions:

- `POST /api/run` with `trace: true`: returns `events` containing `{type,r,c,frontier}`.
  Types are `frontier` (insertion), `expand` (removal and expansion), `discard` (stale removal),
  and `path` (parent-chain reconstruction). `frontier` is the queue size after the event.
- `POST /api/generate` with `trace: true`: returns actual `{r,c,wall}` changes in generation
  order. New `type: "teaching"` adds cycles and positive weights; its weight-assignment events
  also include `cost`. Replaying events onto an all-wall, unit-weight grid recreates the full
  result. Legacy backtracker/random modes and API defaults retain their previous behavior.

Omitting `trace` retains the previous response shape and avoids trace allocation.

Solver inputs now require integer dimensions/coordinates, exact matrix shapes, strict `0/1`
wall values, and positive finite costs. Malformed maze requests and unknown algorithms return
JSON `400` errors, not a DFS fallback or No Path. Comparisons allow 1–4 distinct canonical
algorithms; aliases remain accepted, but two aliases for the same algorithm count as a duplicate.
Native `runAlgorithm` validates before allocation and derives A*'s minimum traversable cost
from the actual grid rather than trusting the legacy `MazeInput.minCost` cache. Empty native
cost matrices retain unit-weight defaults. Existing successful response fields and stored mazes
remain unchanged.

## Verification

```sh
python3 tests/run_tests.py --no-browser
```

This runs the native build, CTest, JavaScript syntax, pure Node analytics/paired-playback tests, static
markup/reference/accessibility-name checks, and API integration against a disposable database
under `/tmp/opencode`.
It never uses the repository's `algo.db` and does not launch a browser.
Requires the original native build dependencies, Node, and Python 3.

Browser walkthroughs, rendered responsive layout, focus behavior, and real-device testing
are left to the user for the refinement pass. Static markup checks do not prove these behaviors.
The existing automated browser suite remains available with `python3 tests/run_tests.py`
when explicitly wanted; that command additionally requires Python Playwright and Chromium.
Its screenshots go to `/tmp/opencode/algo-screenshots/`.

Existing native/API/browser coverage includes solver correctness and weighted detours, trace/frontier accounting,
fixed-seed generation and odd/even reachability through 60×60, draw/erase/endpoints/weights,
pause/resume/step/speed/replay/reset, generation during search, unreachable/one-cell mazes,
comparison input snapshots, SQLite save/load with marker persistence, valid/invalid JSON
round trips, late-response cancellation, keyboard access, reduced-motion mode, and emulated
touch drawing/zoom/pan. Viewports include desktop, 360/390 px phones, tablet, and landscape.

The logic/analytics pass adds stale-heuristic and malformed-native-input regressions, 80 seeded
weighted A*/Dijkstra agreement cases, malformed HTTP input/algorithm-selection checks, and
browser-free analytics checks for weighted tradeoffs, no path, one-cell/ties, immutable inputs,
tiny costs, zero-cost bars, and inconsistent results. No browser/device tests were run for this pass.

The paired-lab pass adds independent-track/shared-step/replay/no-path/one-cell tests,
seeded weighted cyclic generation checks, and real HTTP solver traces exercised through the
Node pair model. Optional browser scripts were adjusted for the requested controls and two
boards but were not run. Rendered layout, touch/scroll synchronization, focus, and interactive
walkthroughs remain unverified for this pass, per the user's testing boundary.

Physical-device touch behavior, non-Chromium browsers, and projector visibility are not
verified. The existing backend's broader validation, database-concurrency, and deployment
hardening proposals remain separate work; this UI redesign does not make it safe for
untrusted public hosting.

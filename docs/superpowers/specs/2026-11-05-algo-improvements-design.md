# Algo improvement design

**Date:** 2026-11-05  
**Status:** Proposed; awaiting user approval.  
**Scope:** Documentation first, then C++ hardening, a responsive local-asset UI, and verified deployment preparation.

## Intent

Improve the existing Algo application rather than replace it. Students, educators, and developers should be able to edit a maze, watch a correct search, compare algorithms fairly, and preserve or export their work on phone, tablet, and desktop.

The user requested C++ improvements; comprehensive `docs/` covering the product, stack, and use; Tailwind styling; icons downloaded into the project; responsive interaction; and a path to hosting. “crop” is interpreted as Crow, the framework already present in the source. Vite is a frontend build tool, not the algorithm server.

## Baseline and scope

The existing source already contains four C++ search algorithms, maze generation, playback, comparison, SQLite maze storage, and JSON layout import/export. It builds with `cmake --build build -j2`. This is not evidence that all features work correctly.

Keep current maze data and supported full-grid JSON layouts. Do not replace the database or edit generated `build/` files as source. Keep the original design document for history rather than overwriting its claims.

Deliver in order:

1. Product, architecture, usage, API, deployment, and design documentation.
2. Tested C++ input/algorithm/database/static-serving improvements.
3. Vite, compiled Tailwind, locally bundled SVG icons, and responsive interaction.
4. Browser and integration verification, then Linux deployment artifacts and operating instructions.
5. Actual deployment only after the user provides and approves the target and access policy.

## Goals and non-goals

### Required

- Keep DFS, BFS, Dijkstra, and A* in C++17 behind Crow.
- Keep four-directional movement, positive finite per-cell entry costs, and `60 × 60` maximum grids.
- Explain fewest moves versus lowest cost; use the same input for comparisons.
- Preserve deterministic traversal and tie-breaking.
- Make errors and unreachable goals explicit without corrupting editor state.
- Support draw/erase, cost painting, endpoint placement, local icon markers, generation, playback, metrics, save/load, and layout/result export.
- Keep all runtime CSS, scripts, icons, and fonts local to the built app.
- Preserve the user's existing SQLite records.

### Not required

No React rewrite, Node production backend, authentication system, public share-link service, cloud database, WebSockets, arbitrary imported SVGs, diagonal movement, negative weights, or distributed benchmarks. Do not add unused abstractions, settings, or services.

Historical run storage is not required for this release. Results can be exported without introducing a run-history product. Existing `runs` data and schema stay intact.

## Technology decisions

Use C++17, existing Crow/Asio/nlohmann headers, SQLite, CMake/CTest, HTML, and vanilla JavaScript. Add Vite, Tailwind 4 with `@tailwindcss/vite`, and `lucide` installed as a local package. Use named icon imports so only selected icons ship. Keep license notices and a lockfile.

Place new frontend source under `frontend/` and production output under `dist/`. Keep the old `public/` source until the replacement passes verification. Add no runtime CDN, external fonts, or second production server. The builder selects compatible maintained package versions after checking Node engine requirements and records those versions in the lockfile.

Development uses a Vite `/api` proxy. Production uses Crow to serve nested compiled assets and API routes from one origin. Check the actual vendored Crow API rather than assuming upstream `master` matches it.

## C++ and API behavior

### Validation

Validate request objects before allocating grid-dependent structures. Require integer dimensions/coordinates, exact matrix shapes, `wall` values of `0` or `1`, finite numeric costs in `(0,1000]`, walkable endpoints, and known algorithms. The full `grid` format remains canonical. Preserve the existing walls-list and two-dimensional costs forms where valid; reject unsupported object-form costs rather than silently ignoring them.

Preserve the existing start/goal and empty-grid defaults when fields are omitted. Missing algorithm defaults to A* for a run and all four for comparison. Accept existing documented algorithm aliases, normalize to canonical names, and reject unknown names. Cap comparisons at four unique canonical algorithms. Reject invalid generation JSON, unknown generation types, out-of-range density, and invalid seed types. Use a `1 MiB` body limit and a `120`-character maze-name limit as proposed defaults.

Validate imported layouts completely before replacing editor state. The browser file-size limit is also `1 MiB`. Use a known-icon allowlist; never inject imported markup. Normalize API errors to JSON with suitable `400`, `404`, `413`, or `500` statuses. Preserve successful legacy response fields so existing saved layouts and consumers continue working.

Add safeguards to direct calls of `runAlgorithm` for invalid shapes/endpoints/costs. Return an explicit invalid-input signal mapped to `400` by the HTTP layer; do not label invalid input “unreachable.” The builder may choose the smallest error representation compatible with existing callers.

### Algorithms and metrics

Retain neighbor order up, right, down, left. DFS pushes neighbors in reverse preference order. Equal-priority Dijkstra/A* entries use increasing insertion counters. Use `std::chrono::steady_clock` for duration. Include algorithm setup, search, trace accumulation, and path reconstruction, but exclude parsing, JSON serialization, transport, and playback.

Derive the A* minimum traversable cost from validated cells. A* uses Manhattan distance times that minimum; with positive four-directional entry costs this is admissible and consistent. Dijkstra and A* must return the same optimal total cost within a documented floating-point comparison tolerance in tests. BFS optimizes moves, not weighted cost. DFS has neither optimality promise.

Path moves equal `path.size() - 1` on success; start contributes zero cost. The start-equals-goal case succeeds with one path cell, zero moves/cost, one explored cell, and peak frontier one. Unreachable goals have `found: false` and an empty path; render their path metrics as unavailable, not a successful zero.

Peak frontier includes the initial start entry and counts pending stack/queue/heap entries, including stale weighted-search entries awaiting removal. Label it as pending entries; do not claim it measures unique cells or bytes. Keep duplicate exploration out of the trace.

### Database

Keep existing tables and prepared statements. Add a mutex around complete shared-connection operations, including insert and retrieval of its ID. Add a bounded busy wait and useful failure propagation. A missing deletion target is `404`; a failed database operation is `500`. Do not return a successful empty library on a database error.

Persist optional marker identifiers within the existing maze JSON without requiring schema migration. Old records without a marker use the default; recognized legacy emoji markers map to local SVG choices. Never trust stored JSON as HTML.

Keep existing list response fields but bound listing with a proposed default page of `50`, maximum `100`, and an offset parameter. The UI must be able to navigate all saved layouts. Avoid returning the whole library on every save.

### Generation

Retain random-wall and DFS-style backtracker generators. For the backtracker, guarantee a connected route between the advertised endpoints at both odd and even supported dimensions. Do not claim the output is strictly perfect unless the passage topology is actually verified. Random walls may remain unreachable; explain this. Fixed seeds must repeat output within the same implementation, not necessarily across standard-library implementations.

### Runtime and static files

Add validated `PORT`, `BIND_ADDRESS`, `STATIC_DIR`, and `DB_PATH` settings. Proposed defaults are `8080`, `127.0.0.1`, `./dist`, and `./algo.db`. Remove checkout-specific absolute fallbacks. Serve nested assets safely, reject path traversal, return correct MIME types and asset 404s, and fail clearly when the frontend root is missing. Do not expose data/configuration files.

## Frontend behavior and responsive requirements

The builder's proposed visual direction is a focused algorithm workbench: a large central board, restrained neutral surfaces, strong text contrast, one primary action color, and distinct labeled states for walls, endpoints, explored cells, and path. This is a proposal, not an already approved visual preference. A visual mockup can settle styling before UI implementation.

- Phone: one column, board near the top, compact tool groups, readily reachable playback controls, collapsible secondary settings.
- Tablet: board and controls share space when available; do not force desktop widths or tiny controls.
- Desktop: broad board with adjacent controls and metrics, comparison below.
- Test viewport widths at `360`, `768`, and `1440` pixels plus at least one phone landscape layout. Breakpoint choices remain with the builder.
- No page-wide horizontal overflow. Large grids scroll within a labeled board region, with cells at least `24` CSS pixels; primary controls target at least `44 × 44` CSS pixels.
- Provide a scroll/pan interaction distinct from painting on touch devices; changing a wall must not be the only way to scroll a large board.
- Use delegated Pointer Events, pointer capture/cancel handling, and update affected cells instead of replacing thousands of nodes during every paint gesture.
- Give the grid one keyboard entry point with arrow-key navigation and Enter/Space activation for the selected tool. Include labels, focus states, accessible control names, and non-color explanations.
- Keep endpoint icons readable over exploration/path states. Display movement costs without relying solely on color.

Model explicit idle, requesting, exploring, paused, path, complete, and error states. Pause before a manual step. Cancel or discard stale requests using an edit/version token or `AbortController`. Changing a maze or algorithm invalidates prior displayed results. Reset playback retains layout; clearing/replacing layout has an accurate label and confirms unsaved changes.

Playback uses the returned C++ trace. Network/animation durations must never be shown as computation time. Disable incompatible controls while requests are pending and show useful inline errors/status, not only blocking alerts.

Compare all four against one immutable snapshot. Preserve the comparison table, with controlled scrolling or compact cards on small screens. Retain shared-board playback with selectable algorithm results; simultaneous animated boards are not required. Explain algorithm guarantees beside the metrics.

Export maze-only JSON compatible with the existing full-grid form. Add a result export containing a format version, maze snapshot, movement rules, selected algorithm or comparison results, path/exploration traces, metrics with units, and relevant generation seed metadata. Treat single-run times as measurements, not a universal speed score. Import must accept maze-only files and the maze section of a result export after validation.

## Verification and acceptance

Use small tests at existing boundaries instead of building a test framework:

- Native CTest checks: one cell, adjacent endpoints, unreachable maze, walls, weighted cheaper-detour case, fractional costs, deterministic ties, valid path adjacency/cost, A*/Dijkstra agreement, peak frontier initialization, and malformed direct-call input.
- Generator/API checks: known seed repeatability, odd/even backtracker reachability, invalid JSON/types/shapes/costs/endpoints/algorithm lists, response status/type, body limits, and preserved legacy layouts.
- Database checks use temporary files: save/load marker fallback, bounded listing, missing deletion, forced operation failure, concurrent insert IDs, and unchanged schema compatibility.
- Browser checks: draw/erase/cost/endpoints, keyboard navigation, touch paint versus scroll, pause/step/reset, changed-input invalidation, stale-response handling, save/load, import failure retaining state, layout export, and result export.
- Run phone/tablet/desktop and landscape checks with local assets; assert no external asset requests, no page overflow, and no console errors. Browser emulation is not proof of physical-device touch behavior; report any device testing not performed.
- Production smoke checks: compiled asset paths and MIME types, traversal rejection, temporary database persistence across restart, and protected reverse-proxy behavior when a host is available.

Update documentation to match verified behavior as implementation proceeds. Do not check off hosting until a real approved URL is exercised.

## Deployment and user-owned choices

Prepare a Linux systemd service template and a reverse-proxy example, with a dedicated unprivileged service user, loopback Crow binding, explicit persistent database path, compiled local assets, and backup/rollback instructions. Do not install services or change existing host routes without approval.

No host or domain has been provided. Actual deployment is blocked on the user's target, access policy, and storage/backup location. Until then, verify deployability locally with temporary data and label hosting unverified. Protect the whole first hosted app at the reverse proxy; no account system is being added here. Anonymous public writes and private per-user storage require a separate approved design.

## Completion and stop conditions

Documentation is the first deliverable. Stop before product code changes until this design is approved. Then write the implementation plan before coding. Complete only this scope, report exact tests and unverified risks, and leave existing user data untouched.

The builder may choose internal helper boundaries, compatible package versions, test harness details, and exact CSS tokens. Changes to platform, data ownership, anonymous public access, or feature scope require user approval.

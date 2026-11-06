# Architecture and technology stack

## Existing system

```text
Browser: public/index.html + public/app.js
    HTTP JSON requests and static files
Crow: src/main.cpp + src/api.cpp
    Search: src/algo.cpp
    Persistence: src/db.cpp -> SQLite file algo.db
```

The browser edits a maze locally. A run request sends a complete snapshot to Crow. C++ computes the exploration order and final path, returns them as JSON, and finishes before the browser starts animating. Pausing playback does not pause a running C++ search.

Comparison is currently a single request running the chosen algorithms sequentially against one parsed `MazeInput`. This prevents accidental layout differences between comparisons.

## Stack decisions

| Component | Existing | Proposed decision and reason |
| --- | --- | --- |
| Search engine | C++17 | Keep it; preserve native computation and deterministic search |
| HTTP framework | Vendored Crow headers | Keep Crow; inspect available APIs before relying on current upstream features |
| Networking | Standalone Asio | Keep the current system dependency |
| JSON | Vendored nlohmann/json | Reuse it for structured validation and responses |
| Database | SQLite C API | Keep it; local file storage fits a single-host application |
| C++ build | CMake 3.16+ | Keep it; add small native tests through CTest |
| Frontend | HTML and vanilla JavaScript | Keep both; no frontend framework is required |
| CSS | Tailwind CDN script | Build Tailwind 4 locally using `@tailwindcss/vite` |
| Frontend tooling | None | Add Vite for development, CSS compilation, and production asset bundling |
| Icons | Emoji and text | Install `lucide` locally and bundle selected SVG icons, including marker choices |
| Hosting | Manual process | Linux process supervised by systemd, behind a TLS reverse proxy |

Crow's bundled `include/crow/version.h` reports `master`, not a release version. The current repository has no dependency provenance or lock manifest for its vendored headers. Do not silently replace these headers during UI work. Record provenance or pin a known release in a separately verified change if compatibility requires it.

Node.js and npm are proposed **build/development** dependencies only. Select a supported Node LTS version compatible with the pinned Vite release; Node 22.12+ meets the documented Vite 7 baseline, but implementation must check the selected release's engine requirements. Commit a lockfile. The production application must work without Node, CDN CSS, remote icon scripts, or external fonts.

## Code map

| File | Responsibility |
| --- | --- |
| `src/main.cpp` | Database startup, app setup, port, and worker configuration |
| `src/api.cpp` | Maze parsing, generation, API routes, JSON serialization, static assets |
| `src/algo.h`, `src/algo.cpp` | Search input/output types and four algorithms |
| `src/db.h`, `src/db.cpp` | SQLite schema and prepared-statement operations |
| `public/index.html` | Current page structure and CDN Tailwind inclusion |
| `public/app.js` | Maze state, rendering, input, API calls, animation, import/export |
| `CMakeLists.txt` | C++ compilation, linking, copying current static files |
| `include/` | Existing vendored libraries; not application code |
| `build/` | Generated output; never the source of truth |

## Proposed frontend build

Keep editable frontend source in `frontend/`. Configure Vite to write production assets to `dist/`, leaving existing `public/` source untouched until the replacement has passed checks. Do not configure a bundler to empty a directory containing existing source.

During development, Vite proxies `/api` to the local Crow process. In production, Crow serves `dist/index.html` and nested hashed assets from the same origin as `/api`. Node and the Vite development server are not public production services.

Expose an explicit static-root setting rather than the current hard-coded `/home/ubuntu/algorithm/public` fallback. Canonicalize asset paths, reject traversal, serve appropriate MIME types, and return 404 for unknown assets. Static serving must not expose SQLite, source, or configuration files.

Use Tailwind's Vite plugin and CSS `@import "tailwindcss"`. Define shared design tokens in CSS rather than adding a separate component framework. Bundle only the required Lucide icons, retaining its license notice. Icon-only controls still need accessible names; decorative SVGs should be hidden from assistive technology.

## C++ improvement boundaries

The design targets existing responsibilities rather than adding a service architecture:

- Validate maze input at the HTTP boundary, including types, complete array shapes, strict wall values, coordinates, numeric bounds, and supported algorithms.
- Add direct-call safeguards in the search entry point so malformed matrix shapes cannot cause out-of-bounds access.
- Compute the heuristic's minimum cost from validated input; do not rely on an unchecked caller-provided value.
- Use a monotonic clock for duration measurement and initialize frontier accounting with the initial start item.
- Keep per-request search state local. Keep algorithm traces compatible with browser playback.
- Serialize complete operations on the shared SQLite connection. SQLite's internal serialization of individual calls does not make an insert followed by `sqlite3_last_insert_rowid()` one atomic application operation.
- Return clear database errors instead of presenting an empty list or successful deletion when the operation failed.
- Bound request bodies and list/compare work before exposing the app publicly.

Implemented solver safeguards now reject unknown algorithms and malformed maze values, validate native inputs before allocation, derive A*'s heuristic bound from actual costs, and include the initial entry in peak frontier accounting. These are covered by native/API regression tests. Other database/static-serving/deployment items in this section remain proposals, not completed hardening.

## Data preservation

Retain the existing `mazes` and `runs` tables and existing maze JSON. Do not reset, replace, or inspect the user's database for test fixtures. Use temporary databases for tests.

Marker persistence can use an optional field inside the existing serialized maze JSON; a schema migration is not required. Existing layouts without a marker receive the default. Permit only known marker identifiers, never imported SVG/HTML content. Map supported legacy emoji selections to local icons on import.

## Documentation sources

Library documentation was consulted through Context7 on 2026-11-05. Documentation describes upstream APIs; vendored compatibility still needs verification.

- [Crow static files](https://crowcpp.org/master/guides/static/) and [reverse proxies](https://crowcpp.org/master/guides/proxies/).
- [Vite build options](https://vite.dev/config/build-options) and [development proxy](https://vite.dev/config/server-options#server-proxy).
- [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite).
- [Lucide JavaScript](https://lucide.dev/guide/packages/lucide).
- [SQLite threading](https://www.sqlite.org/threadsafe.html) and [last inserted row ID](https://www.sqlite.org/c3ref/last_insert_rowid.html).
- [CMake command-line reference](https://cmake.org/cmake/help/latest/manual/cmake.1.html).

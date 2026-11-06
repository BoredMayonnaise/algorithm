# Algo Design

**Date:** 2026-11-05
**Status:** Approved for build (user-provided spec)

## Intent
Interactive maze building + pathfinding analysis platform. Users build mazes, set costs, run DFS/BFS/Dijkstra/A*, animate, compare metrics, save/load/export.

## Goals
- 4-dir grid, positive costs, deterministic neighbor order (up, right, down, left) and tie-break.
- Metrics: path length (moves), total path cost, explored nodes, exec time (µs), peak frontier.
- Unreachable/invalid handling.
- Desktop + mobile usable editor.
- Import validation + grid size limits (max 60x60).
- C++/Crow backend + SQLite persistence.

## Non-goals (for now)
- Maze generation algorithms (user draws).
- 8-dir movement, negative costs.
- Multi-user auth, cloud sharing (hosting planned).

## Stack
- Backend: C++17, Crow (header-only), standalone asio, sqlite3. JSON via nlohmann/json (fetch if missing).
- Frontend: HTML + Tailwind CDN + vanilla JS. Served as static by Crow.
- DB: SQLite (mazes, runs).

## API
- GET /api/health
- GET /api/mazes -> list
- POST /api/mazes {name, rows, cols, grid, start, goal} -> id
- GET /api/mazes/:id
- DELETE /api/mazes/:id
- POST /api/run {maze?, grid, rows, cols, start, goal, costs?, algorithm, heuristic?} -> {path, explored, metrics}
- POST /api/compare {grid,..., algorithms[]} -> array of runs

## Determinism
Neighbor order: up (r-1,c), right (r,c+1), down (r+1,c), left (r,c-1). Tie-break by insertion order / node id. PQ tie-break by (cost, tie counter).

## A* heuristic
Manhattan distance * min cell cost (admissible for positive costs). Default min cost 1.

## Metrics timing
Use std::chrono around algorithm only, excluding JSON parse and response.

## Validation
- rows/cols within 1..60; grid size matches; start/goal in bounds and walkable; costs positive finite; walls consistent.
- Imported JSON validated server-side too.

## Decisions (my calls)
- Costs stored per-cell in grid as integer cents? Use double with 2 decimals? Use integer cost units (1..99) for simplicity; default 1.
- Explored order returned as list of [r,c] for animation.
- Peak frontier = max size of open set during search.
``` 

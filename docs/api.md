# Current HTTP API

Base URL for local use: `http://localhost:8080`. Solver/maze validation and the documented integration checks run against disposable databases. Run, comparison, and save validation errors use JSON `400` responses with `Content-Type: application/json`; other routes and error paths are not uniformly hardened.

There is no authentication. Treat saved mazes as a shared library. Do not expose mutation routes publicly without the deployment protections described in [deployment](deployment.md).

## Maze input

The full grid form is the recommended interchange format:

```json
{
  "rows": 2,
  "cols": 3,
  "grid": [
    [{"wall": 0, "cost": 1}, {"wall": 0, "cost": 5}, {"wall": 0, "cost": 1}],
    [{"wall": 0, "cost": 1}, {"wall": 0, "cost": 1}, {"wall": 0, "cost": 1}]
  ],
  "start": [0, 0],
  "goal": [0, 2]
}
```

- Coordinates are zero-based `[row, column]` arrays.
- Dimensions must be integers in `1..60`; the grid must match them exactly.
- Object cells use `wall: 0|1` and a finite `cost` in `(0, 1000]`.
- Integer cells `0` and `1` are also supported, with default cost `1`.
- Missing start defaults to `[0,0]`; missing goal defaults to the bottom-right cell.
- Missing grid produces an open grid. A `walls` coordinate list is another existing input form.
- An optional two-dimensional `costs` array overrides cell costs.

Malformed dimension/coordinate types, non-`0/1` wall values, incorrect matrix shapes, and invalid costs return JSON `400` without changing saved data. Unsupported object-form `costs` keyed as `"r,c"` is rejected rather than silently ignored. Existing out-of-bounds integer wall-list coordinates remain ignored; endpoints must be valid, walkable cells.

## Routes

### `GET /api/health`

Returns `200` with `{"ok":true}`. This reports an HTTP handler response, not continuous database health or a complete readiness test.

### `POST /api/run`

Send maze input with `"algorithm": "A*"`. Core canonical values are `DFS`, `BFS`, `Dijkstra`, and `A*`; A* is the route default. Optional `Greedy Best-First` prioritizes Manhattan distance alone, ignores accumulated cost and weights for selection, and guarantees neither fewest moves nor lowest cost. It uses the same metrics and trace contract. Aliases `Dijkstra's`, `AStar`, and `astar` remain accepted. Unknown/non-string names return JSON `400` instead of silently running DFS. Optional `trace: true` returns actual search events; `trace` must be boolean. See [the UI/event guide](classroom-ui.md) for the trace shape.

Example lowest-cost response for the sample maze (execution time varies):

```json
{
  "algorithm": "A*",
  "found": true,
  "pathLength": 4,
  "totalCost": 4,
  "exploredNodes": 5,
  "execTimeUs": 12,
  "peakFrontier": 2,
  "path": [[0,0], [1,0], [1,1], [1,2], [0,2]],
  "explored": [[0,0], [1,0], [1,1], [1,2], [0,2]]
}
```

`execTimeUs: 12` is illustrative, not a measured baseline. `pathLength` counts moves. The start cost is excluded. An unreachable goal returns `200` with `found: false`, an empty path, and the explored sequence; it is not a malformed request.

### `POST /api/compare`

Send maze input and optionally:

```json
{"algorithms": ["DFS", "BFS", "Dijkstra", "A*"]}
```

The response remains an array of run results, in requested order. Omitting `algorithms` selects the core four only. Parsing occurs once and runs are sequential. Select 1–4 distinct canonical algorithms; explicit selections may include `Greedy Best-First`. Empty lists, unsupported names/types, and duplicates (including two aliases for the same algorithm) return JSON `400`. Comparison does not record traces. The paired UI uses `/api/run`; the removed standalone comparison table is not restored. No benchmark values or history are added to this endpoint.

### `POST /api/generate`

```json
{
  "rows": 21,
  "cols": 21,
  "type": "backtracker",
  "seed": 12345,
  "density": 0.3
}
```

Returns a complete maze payload. Dimensions must be within `5..60`. Defaults remain `20 × 20`, backtracker, seed `12345`, and density `0.3`. `type: "random"` selects random walls. New `type: "teaching"` carves with the backtracker, adds alternate-route cycles, and assigns weights 2–9 to some open cells while retaining unit-weight endpoints. Other current type values still use the backtracker. Density applies only to random walls. Out-of-range density currently resets to `0.3` instead of producing an error.

The simplified UI requests teaching mode with fixed 15×25 dimensions and a fresh random seed; other clients can still request the existing modes and valid sizes. `trace: true` returns actual wall changes and, in teaching mode, weight-assignment events with an optional `cost` field. Applying those events to an all-wall/unit-weight grid reconstructs the response. Neither existing saved records nor the `/api/run` and `/api/compare` response formats change.

The same seed repeats the generated layout within the same implementation/toolchain; do not promise cross-standard-library output identity. Random-wall generation does not guarantee a path. Invalid JSON currently falls back to default generation, a behavior the proposed validation changes will remove.

### `GET /api/mazes`

Returns an array ordered by descending ID:

```json
[
  {
    "id": 1,
    "name": "Cost lesson",
    "rows": 2,
    "cols": 3,
    "createdAt": "2026-11-05 12:00:00",
    "grid": {"rows": 2, "cols": 3, "grid": [], "start": [0,0], "goal": [0,2]}
  }
]
```

This is a shortened shape illustration; the stored `grid` field contains the **entire serialized maze object**, not just its cell array. The actual nested cell array matches the saved dimensions. Current listing includes every stored layout and has no pagination.

### `POST /api/mazes`

Send maze input and an optional `name` (default `Untitled`). Returns `201`:

```json
{"id": 1, "name": "Cost lesson"}
```

The server normalizes and saves dimensions, cells, start, goal, and recognized optional start markers. Name must be text. Old records without a marker still load with the default. Saving inserts a new record; it does not update an existing record.

### `GET /api/mazes/<id>`

Returns `200` with `id`, `name`, `rows`, `cols`, `createdAt`, and `data`. `data` is the complete stored maze object. A missing ID returns `404` with `{"error":"not found"}`. This differs from the list route's legacy `grid` wrapper.

### `DELETE /api/mazes/<id>`

Current response is `200` with `{"ok":true}` even when the ID is missing or the database operation fails. The improved implementation must distinguish failure and missing records. The current UI has no delete button.

## Errors and limits

Maze and solver-selection validation errors return JSON `400`, for example `{"error":"start or goal on wall"}`. Native invalid input is distinguished from a valid unreachable maze. Generator configuration and unrelated database/static-serving error paths still need broader hardening. A failed insert returns `500` with `{"error":"db error"}`.

The API limits grids to `60 × 60` and comparisons to four distinct algorithms, but still has no application-level body-size cap, server-side name-length limit, or list pagination. Do not infer safe public request limits from the grid limit alone.

No endpoint currently exposes saved run history, share links, authentication, or account-scoped storage. Static assets are served separately from `/` and a single-segment file route; the existing route must change to support nested Vite assets.

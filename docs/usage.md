# User guide

This guide describes the existing application. The responsive redesign and local asset build are proposed, not installed yet.

## Build and run the current app

Requirements on Linux:

- A C++17 compiler such as g++.
- CMake 3.16 or newer and a supported build tool such as Make.
- SQLite development headers and library, typically `libsqlite3-dev`.
- Standalone Asio headers, typically `libasio-dev`.
- Crow and nlohmann/json headers already supplied in `include/`.

From the project root:

```sh
cmake -S . -B build
cmake --build build -j2
./build/algo
```

Open `http://localhost:8080`. Keep the working directory at the project root: current static assets and `algo.db` are located relative to it. The existing implementation also contains an absolute fallback for this checkout, which is not portable.

Choose a different port if necessary:

```sh
PORT=8081 ./build/algo
```

The current server does not configure a loopback-only bind address. Do not assume this development command is safe for an internet-facing machine. See [deployment](deployment.md).

## Build a maze

1. Enter Rows and Cols, then select **New Grid**. This replaces the current in-memory layout.
2. Select **Wall** to paint obstacles or **Erase** to restore open cells at cost `1`.
3. Select **Start** or **Goal**, then choose an open cell.
4. Select **Cost**, enter a positive cost no greater than `1000`, and paint traversable cells.
5. Choose a marker from the current marker selector.

The current interface offers mouse drawing and touch input, but smooth dragging and phone/tablet usability have not been verified. It rebuilds the grid during painting. Avoid covering start or goal with a wall: the server rejects such a layout.

**Clear All Walls** currently also resets all costs to `1`. Export or save first if you need to keep the current layout. The planned UI will label destructive actions accurately and ask before replacing unsaved work.

## Generate a maze

Choose **DFS Backtracker** or **Random walls**, adjust random density if relevant, and select **Generate**. Generation supports sizes from `5` to `60` in each dimension. It replaces the current layout.

The current UI supplies a random seed. The API also accepts a fixed seed for repeating generation on the same implementation. Random walls can create an unreachable goal. The existing generator's “perfect” UI label is not a proven guarantee because it opens additional endpoint neighbors.

## Search and playback

1. Choose A*, Dijkstra, BFS, or DFS.
2. Select **Run**. The server computes the result before animation begins.
3. Use **Pause**, **Play**, or **Step** to inspect the returned sequence.
4. Adjust **Speed (ms/step)**. Smaller values produce faster playback.
5. Use **Reset View** to clear the current playback without deleting walls and costs.

Current controls have state limitations: edits do not consistently invalidate old results, and requests are not guarded against stale responses. Reset the view and run again after editing. Do not treat an old path as a result for the edited maze.

## Compare algorithms

Select **Compare All** to run DFS, BFS, Dijkstra, and A* on the same maze snapshot. Review path moves, total cost, explored nodes, computation time, and peak frontier.

For a useful lesson, create a short expensive corridor and a longer cheap alternative. BFS should choose the fewest moves; Dijkstra and A* should choose the lowest total cost. DFS follows its traversal order and need not optimize either measure.

If no route exists, the important result is **No path**, not the zero-valued path metrics. A* is not guaranteed to be fastest on every maze. The measured computation time excludes network delay and browser playback.

## Save and reload

Enter a maze name and select **Save to DB**. Refresh the saved list if needed, select a saved item, then select **Load Selected**.

The current database is shared by everyone who can reach the server. There is no login or per-user ownership. The backend stores layout, endpoints, and costs; it does not currently preserve the selected character. Search results are not automatically stored despite the presence of a `runs` table.

## Export and import

**Export JSON** downloads the current maze as `maze.json`, including a marker field. The file does not currently include run metrics or comparison results.

**Import** reads a maze JSON file. Only import files you trust until the planned validation changes land: current validation can change state before a later validation error, and it does not fully validate endpoints or every numeric bound. Keep a saved/exported copy of your maze first.

Example compatible layout:

```json
{
  "rows": 2,
  "cols": 3,
  "grid": [
    [{"wall": 0, "cost": 1}, {"wall": 0, "cost": 5}, {"wall": 0, "cost": 1}],
    [{"wall": 0, "cost": 1}, {"wall": 0, "cost": 1}, {"wall": 0, "cost": 1}]
  ],
  "start": [0, 0],
  "goal": [0, 2],
  "marker": "🚀"
}
```

BFS can reach the goal in two moves at cost `6`. A lowest-cost route uses four moves at cost `4`.

## Troubleshooting

- **Page has no styling:** the current frontend depends on the Tailwind CDN. The planned local build removes that dependency.
- **Database fails to open:** check the working directory, permissions, and free disk space. Do not delete `algo.db` as a repair step.
- **Start or goal on wall:** erase that cell or move the endpoint before running or saving.
- **No path:** remove walls or compare another layout. This is a valid result, not necessarily an application error.
- **Large grid requires scrolling:** current cells have a minimum width. The redesign will preserve usable cells and offer deliberate board scrolling instead of shrinking targets indefinitely.

# Algo: project description

## What it is

Algo is an interactive maze-building and pathfinding analysis platform for computer science students, educators, and developers. A user draws or generates a grid, places a start and a goal, assigns movement costs, and observes how a search explores the maze.

The learning outcome is to explain why algorithms visit different cells, choose different routes, and use different amounts of work. The application must distinguish the route with the fewest moves from the route with the lowest total cost.

A* combines the accumulated cost used by Dijkstra's algorithm with a heuristic estimate toward the goal. This describes A*, not every algorithm in Algo.

## Main workflow

1. Create a grid or generate a maze.
2. Draw or erase walls and set traversable cells' costs.
3. Place the start and goal and choose a navigation marker.
4. Choose DFS, BFS, Dijkstra, or A*.
5. Run the C++ computation, then play, pause, or step through the returned exploration.
6. Inspect the final path and metrics.
7. Compare all algorithms on the same input.
8. Save the maze to SQLite or export its layout as JSON.

## Algorithms and guarantees

| Algorithm | How it chooses work | Guarantee under Algo's movement rules |
| --- | --- | --- |
| Depth-first search (DFS) | Stack-based search down a branch before returning | Finds a route when one exists; does not guarantee fewest moves or lowest cost |
| Breadth-first search (BFS) | Queue-based expansion by distance in moves | Finds fewest moves; finds lowest cost only when all move costs are equal |
| Dijkstra | Lowest accumulated cost first | Finds lowest total cost with the supported positive costs |
| A* | Lowest accumulated cost plus estimated remaining cost | Finds lowest total cost with a valid admissible, consistent heuristic |

For Algo's four-directional grid, the intended A* heuristic is Manhattan distance multiplied by the minimum traversable cell cost. This is a lower bound because every remaining move costs at least that minimum. It is also consistent under these rules.

DFS maze generation and DFS maze solving are separate operations. A randomized DFS backtracker typically creates a connected, acyclic passage graph with winding corridors and dead ends. It does **not** create a braid maze: a braid maze removes dead ends and generally introduces loops. Algo's current generator also opens cells around endpoints, so its output should not be described as strictly perfect without further proof.

## Movement and metrics

- Movement is up, right, down, or left. Diagonal movement is not supported.
- A move pays the destination cell's cost. The start cell contributes zero initial cost.
- Costs may be fractional and must be finite, greater than zero, and at most `1000`.
- The intended editor and API limit is `60 × 60` cells.
- Neighbor order is up, right, down, left. DFS pushes neighbors in reverse order so the stack pops the preferred neighbor first.
- Dijkstra and A* break equal priorities by insertion order.
- The same layout, endpoints, and costs must be used for every algorithm in a comparison.

| Metric | Meaning |
| --- | --- |
| Path moves | Number of edges in the returned path, not the number of cells |
| Total cost | Sum of destination-cell costs along that path |
| Explored nodes | Number of cells processed and included in the exploration sequence |
| Execution time | Time inside the C++ search routine, including its setup and path reconstruction; excludes HTTP, JSON processing, and animation |
| Peak frontier | Maximum pending container size; the proposed contract includes queued stale entries in weighted searches |

When a goal is unreachable, `found` is false and no path is returned. Current zero-valued path metrics must not be presented as a successful zero-cost solution. A start that equals the goal is different: it succeeds with zero moves and zero cost.

Execution time is a local measurement, not a stable algorithm ranking. Scheduling, build mode, cache effects, and input size affect it. Exploration and frontier metrics are useful complements.

## Current implementation versus requested improvements

| Area | Exists in source | Requested next |
| --- | --- | --- |
| Search | Four C++ algorithms, exploration lists, paths, metrics | Regression tests, reliable timing and frontier accounting, stricter validation |
| Editor | Walls, erasing, costs, endpoints, marker selection | Efficient painting, keyboard support, dependable pointer interaction |
| Generation | Seeded DFS-style backtracker and random walls | Validate inputs and test reachability for backtracker output |
| Playback | Play, pause, step, speed, reset | Clear state, cancellation of stale responses, editing invalidates old results |
| Analysis | Single-run metrics and comparison table | Clear explanations, small-screen presentation, result export |
| Storage | SQLite maze save/list/load/delete API | Safe concurrent operations and explicit failure handling |
| Assets | HTML/JavaScript, Tailwind CDN, emoji markers | Locally built Tailwind and downloaded/bundled SVG icons |
| Hosting | Executable accepts `PORT` | Configurable paths and bind address, repeatable Linux deployment, verified host |

The database defines a `runs` table and a `saveRun` method, but the current run and compare routes do not persist their results. Export currently downloads a maze layout, not analytics. There is no verified public deployment or share-link service.

## Scope boundaries

The first improvement release keeps C++, Crow, SQLite, HTML, and JavaScript. It adds Vite as build tooling, not a replacement backend. There is no need for React, a separate Node production server, WebSockets, cloud storage, or an ORM for the requested workflow.

Application accounts, per-user maze ownership, public share links, diagonal movement, negative weights, and distributed processing are outside this release. Public hosting must not imply private storage: the existing maze library is shared and unauthenticated.

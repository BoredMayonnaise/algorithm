# Core algorithms and per-board analytics

- Approved in chat: keep BFS, DFS, Dijkstra, and A* as the four primary choices; add Greedy Best-First under “More algorithms.” Defaults remain BFS/A*.
- Greedy Best-First prioritizes Manhattan distance alone, with deterministic insertion-order ties. It finds a route when reachable on this finite grid, but guarantees neither fewest moves nor lowest cost.
- Add per-board live peak frontier and explored percentage of all open cells. Show average move cost only after a successful nonzero-move route; otherwise show unavailable.
- Preserve measured computation time, shared input, independent playback, pause/resume/step/replay/reset, keyboard shortcuts, import/export, persistence, and public API compatibility.
- Remove visible Algo branding, subtitle, logo, and keyboard shortcut cheat sheet. Retain accessible page/workspace names and action buttons.
- Keep the removed comparison table and playback progress/count/duration absent. No new dependencies or browser/device/screenshot testing.
- Keep `/api/compare` defaults as the existing four algorithms and its current maximum of four choices. Explicit subsets may include Greedy Best-First.

# Four-algorithm street-map lab

> Superseded by the approved two-pane custom network in `../plans/2026-11-06-custom-search-maps.md`. This file preserves the prior geographic design only.

- Approved direction: replace GPS navigation with one small Berlin neighborhood and show how each core algorithm searches for a selected goal. Use four simultaneous map views: BFS, DFS, Dijkstra, and A*.
- All four receive the same bundled real OpenStreetMap street/footpath graph and shared start/goal. Draw actual frontier/current/explored junction states and the algorithm's reconstructed route, not a provider's precomputed route.
- Bind start/goal to graph nodes by clicking a nearby intersection, or pan a focused map and press Enter. Supply useful default endpoints. Link pan/zoom and provide Run all/Pause/Resume, Step, Replay, and Clear search. Keep fixed readable pacing and independent completion.
- Per-map statistics: expanded nodes, explored share, current/peak frontier, final path distance and graph-edge count, and measured browser computation time including trace/reconstruction. Distinguish browser search runtime from maze server runtime; no speed ranking or fake timings.
- BFS minimizes graph-edge count; Dijkstra and A* minimize represented geometric distance. DFS guarantees neither. Collapse degree-two OSM shape nodes into edge geometry so graph edges represent sections between junctions/endpoints.
- Keep the area bounded, the UI plain, and the existing maze/core-four/optional-Greedy lab unchanged. Do not restore removed comparison tables or progress/count/playback-duration UI.
- Remove active GPS permissions, tracking, GPS accuracy, ETA, rerouting, route-service requests, and turn-by-turn navigation. This becomes an educational undirected snapshot, not a navigation or legal-access product.
- Data: use a bounded OSM snapshot around Hackescher Markt, Berlin; keep its largest connected component. Bundle it locally with query/timestamp/source way IDs, © OpenStreetMap contributors attribution, and ODbL license link. Only background tiles remain external. No live graph/route API dependency.
- No browser, screenshot, device, emulator, or real GPS tests. Use pure solver/playback tests, controlled controller tests, static references, and live local asset checks. Preserve current saved data; do not assume an old historical database checksum remains current.

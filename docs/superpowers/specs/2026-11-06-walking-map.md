# Minimal walking map

> Superseded by `2026-11-06-street-search-map.md` at the user's request. GPS/navigation was removed in favor of four actual algorithm search maps; this file preserves the historical design only.

## Intent and approved direction

- User wants a top button opening a real map, walking GPS directions, working route logic, and useful analytics without a fancy interface.
- Keep the existing maze lab and its four primary algorithms intact. No comparison table, playback progress/count/duration, branding, or shortcut cheat sheet returns.
- This is a foreground web navigation demo, not a replacement for a tested navigation product. Real-device walking validation remains with the user; do not launch browsers, Playwright, devices, emulators, or screenshots.

## Proposed first version

- Top **Map** button switches between the existing maze and a plain walking-map panel. Leaving the map cancels its route requests and stops GPS. Maze playback pauses when leaving the maze.
- Show real OpenStreetMap streets through locally served Leaflet 1.9.4. Fetch tiles only after opening the map, preserve browser caching, and display map attribution and a “Fix the map” link.
- Pick start and destination on the map. Provide Start/Destination selection controls; click/tap sets the selected point. Keyboard users can pan the focused map and press Enter to choose its center. Show coordinate summaries and a short instruction.
- **Use my location** explicitly starts foreground GPS after a privacy notice. GPS supplies the start/current marker; **Stop GPS** stops watching. No location request on page load, and no location history is persisted.
- **Walking route** requests a real pedestrian route, draws its polyline, and shows plain-text turn-by-turn steps. No voice, address search, traffic, offline maps, background tracking, or native app.
- While GPS is active, update the current instruction and remaining route distance using position projected onto the route, not straight-line distance to the destination. Show arrival only near the route end with an accurate fresh fix.
- If multiple fresh accurate fixes are clearly off route, request another walking route, at most once per 30 seconds. Discard stale responses after endpoint changes, mode switches, Stop GPS, or a newer request.
- Pause live guidance on poor/stale GPS, denied permission, unavailable GPS, hidden page, or a failed route. Keep failures explicit; do not present a previous route as current guidance after its inputs changed.

## Analytics and truthful labels

- Show route distance, estimated walking duration, remaining route distance, GPS accuracy, successful reroutes, and routing-request duration.
- Walking duration/remaining ETA are estimates from the service's pedestrian speed assumptions, not live-traffic forecasts or guaranteed arrival times.
- Routing-request duration includes network and server response time. It is not native solver computation time.
- The walking provider does not expose expanded nodes, peak frontier, or its per-request algorithm execution time. Do not invent those metrics or label its routes as this app's BFS/DFS/Dijkstra/A* output. The existing maze analytics remain available unchanged.
- Handle no route, identical endpoints, denied permission, disconnected service, stale GPS, repeated fixes, route snapping, and cancellation explicitly.

## Implementation choices proposed by the assistant

- Reuse the current vanilla JavaScript UI and C++ static server. Use one mapping dependency (Leaflet); keep map controller and pure geometry/route-validation logic separate from maze code. No database or new backend service is needed.
- Use FOSSGIS's dedicated OSRM foot endpoint: `https://routing.openstreetmap.de/routed-foot/route/v1/foot/…?steps=true&geometries=geojson&overview=full&generate_hints=false`.
- The browser sends start/destination coordinates to FOSSGIS for routing, whose policy says requests are logged. The map loads tiles from OpenStreetMap. Disclose both before starting GPS/routing; keep coordinates in memory only within this app.
- FOSSGIS permits at most one request per second and no heavy usage; serialize/rate-limit requests in the map controller, including repeated manual clicks. These public community services have no availability guarantee and are suitable here only for a low-volume demonstration.
- Use public Berlin landmarks as an explicitly labeled initial example view, not a guessed user location. Users can pan anywhere or opt into GPS.
- GPS works on localhost or HTTPS, not ordinary HTTP access to the server's IP address. Map/manual routing can remain usable when GPS is unavailable; do not change deployment/TLS configuration without a separate request.

## Verification and acceptance

- Pure Node tests cover route/step validation, coordinate ordering, distance/projection, remaining distance, instruction progression, average ETA assumptions, arrival guards, off-route decisions, and invalid/stale fixes.
- Controller checks cover no automatic GPS, watch cancellation, request serialization/cancellation, stale-response rejection, and no guidance from an obsolete route. Use controlled doubles without launching a browser.
- Static checks cover top toggle, accessible controls, map naming, local script order, retained maze controls, required attribution/privacy text, and new metrics.
- Run the existing full browser-free suite against disposable data. Preserve the user's database hash.
- Low-volume HTTP smoke checks may use public non-user coordinates and must verify the returned step mode is walking. Do not claim GPS, rendered map, or physical turn-by-turn behavior was tested.

## Research evidence

- Official Leaflet 1.9.4 documentation via Context7: map/tile setup, click handlers, and `invalidateSize` after unhiding a map.
- Official OSRM documentation via Context7: GeoJSON routes, distance/duration, step maneuvers, and no-route errors.
- MDN via Context7: `watchPosition`, explicit permission/secure-context requirement, and `clearWatch`.
- FOSSGIS usage/privacy: https://routing.openstreetmap.de/about.html
- OSM tile rules: https://operations.osmfoundation.org/policies/tiles/
- One HTTP probe with public Berlin coordinates returned `Ok`, CORS `*`, GeoJSON route geometry, and only `walking` steps from the dedicated foot service. This was not a browser or GPS test.

## Approval

- Walking, minimal appearance, functional map/logic/analytics are user decisions. The user's subsequent “continue” authorized the narrow implementation. Provider, foreground-only behavior, and analytics boundaries are assistant-selected defaults; third-party sharing remains disclosed in the UI before GPS/routing actions.

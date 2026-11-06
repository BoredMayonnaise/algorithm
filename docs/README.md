# Algo documentation

Algo is a maze editor and pathfinding learning tool backed by C++. These documents distinguish the existing application from the proposed improvements.

## Start here

- [Project description](project.md): purpose, users, features, terminology, and delivery status.
- [User guide](usage.md): build the current app, edit a maze, run algorithms, compare, and save or export.
- [Architecture and technology stack](architecture.md): current code, proposed frontend build, data flow, and engineering decisions.
- [API reference](api.md): existing routes, payloads, responses, and validation limitations.
- [Deployment guide](deployment.md): current Linux operation, public-hosting requirements, and verification checklist.
- [Improvement design](superpowers/specs/2026-11-05-algo-improvements-design.md): proposed C++ hardening, responsive UI, tests, and deployment work. **Awaiting approval; not an implementation claim.**

## Status on 2026-11-05

- [x] Inspect the existing C++, browser code, build configuration, and database wrapper.
- [x] Build the existing application with `cmake --build build -j2`.
- [x] Write the product, usage, architecture, API, deployment, and improvement documents.
- [ ] Approve the improvement design.
- [ ] Implement and test the C++ changes.
- [ ] Replace CDN styling with a local Vite/Tailwind build and bundled icons.
- [ ] Verify editor and playback on phone, tablet, and desktop layouts.
- [ ] Prepare and verify deployment artifacts.
- [ ] Deploy to an approved host and verify its public URL.

The existing [initial design](superpowers/specs/2026-11-05-algo-design.md) is retained as historical context. Its approval label is not approval of this new proposal. Its generation, cost, asset-delivery, and run-storage descriptions differ from the current implementation; use these documents for the inspected baseline.

No database contents were inspected or modified while writing this documentation. A successful build does not establish algorithm correctness, browser usability, or hosting readiness.

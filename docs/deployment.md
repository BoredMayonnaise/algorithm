# Linux operation and hosting

## Delivery status

The existing C++ target builds in this workspace. Public hosting, TLS, browser behavior, backup recovery, and load handling have **not** been verified. There is no approved target hostname, remote host, or deployment configuration in this project.

Do not change an existing reverse proxy, open firewall ports, install a service, or restart unrelated services based on this guide alone. Public deployment requires an explicit target and approval.

## Current local operation

Build and run from the project root as described in the [user guide](usage.md). The only existing application environment setting is `PORT`; it defaults to `8080` and currently uses unchecked `atoi` conversion.

Current runtime requirements are the compiled C++ application, SQLite and platform libraries, the `public/` directory, and a writable working directory for `algo.db`. Crow and Asio headers are build-time inputs, not separate production processes.

The current page fetches Tailwind from a CDN. The proposed local asset build removes that runtime network dependency.

## Proposed production arrangement

```text
HTTPS browser
    TLS reverse proxy with access controls and request limits
    Crow bound to 127.0.0.1 on a private port
        Compiled frontend assets
        C++ algorithms
        SQLite in a persistent writable directory
```

Use a normal Linux process managed by systemd. Containers are optional, not required. Node is needed to build frontend assets but is not required to serve the built application.

Proposed runtime configuration, **not yet implemented**:

| Variable | Purpose | Intended default |
| --- | --- | --- |
| `PORT` | Validated listening port | `8080` |
| `BIND_ADDRESS` | Crow listener address | `127.0.0.1` |
| `STATIC_DIR` | Compiled frontend root | `./dist` |
| `DB_PATH` | Persistent SQLite path | `./algo.db` |

Require explicit writable database and readable asset paths. Fail startup clearly on invalid configuration. A service should run with a dedicated unprivileged user, no write access to application assets, and write access only to the database directory and required temporary storage.

## Database preservation

- Do not store the only copy of `algo.db` inside a disposable release directory.
- Back up before replacing binaries or changing schema/configuration.
- With the service stopped cleanly, copy the database and verify the copy. For online backups, use SQLite's supported backup facilities; copying a live database file alone may miss journal/WAL state.
- Store backups separately from the host's only disk and test restoring into a separate directory.
- Do not execute tests against the live database.
- Keep compatible old binaries and frontend assets for rollback. Rollback must not overwrite newer user data with an old snapshot unless explicitly approved.

## Internet exposure and access

The existing library has no login or ownership checks. Anyone who can access the API can list, create, read, or delete saved mazes. A public demo must not promise private layouts.

For the first hosted release, protect the entire app using reverse-proxy access control appropriate to the host. Verify protection also covers every `/api` route. Do not rely on hidden buttons or CORS as authentication. A truly public, multi-user library needs a separate ownership/authentication design.

Before exposing a deployment:

- Bind Crow to loopback and expose only the TLS reverse proxy.
- Set request-body, rate, connection, and upstream timeout limits.
- Validate JSON before work allocation; bound comparison lists and saved-maze listing.
- Serve only compiled assets from a fixed root and reject traversal attempts.
- Keep secrets out of frontend environment variables and browser bundles.
- Configure logs, restart policy, disk-space checks, and a backup schedule.
- Keep the Vite development server private; do not use it as a production host.

Vercel-style static hosting alone cannot run this native Crow server. A Linux VM or a container-capable host is needed unless the backend architecture changes, which is outside this design.

## Deployment acceptance checklist

- [ ] Approve a target server, URL, access policy, service name, and persistent storage location.
- [ ] Build C++ and frontend assets from documented inputs and a committed dependency lockfile.
- [ ] Pass algorithm, API, database, and browser checks against temporary fixtures.
- [ ] Create and verify a database backup without modifying the existing source database.
- [ ] Install the service with explicit paths, a dedicated user, and loopback binding.
- [ ] Configure TLS/access controls without changing unrelated routes.
- [ ] Confirm the health route, root page, and nested compiled assets through HTTPS.
- [ ] Verify unauthorized requests cannot reach protected APIs.
- [ ] Save, load, run, compare, and export using a disposable deployment test maze.
- [ ] Confirm data survives a service restart.
- [ ] Test phone, tablet, and desktop layouts through the deployed URL.
- [ ] Verify backup recovery and document rollback.

Deployment is complete only after the chosen URL passes these checks. A build, a local health response, or a written service template is not proof of public hosting.

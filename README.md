# Algo

Interactive maze building and pathfinding analysis platform.

The classroom UI includes live search/frontier events, pause/step/replay, a reversible demo,
presentation mode, same-input comparison, and responsive editing.

## Build (Linux)

Requirements: g++, cmake, make, libsqlite3-dev, libasio-dev (standalone asio).

```sh
mkdir -p build && cd build
cmake ..
make -j
```

## Run

```sh
cd /home/ubuntu/algorithm   # so ./public resolves
./build/algo                # listens on :8080 (PORT env overrides)
```

Open http://localhost:8080

## API
- GET /api/health
- GET/POST/DELETE /api/mazes
- GET /api/mazes/:id
- POST /api/run  {rows,cols,grid,start,goal,algorithm}
- POST /api/compare {rows,cols,grid,start,goal,algorithms}

Grid cell: `{"wall":0|1,"cost":<positive number>}` or `0/1`.
Deterministic neighbor order: up, right, down, left. A* uses Manhattan distance * min cell cost.

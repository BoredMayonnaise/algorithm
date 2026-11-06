'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '../public/playback.js'), 'utf8'),
  context,
);
const { createSearchPair, advanceSearchPair, resetSearchPair, pairProgress } =
  context;
const event = (type, r, c, frontier) => ({ type, r, c, frontier });
const maze = {
  rows: 2,
  cols: 2,
  grid: [
    [0, 0],
    [0, 0],
  ],
  start: [0, 0],
  goal: [1, 1],
};
const prefix = [event('frontier', 0, 0, 1), event('expand', 0, 0, 0)];
const bfs = {
  algorithm: 'BFS',
  found: true,
  pathLength: 2,
  totalCost: 2,
  exploredNodes: 4,
  events: [
    ...prefix,
    event('frontier', 0, 1, 1),
    event('frontier', 1, 0, 2),
    event('expand', 0, 1, 1),
    event('frontier', 1, 1, 2),
    event('expand', 1, 0, 1),
    event('expand', 1, 1, 0),
    event('path', 1, 1, 0),
    event('path', 0, 1, 0),
    event('path', 0, 0, 0),
  ],
};
const dfs = {
  algorithm: 'DFS',
  found: true,
  pathLength: 2,
  totalCost: 2,
  exploredNodes: 3,
  events: [
    ...prefix,
    event('frontier', 1, 0, 1),
    event('frontier', 0, 1, 2),
    event('expand', 0, 1, 1),
    event('frontier', 1, 1, 2),
    event('expand', 1, 1, 1),
    event('path', 1, 1, 1),
    event('path', 0, 1, 1),
    event('path', 0, 0, 1),
  ],
};
const original = JSON.stringify({ maze, bfs, dfs });
const pair = createSearchPair(maze, [bfs, dfs]);
const greedyPair = createSearchPair(maze, [
  bfs,
  { ...dfs, algorithm: 'Greedy Best-First' },
]);
while (!pairProgress(greedyPair).done) advanceSearchPair(greedyPair);
assert.equal(greedyPair.tracks[1].explored, 3);
resetSearchPair(greedyPair);
assert.equal(pairProgress(greedyPair).current, 0);
const mixed = createSearchPair(maze, [bfs, dfs]);
for (let i = 0; i < 7; i++) advanceSearchPair(mixed);
assert.equal(
  mixed.tracks[0].result.events[mixed.tracks[0].index].type,
  'expand',
);
assert.equal(mixed.tracks[1].result.events[mixed.tracks[1].index].type, 'path');
assert.equal(
  context.playbackRate({ kind: 'search', pair: mixed }),
  context.playbackRate({ kind: 'search', pair }),
  'One lane entering its path must not change the other lane’s pace',
);
assert.equal(pair.tracks?.length, 2);
assert.equal(pair.tracks[0].peakFrontier, 0);
advanceSearchPair(pair);
assert.equal(pair.tracks[0].frontier, 1);
assert.equal(pair.tracks[0].peakFrontier, 1);
assert.equal(pair.tracks[1].explored, 0);
advanceSearchPair(pair);
assert.equal(pair.tracks[0].explored, 1);
assert.equal(pair.tracks[0].peakFrontier, 1);
assert.equal(pair.tracks[1].active, 0);
for (let i = 2; i < 10; i++) advanceSearchPair(pair);
assert.equal(pair.tracks[1].done, true);
assert.equal(pair.tracks[0].done, false);
advanceSearchPair(pair);
assert.equal(pairProgress(pair).done, true);
assert.equal(pairProgress(pair).current, 21);
assert.equal(pair.tracks[0].explored, 4);
assert.equal(pair.tracks[1].explored, 3);
assert.equal(pair.tracks[1].frontier, 1);
assert.equal(pair.tracks[0].peakFrontier, 2);
assert.equal(pair.tracks[1].peakFrontier, 2);
assert.equal(pair.tracks[0].active, -1);
assert.equal(JSON.stringify({ maze, bfs, dfs }), original);
maze.grid[0][1] = 1;
assert.equal(pair.snapshot.grid[0][1], 0);
resetSearchPair(pair);
assert.equal(pairProgress(pair).current, 0);
assert.ok(
  pair.tracks.every(
    (t) =>
      t.explored === 0 && t.frontier === 0 && t.peakFrontier === 0 && !t.done,
  ),
);
while (!pairProgress(pair).done) advanceSearchPair(pair);
assert.equal(pair.tracks[0].explored, 4);
assert.equal(pair.tracks[1].frontier, 1);
assert.equal(pair.tracks[1].peakFrontier, 2);
console.log(
  'PASS: paired events advance independently at a shared pace; replay keeps the immutable snapshot',
);
const blocked = {
  algorithm: 'BFS',
  found: false,
  pathLength: 0,
  totalCost: 0,
  exploredNodes: 1,
  events: prefix,
};
const noPath = createSearchPair(
  {
    ...pair.snapshot,
    grid: [
      [0, 1],
      [1, 0],
    ],
  },
  [blocked, { ...blocked, algorithm: 'A*' }],
);
while (!pairProgress(noPath).done) advanceSearchPair(noPath);
assert.ok(
  noPath.tracks.every(
    (t) =>
      t.done && !t.result.found && t.explored === 1 && t.peakFrontier === 1,
  ),
);
const one = {
  algorithm: 'BFS',
  found: true,
  pathLength: 0,
  totalCost: 0,
  exploredNodes: 1,
  events: [...prefix, event('path', 0, 0, 0)],
};
const singleton = createSearchPair(
  { rows: 1, cols: 1, grid: [[0]], start: [0, 0], goal: [0, 0] },
  [one, { ...one, algorithm: 'A*' }],
);
while (!pairProgress(singleton).done) advanceSearchPair(singleton);
assert.ok(
  singleton.tracks.every((t) => t.result.pathLength === 0 && t.path[0] === 1),
);
assert.throws(() => createSearchPair(pair.snapshot, [bfs, bfs]));
assert.throws(() =>
  createSearchPair(pair.snapshot, [
    { ...bfs, events: [event('expand', 0, 0, 0)] },
    dfs,
  ]),
);
console.log(
  'PASS: no path, one-cell paths, distinct algorithms and malformed traces',
);

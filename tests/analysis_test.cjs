'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ Intl });
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '../public/analysis.js'), 'utf8'),
  context,
);
const {
  analyzeComparison,
  analyzeMaze,
  formatNumber,
  formatExploration,
  averageMoveCost,
} = context;

const maze = {
  rows: 2,
  cols: 3,
  grid: [
    [
      { wall: 0, cost: 1 },
      { wall: 0, cost: 20 },
      { wall: 0, cost: 1 },
    ],
    [0, 0, 0],
  ],
  start: [0, 0],
  goal: [0, 2],
};
const results = [
  {
    algorithm: 'DFS',
    found: true,
    pathLength: 2,
    totalCost: 21,
    exploredNodes: 3,
  },
  {
    algorithm: 'BFS',
    found: true,
    pathLength: 2,
    totalCost: 21,
    exploredNodes: 4,
  },
  {
    algorithm: 'Dijkstra',
    found: true,
    pathLength: 4,
    totalCost: 4,
    exploredNodes: 5,
  },
  {
    algorithm: 'A*',
    found: true,
    pathLength: 4,
    totalCost: 4,
    exploredNodes: 5,
  },
];
const original = JSON.stringify({ maze, results });
assert.equal(typeof averageMoveCost, 'function');
assert.equal(averageMoveCost(results[1]), 10.5);
assert.equal(averageMoveCost(results[2]), 1);
assert.equal(
  averageMoveCost({ ...results[1], found: false, pathLength: 0, totalCost: 0 }),
  null,
);
assert.equal(
  averageMoveCost({ ...results[1], pathLength: 0, totalCost: 0 }),
  null,
);
assert.equal(
  averageMoveCost({ ...results[1], pathLength: 4, totalCost: 1e-12 }),
  2.5e-13,
);
const analysis = analyzeComparison(maze, results);
assert.equal(analysis.profile?.openCells, 6);
assert.equal(analysis.profile?.weightedCells, 1);
assert.equal(analyzeMaze(maze).openCells, 6);
assert.notEqual(formatExploration(1, 3600), '0%');
assert.equal(formatExploration(3600, 3600), '100%');
assert.equal(analysis.fewestMoves, 2);
assert.equal(analysis.lowestCost, 4);
assert.equal(analysis.rows[1].extraMoves, 0);
assert.equal(analysis.rows[1].extraCost, 17);
assert.equal(analysis.rows[2].extraMoves, 2);
assert.equal(analysis.rows[2].extraCost, 0);
assert.ok(Math.abs(analysis.rows[2].exploredPercent - (100 * 5) / 6) < 1e-9);
assert.equal(analysis.rows[0].exploredFraction, 3 / 5);
assert.ok(
  analysis.insights.some((text) => text.includes('BFS') && text.includes('17')),
);
assert.equal(
  JSON.stringify({ maze, results }),
  original,
  'Analysis mutated its immutable input',
);
assert.equal(analyzeComparison(maze, [...results].reverse()).lowestCost, 4);
console.log(
  'PASS: measured weighted-route tradeoffs, exploration denominator, input immutability and result order',
);

const blocked = results.map((r) => ({
  ...r,
  found: false,
  pathLength: 0,
  totalCost: 0,
  exploredNodes: 1,
}));
const noPath = analyzeComparison(maze, blocked);
assert.equal(noPath.fewestMoves, null);
assert.equal(noPath.lowestCost, null);
assert.ok(
  noPath.rows.every((r) => r.extraMoves === null && r.extraCost === null),
);
assert.ok(noPath.rows.every((r) => r.costFraction === null));
assert.ok(noPath.insights[0].includes('No algorithm found a path'));
const one = analyzeComparison(
  { rows: 1, cols: 1, grid: [[{ wall: 0, cost: 7 }]] },
  results.map((r) => ({ ...r, pathLength: 0, totalCost: 0, exploredNodes: 1 })),
);
assert.equal(one.lowestCost, 0);
assert.ok(
  one.rows.every(
    (r) => r.extraMoves === 0 && r.extraCost === 0 && r.exploredPercent === 100,
  ),
);
assert.ok(one.rows.every((r) => r.costFraction === 0));
console.log(
  'PASS: no-path metrics stay unavailable; one-cell zero-cost paths and ties remain valid',
);

const tiny = results.map((r) => ({
  ...r,
  totalCost: r.algorithm === 'BFS' ? 2e-12 : 1e-12,
  pathLength: 2,
}));
const tinyAnalysis = analyzeComparison(maze, tiny);
assert.equal(tinyAnalysis.rows[1].extraCost, 1e-12);
assert.equal(tinyAnalysis.rows[1].costFraction, 1);
assert.equal(tinyAnalysis.rows[2].costFraction, 0.5);
assert.notEqual(
  formatNumber(1e-12),
  '0',
  'Small positive costs must not be formatted as zero',
);
assert.ok(
  formatNumber(1e-12).length < 12,
  'Tiny costs need compact readable notation',
);
const near = results.map((r) => ({
  ...r,
  pathLength: 2,
  totalCost: r.algorithm === 'A*' ? 0.1 + 0.2 : 0.3,
}));
assert.equal(analyzeComparison(maze, near).rows[3].extraCost, 0);
console.log(
  'PASS: fractional costs use relative tolerance without rounding away small positive values',
);

assert.throws(() => analyzeComparison(maze, results.slice(0, 3)));
assert.throws(() =>
  analyzeComparison(maze, [results[0], results[1], results[2], results[2]]),
);
assert.throws(() =>
  analyzeComparison(
    maze,
    results.map((r) => (r.algorithm === 'A*' ? { ...r, totalCost: 2 } : r)),
  ),
);
assert.throws(() =>
  analyzeComparison(
    maze,
    results.map((r) => (r.algorithm === 'BFS' ? { ...r, found: false } : r)),
  ),
);
assert.throws(() =>
  analyzeComparison(
    maze,
    results.map((r) => ({ ...r, exploredNodes: 99 })),
  ),
);
console.log(
  'PASS: incomplete or contradictory results cannot produce misleading analytics',
);

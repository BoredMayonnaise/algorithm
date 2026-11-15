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
const result = { found: true, pathLength: 2, totalCost: 21 };
const original = JSON.stringify({ maze, result });
assert.equal(averageMoveCost(result), 10.5);
assert.equal(averageMoveCost({ ...result, pathLength: 4, totalCost: 4 }), 1);
assert.equal(
  averageMoveCost({ ...result, found: false, pathLength: 0, totalCost: 0 }),
  null,
);
assert.equal(
  averageMoveCost({ ...result, pathLength: 0, totalCost: 0 }),
  null,
);
assert.equal(
  averageMoveCost({ ...result, pathLength: 4, totalCost: 1e-12 }),
  2.5e-13,
);
const profile = analyzeMaze(maze);
assert.equal(profile.openCells, 6);
assert.equal(profile.weightedCells, 1);
assert.notEqual(formatExploration(1, 3600), '0%');
assert.equal(formatExploration(3600, 3600), '100%');
assert.equal(
  JSON.stringify({ maze, result }),
  original,
  'Analysis mutated its immutable input',
);
assert.notEqual(
  formatNumber(1e-12),
  '0',
  'Small positive costs must not be formatted as zero',
);
assert.ok(
  formatNumber(1e-12).length < 12,
  'Tiny costs need compact readable notation',
);
console.log(
  'PASS: maze profiles, average move costs, input immutability and small-number formatting',
);

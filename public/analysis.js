'use strict';

function analyzeMaze(maze) {
  if (
    !maze ||
    !Number.isInteger(maze.rows) ||
    !Number.isInteger(maze.cols) ||
    maze.rows < 1 ||
    maze.cols < 1 ||
    maze.rows > 60 ||
    maze.cols > 60 ||
    !Array.isArray(maze.grid) ||
    maze.grid.length !== maze.rows
  ) {
    throw new Error('Cannot analyze an invalid maze.');
  }
  const profile = { openCells: 0, weightedCells: 0 };
  for (const row of maze.grid) {
    if (!Array.isArray(row) || row.length !== maze.cols)
      throw new Error('Cannot analyze an invalid grid shape.');
    for (const cell of row) {
      const wall = typeof cell === 'number' ? cell : cell?.wall;
      const cost = typeof cell === 'number' ? 1 : (cell?.cost ?? 1);
      if (
        ![0, 1].includes(wall) ||
        !Number.isFinite(cost) ||
        cost <= 0 ||
        cost > 1000
      )
        throw new Error('Cannot analyze invalid cells or weights.');
      if (!wall) {
        ++profile.openCells;
        if (cost !== 1) ++profile.weightedCells;
      }
    }
  }
  if (!profile.openCells)
    throw new Error('A maze needs open cells to compare searches.');
  return profile;
}

const metricNumberFormat = new Intl.NumberFormat(undefined, {
  maximumSignificantDigits: 6,
});
const smallNumberFormat = new Intl.NumberFormat(undefined, {
  maximumSignificantDigits: 6,
  notation: 'scientific',
});
const explorationNumberFormat = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 2,
});
function formatNumber(n) {
  return (
    n !== 0 && Math.abs(n) < 0.0001 ? smallNumberFormat : metricNumberFormat
  ).format(n);
}
function formatExploration(explored, openCells) {
  return explorationNumberFormat.format(explored / openCells);
}

function averageMoveCost(result) {
  return result.found && result.pathLength > 0
    ? result.totalCost / result.pathLength
    : null;
}

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

function analyzeComparison(maze, results) {
  const names = ['DFS', 'BFS', 'Dijkstra', 'A*'];
  if (
    !Array.isArray(results) ||
    results.length !== 4 ||
    results.some((r) => !r || !names.includes(r.algorithm)) ||
    new Set(results.map((r) => r.algorithm)).size !== 4
  ) {
    throw new Error(
      'Comparison needs one result from each of the four algorithms.',
    );
  }
  const profile = analyzeMaze(maze);
  for (const r of results) {
    if (
      typeof r.found !== 'boolean' ||
      !Number.isInteger(r.exploredNodes) ||
      r.exploredNodes < 1 ||
      r.exploredNodes > profile.openCells ||
      !Number.isInteger(r.pathLength) ||
      r.pathLength < 0 ||
      r.pathLength >= profile.openCells ||
      !Number.isFinite(r.totalCost) ||
      r.totalCost < 0 ||
      (r.found &&
        ((r.pathLength === 0 && r.totalCost !== 0) ||
          (r.pathLength > 0 && r.totalCost === 0)))
    ) {
      throw new Error(
        'Comparison returned invalid counts or path costs. Run it again.',
      );
    }
  }
  const bfs = results.find((r) => r.algorithm === 'BFS');
  const dijkstra = results.find((r) => r.algorithm === 'Dijkstra');
  const astar = results.find((r) => r.algorithm === 'A*');
  if (results.some((r) => r.found !== dijkstra.found))
    throw new Error(
      'Algorithms disagree on reachability. Results cannot be compared safely.',
    );
  const fewestMoves = bfs.found ? bfs.pathLength : null;
  const lowestCost = dijkstra.found ? dijkstra.totalCost : null;
  // Relative tolerance keeps tiny positive costs meaningful and absorbs summation noise.
  const equalCost = (a, b) =>
    Math.abs(a - b) <=
    1e-9 * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
  if (astar.found && !equalCost(astar.totalCost, lowestCost))
    throw new Error(
      'A* and Dijkstra disagree on lowest cost. Results cannot be compared safely.',
    );
  const largestCost = Math.max(
    0,
    ...results.filter((r) => r.found).map((r) => r.totalCost),
  );
  const largestExplored = Math.max(...results.map((r) => r.exploredNodes));
  const rows = results.map((result) => {
    if (
      result.found &&
      (result.pathLength < fewestMoves ||
        (result.totalCost < lowestCost &&
          !equalCost(result.totalCost, lowestCost)))
    ) {
      throw new Error(
        'A path contradicts the BFS or Dijkstra baseline. Run the comparison again.',
      );
    }
    return {
      ...result,
      exploredPercent: (100 * result.exploredNodes) / profile.openCells,
      exploredFraction: result.exploredNodes / largestExplored,
      costFraction: result.found
        ? largestCost > 0
          ? result.totalCost / largestCost
          : 0
        : null,
      extraMoves: result.found ? result.pathLength - fewestMoves : null,
      extraCost: result.found
        ? equalCost(result.totalCost, lowestCost)
          ? 0
          : result.totalCost - lowestCost
        : null,
    };
  });
  const insights = [];
  if (!dijkstra.found) {
    insights.push(
      'No algorithm found a path. Remove a wall or move an endpoint, then compare again.',
    );
  } else {
    const bfsExtra = rows.find((r) => r.algorithm === 'BFS').extraCost;
    insights.push(
      bfsExtra > 0
        ? `On this maze, BFS found the fewest moves but cost ${formatNumber(bfsExtra)} more than the lowest-cost route.`
        : `On this maze, BFS found the fewest moves (${bfs.pathLength}) and also matched the lowest cost.`,
    );
    const difference = dijkstra.exploredNodes - astar.exploredNodes;
    insights.push(
      difference > 0
        ? `A* matched the lowest cost with ${difference} fewer explored nodes than Dijkstra.`
        : difference < 0
          ? `A* matched the lowest cost but explored ${-difference} more nodes than Dijkstra.`
          : `A* and Dijkstra matched the lowest cost and explored ${astar.exploredNodes} nodes each.`,
    );
  }
  return { profile, fewestMoves, lowestCost, rows, insights };
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

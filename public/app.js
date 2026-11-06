'use strict';

const $ = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const algorithmInfo = {
  'A*': {
    name: 'A* search',
    tag: 'Heuristic',
    description:
      'Chooses the next cell using the cost so far and an estimate of the cost to the goal.',
    guarantee:
      'Lowest cost here: Manhattan distance × the minimum cell weight is consistent for this four-way grid.',
  },
  Dijkstra: {
    name: 'Dijkstra’s algorithm',
    tag: 'Lowest cost',
    description:
      'Explores the cheapest known route first, accounting for cell weights.',
    guarantee:
      'Guarantees lowest cost with nonnegative weights. This lab supports strictly positive entry weights.',
  },
  BFS: {
    name: 'Breadth-first search',
    tag: 'Queue',
    description: 'Explores in layers, taking the oldest cell from the queue.',
    guarantee:
      'Finds the fewest moves on this grid. Guarantees lowest cost only when all entry weights are equal.',
  },
  DFS: {
    name: 'Depth-first search',
    tag: 'Stack',
    description:
      'Follows one branch at a time, taking the newest cell from the stack.',
    guarantee:
      'Finds a route if one exists, but does not guarantee the fewest moves or lowest cost.',
  },
  'Greedy Best-First': {
    name: 'Greedy best-first search',
    tag: 'Heuristic only',
    description:
      'Chooses the cell with the shortest estimated distance to the goal, ignoring the cost so far and cell weights.',
    guarantee:
      'Finds a route if one exists on this finite grid. Does not guarantee the fewest moves or lowest cost.',
  },
};

function emptyMaze(rows, cols) {
  return {
    rows,
    cols,
    grid: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ wall: 0, cost: 1 })),
    ),
    start: [0, 0],
    goal: [rows - 1, cols - 1],
    marker: 'S',
  };
}

function exampleMaze() {
  const m = emptyMaze(15, 25);
  for (let r = 0; r < m.rows; r++)
    for (let c = 0; c < m.cols; c++) {
      if (r === 0 || r === 14 || c === 0 || c === 24) m.grid[r][c].wall = 1;
    }
  [
    [6, 3],
    [12, 10],
    [18, 5],
  ].forEach(([c, gap]) => {
    for (let r = 1; r < 14; r++)
      if (r !== gap && r !== gap + 1) m.grid[r][c].wall = 1;
  });
  for (let r = 1; r < 14; r++)
    for (let c = 1; c < 24; c++)
      if (!m.grid[r][c].wall && (r * 25 + c) % 7 === 0)
        m.grid[r][c].cost = 2 + ((r * 3 + c) % 8);
  m.start = [7, 2];
  m.goal = [7, 22];
  m.grid[7][2].cost = m.grid[7][22].cost = 1;
  return m;
}

// Validate the complete snapshot before touching the editor, including legacy numeric grids.
function validateMaze(data) {
  if (!data || typeof data !== 'object')
    throw new Error('Expected a maze object.');
  const { rows, cols } = data;
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    rows < 1 ||
    cols < 1 ||
    rows > 60 ||
    cols > 60
  )
    throw new Error('Rows and columns must be whole numbers from 1–60.');
  if (!Array.isArray(data.grid) || data.grid.length !== rows)
    throw new Error('Grid row count does not match.');
  const grid = data.grid.map((row) => {
    if (!Array.isArray(row) || row.length !== cols)
      throw new Error('Grid column count does not match.');
    return row.map((cell) => {
      if (cell === 0 || cell === 1) return { wall: cell, cost: 1 };
      if (
        !cell ||
        typeof cell !== 'object' ||
        Array.isArray(cell) ||
        ![0, 1].includes(cell.wall)
      )
        throw new Error('Each cell needs wall 0 or 1.');
      const cost = cell.cost === undefined ? 1 : cell.cost;
      if (
        typeof cost !== 'number' ||
        !Number.isFinite(cost) ||
        cost <= 0 ||
        cost > 1000
      )
        throw new Error('Entry weights must be positive numbers up to 1000.');
      return { wall: cell.wall, cost };
    });
  });
  for (const key of ['start', 'goal']) {
    const p = data[key];
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      !p.every(Number.isInteger) ||
      p[0] < 0 ||
      p[0] >= rows ||
      p[1] < 0 ||
      p[1] >= cols
    )
      throw new Error('Start and goal must be coordinates inside the grid.');
    if (grid[p[0]][p[1]].wall)
      throw new Error('Start and goal cannot be on a wall.');
  }
  const markers = ['S', '🚀', '🤖', 'rat', '🧭', '🏃'];
  return {
    rows,
    cols,
    grid,
    start: [...data.start],
    goal: [...data.goal],
    marker: markers.includes(data.marker) ? data.marker : 'S',
  };
}

let maze = exampleMaze();
let cells = [],
  cellsRight = [];
let selectedTool = 'wall',
  selectedCell = 0,
  panMode = false,
  cellSize = 24,
  fitted = true;
let inputVersion = 0,
  requestEpoch = 0,
  requestController = null;
let demoSnapshot = null,
  generationView = null,
  generationCosts = null;
const playback = {
  record: null,
  index: 0,
  playing: false,
  status: 'ready',
  requesting: false,
  frame: null,
  last: 0,
  budget: 0,
};
const gridWrap = $('gridWrap');
const gridWrapRight = $('gridWrapRight');
const boardWraps = [gridWrap, gridWrapRight];

function buildPayload() {
  return clone(maze);
}
function showNotice(message, error = false) {
  $('notice').textContent = message;
  $('notice').classList.toggle('error', error);
  $('notice').hidden = false;
}
function hideNotice() {
  $('notice').hidden = true;
}
function positionText(r, c) {
  return `row ${r + 1}, column ${c + 1}`;
}
function isEndpoint(r, c, key) {
  return maze[key][0] === r && maze[key][1] === c;
}

function renderCell(index, side = 0) {
  const el = (side ? cellsRight : cells)[index];
  if (!el) return;
  const track =
    playback.record?.kind === 'search'
      ? playback.record.pair.tracks[side]
      : null;
  const r = Math.floor(index / maze.cols),
    c = index % maze.cols,
    cell = maze.grid[r][c];
  const cost = generationCosts ? generationCosts[index] : cell.cost;
  const s = isEndpoint(r, c, 'start'),
    g = isEndpoint(r, c, 'goal');
  const wall = generationView ? generationView[index] && !s && !g : cell.wall;
  const classes = ['cell'];
  if (wall) classes.push('wall');
  else {
    if (cost !== 1) classes.push('weighted');
    if (track?.pending[index] > 0 && !track.visited[index])
      classes.push('frontier');
    if (track?.visited[index]) classes.push('explored');
    if (track?.path[index]) classes.push('path');
    if (s) classes.push('start');
    if (g) classes.push('goal');
    if (track?.active === index) classes.push('active');
  }
  if (document.activeElement === boardWraps[side] && selectedCell === index)
    classes.push('keyboard');
  el.className = classes.join(' ');
  const text = wall
    ? ''
    : s && g
      ? 'S/G'
      : s
        ? 'S'
        : g
          ? 'G'
          : cost !== 1
            ? String(cost)
            : '';
  if (el.textContent !== text) el.textContent = text;
  el.setAttribute(
    'aria-label',
    `${positionText(r, c)}: ${s ? 'start, ' : ''}${g ? 'goal, ' : ''}${wall ? 'wall' : `entry weight ${cost}`}${track?.pending[index] > 0 && !track.visited[index] ? ', frontier' : ''}${track?.visited[index] ? ', explored' : ''}${track?.path[index] ? ', path' : ''}${track?.active === index ? ', current node' : ''}`,
  );
}

function renderBoth(index) {
  renderCell(index);
  renderCell(index, 1);
}
function renderAll() {
  cells.forEach((_, index) => renderBoth(index));
}

function renderGrid() {
  boardWraps.forEach((wrap, side) => {
    const refs = [];
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.setAttribute('role', 'rowgroup');
    grid.style.gridTemplateColumns = `repeat(${maze.cols},var(--cell))`;
    for (let r = 0; r < maze.rows; r++) {
      const row = document.createElement('div');
      row.setAttribute('role', 'row');
      row.style.display = 'contents';
      for (let c = 0; c < maze.cols; c++) {
        const cell = document.createElement('div');
        cell.id = `${side ? 'right-' : ''}cell-${r}-${c}`;
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-rowindex', r + 1);
        cell.setAttribute('aria-colindex', c + 1);
        refs.push(cell);
        row.append(cell);
      }
      grid.append(row);
    }
    wrap.replaceChildren(grid);
    wrap.setAttribute('aria-rowcount', maze.rows);
    wrap.setAttribute('aria-colcount', maze.cols);
    wrap.style.setProperty('--board-ratio', maze.rows / maze.cols);
    selectedCell = Math.min(selectedCell, refs.length - 1);
    wrap.setAttribute('aria-activedescendant', refs[selectedCell].id);
    if (side) cellsRight = refs;
    else cells = refs;
  });
  renderAll();
  $('boardSize').textContent = `${maze.rows} × ${maze.cols}`;
  fitBoard();
}

function stopFrame() {
  if (playback.frame !== null) cancelAnimationFrame(playback.frame);
  playback.frame = null;
  playback.playing = false;
}

function clearSearch() {
  ++requestEpoch;
  requestController?.abort();
  requestController = null;
  stopFrame();
  generationView = null;
  generationCosts = null;
  Object.assign(playback, {
    record: null,
    index: 0,
    status: 'ready',
    requesting: false,
    budget: 0,
  });
  renderAll();
  updateUI();
}

function invalidateMaze() {
  ++inputVersion;
  clearSearch();
}

function replaceMaze(data) {
  const validated = validateMaze(data);
  endGesture();
  invalidateMaze();
  maze = validated;
  selectedCell = maze.start[0] * maze.cols + maze.start[1];
  renderGrid();
  updateUI();
}

function updateAlgorithm() {
  ['', 'Right'].forEach((suffix) => {
    const info = algorithmInfo[$('algo' + suffix).value];
    $('algoName' + suffix).textContent = info.name;
    $('algoTag' + suffix).textContent = info.tag;
    $('algoDescription' + suffix).textContent = info.description;
    $('algoGuarantee' + suffix).textContent = info.guarantee;
  });
}

function updateUI() {
  const p = playback,
    record = p.record;
  const labels = {
    ready: 'Ready',
    requesting: 'Searching',
    generating: 'Generating',
    searching: 'Searching',
    paused: 'Paused',
    done: 'Path Found',
    'no-path': 'No Path',
  };
  if ($('status').textContent !== labels[p.status])
    $('status').textContent = labels[p.status];
  $('status').dataset.state = p.status;
  const runLabel = p.requesting
    ? p.status === 'generating'
      ? 'Generating…'
      : 'Computing…'
    : p.playing
      ? 'Pause'
      : p.status === 'paused'
        ? 'Resume'
        : 'Run both';
  $('runBtn').querySelector('span').textContent = runLabel;
  $('runBtn').disabled = p.requesting;
  $('runBtn').querySelector('svg').style.display = p.playing ? 'none' : '';
  $('stepBtn').disabled =
    p.requesting ||
    (record?.kind === 'search' && pairProgress(record.pair).done);
  $('stepBtn').title = p.requesting
    ? 'Wait for computation to finish'
    : 'Pause and advance one recorded event (N)';
  $('replayBtn').disabled = !record || p.requesting || record.kind !== 'search';
  $('replayBtn').title = record
    ? 'Replay this exact recorded search'
    : 'Run a search to record events first';
  ['', 'Right'].forEach((suffix, side) => {
    const track = record?.kind === 'search' ? record.pair.tracks[side] : null;
    const completed = track?.done && track.result.found;
    const state = track?.done
      ? track.result.found
        ? 'done'
        : 'no-path'
      : p.status;
    $('laneStatus' + suffix).textContent = labels[state];
    $('laneStatus' + suffix).dataset.state = state;
    $('exploredValue' + suffix).textContent = (
      track?.explored || 0
    ).toLocaleString();
    $('frontierValue' + suffix).textContent = (
      track?.frontier || 0
    ).toLocaleString();
    $('exploredHint' + suffix).textContent = track
      ? `Of ${record.profile.openCells.toLocaleString()} open cells`
      : 'Expanded nodes';
    $('peakValue' + suffix).textContent = (
      track?.peakFrontier || 0
    ).toLocaleString();
    $('coverageValue' + suffix).textContent = track
      ? formatExploration(track.explored, record.profile.openCells)
      : '—';
    const averageCost = completed ? averageMoveCost(track.result) : null;
    $('averageCostValue' + suffix).textContent =
      averageCost === null ? '—' : formatNumber(averageCost);
    $('averageCostValue' + suffix).title =
      averageCost === null ? '' : String(averageCost);
    $('movesValue' + suffix).textContent = completed
      ? track.result.pathLength
      : '—';
    $('costValue' + suffix).textContent = completed
      ? formatNumber(track.result.totalCost)
      : '—';
    $('costValue' + suffix).title = completed
      ? String(track.result.totalCost)
      : '';
    $('movesHint' + suffix).textContent =
      state === 'no-path'
        ? 'Goal unreachable'
        : completed
          ? 'Start to goal'
          : 'After search';
    $('computeValue' + suffix).textContent = Number.isFinite(
      track?.result.execTimeUs,
    )
      ? `${track.result.execTimeUs.toLocaleString()} µs`
      : '—';
  });
}

async function api(url, payload, signal) {
  const response = await fetch(url, {
    signal,
    ...(payload === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Server returned an unreadable response.');
  }
  if (!response.ok || data?.error)
    throw new Error(data?.error || `Request failed (${response.status}).`);
  return data;
}

function beginRequest(status) {
  endGesture();
  clearSearch();
  hideNotice();
  requestController = new AbortController();
  playback.requesting = true;
  playback.status = status;
  updateUI();
  return { ticket: requestEpoch, signal: requestController.signal };
}

async function runSearch(autoplay = true) {
  const snapshot = buildPayload(),
    algorithms = [$('algo').value, $('algoRight').value];
  if (algorithms[0] === algorithms[1]) {
    showNotice('Choose two different algorithms.', true);
    return;
  }
  const { ticket, signal } = beginRequest('requesting');
  try {
    const results = await Promise.all(
      algorithms.map((algorithm) =>
        api('/api/run', { ...snapshot, algorithm, trace: true }, signal),
      ),
    );
    if (ticket !== requestEpoch) return;
    const pair = createSearchPair(snapshot, results);
    playback.requesting = false;
    playback.record = {
      kind: 'search',
      snapshot: pair.snapshot,
      profile: analyzeMaze(pair.snapshot),
      pair,
    };
    playback.status = 'paused';
    updateUI();
    if (autoplay) resume();
    else step();
  } catch (error) {
    requestError(error, ticket);
  }
}

function requestError(error, ticket) {
  if (ticket !== requestEpoch || error.name === 'AbortError') return;
  requestController?.abort();
  playback.requesting = false;
  playback.status = 'ready';
  updateUI();
  showNotice(error.message, true);
}

function applyEvent(event) {
  const index = event.r * maze.cols + event.c;
  generationView[index] = event.wall;
  if (event.cost !== undefined) generationCosts[index] = event.cost;
  renderBoth(index);
}

function finishPlayback() {
  const p = playback;
  stopFrame();
  if (p.record.kind === 'generation') {
    p.status = 'ready';
    generationView = null;
    generationCosts = null;
    renderAll();
  } else {
    p.status = p.record.pair.tracks[0].result.found ? 'done' : 'no-path';
  }
  updateUI();
}

function advance() {
  const p = playback;
  if (!p.record) return;
  if (p.record.kind === 'search') {
    advanceSearchPair(p.record.pair).forEach((dirty, side) =>
      dirty.forEach((index) => renderCell(index, side)),
    );
    if (pairProgress(p.record.pair).done) finishPlayback();
  } else {
    if (p.index < p.record.events.length)
      applyEvent(p.record.events[p.index++]);
    if (p.index === p.record.events.length) finishPlayback();
  }
}

function frame(now) {
  const p = playback;
  p.frame = null;
  if (!p.playing) return;
  const elapsed = now - p.last;
  p.last = now;
  const rate = playbackRate(p.record);
  p.budget += (Math.min(elapsed, 100) * rate) / 1000;
  let batch = Math.min(128, Math.floor(p.budget));
  p.budget -= batch;
  while (batch-- > 0 && p.playing) advance();
  updateUI();
  if (p.playing) p.frame = requestAnimationFrame(frame);
}

function resume() {
  const p = playback;
  if (!p.record || p.requesting || p.playing) return;
  if (
    p.record.kind === 'search'
      ? pairProgress(p.record.pair).done
      : p.index >= p.record.events.length
  )
    return finishPlayback();
  p.playing = true;
  p.status = p.record.kind === 'generation' ? 'generating' : 'searching';
  p.last = performance.now();
  p.frame = requestAnimationFrame(frame);
  updateUI();
}
function pause() {
  if (!playback.record || playback.requesting) return;
  stopFrame();
  playback.status = 'paused';
  updateUI();
}
function step() {
  if (playback.requesting) return;
  if (
    !playback.record ||
    (playback.record.kind === 'generation' &&
      playback.index >= playback.record.events.length)
  )
    return runSearch(false);
  if (
    playback.record.kind === 'search' &&
    pairProgress(playback.record.pair).done
  )
    return;
  pause();
  advance();
  updateUI();
}
function primaryAction() {
  if (playback.requesting) return;
  if (playback.playing) pause();
  else if (playback.status === 'paused') resume();
  else runSearch();
}
function replay() {
  if (!playback.record || playback.record.kind !== 'search') return;
  stopFrame();
  playback.budget = 0;
  resetSearchPair(playback.record.pair);
  renderAll();
  resume();
}

async function generateMaze() {
  const { ticket, signal } = beginRequest('generating');
  try {
    const result = await api(
      '/api/generate',
      {
        rows: 15,
        cols: 25,
        type: 'teaching',
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        trace: true,
      },
      signal,
    );
    if (ticket !== requestEpoch) return;
    const validated = validateMaze(result);
    if (!Array.isArray(result.events) || !analyzeMaze(validated).weightedCells)
      throw new Error(
        'Rebuild and restart the server to enable weighted generation.',
      );
    ++inputVersion;
    maze = validated;
    generationView = new Uint8Array(maze.rows * maze.cols).fill(1);
    generationCosts = new Float64Array(maze.rows * maze.cols).fill(1);
    renderGrid();
    playback.requesting = false;
    playback.index = 0;
    playback.record = {
      kind: 'generation',
      events: result.events,
      snapshot: buildPayload(),
    };
    resume();
  } catch (error) {
    requestError(error, ticket);
  }
}

function setTool(tool) {
  selectedTool = tool;
  document
    .querySelectorAll('[data-tool]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.tool === tool)),
    );
  if (panMode) togglePan();
  updateBoardHelp();
}
function togglePan() {
  panMode = !panMode;
  $('panBtn').setAttribute('aria-pressed', String(panMode));
  gridWrap.classList.toggle('panning', panMode);
  updateBoardHelp();
}
function updateBoardHelp() {
  $('boardHelp').textContent = panMode
    ? 'Pan mode. Drag the board without drawing.'
    : cellSize < 14
      ? 'Overview. Zoom in to edit the left board.'
      : `Left board: ${selectedTool === 'wall' ? 'draw walls' : selectedTool === 'erase' ? 'erase' : `place ${selectedTool}`}. Arrow keys to move; Enter to draw.`;
}

function paintCell(r, c) {
  const cell = maze.grid[r]?.[c];
  if (!cell) return;
  const index = r * maze.cols + c;
  if (selectedTool === 'wall') {
    if (isEndpoint(r, c, 'start') || isEndpoint(r, c, 'goal')) return;
    cell.wall = 1;
  }
  if (selectedTool === 'erase') {
    cell.wall = 0;
    cell.cost = 1;
  }
  if (selectedTool === 'start' || selectedTool === 'goal') {
    if (cell.wall) {
      showNotice('Erase the wall before placing an endpoint here.', true);
      return;
    }
    const previous = maze[selectedTool][0] * maze.cols + maze[selectedTool][1];
    maze[selectedTool] = [r, c];
    renderBoth(previous);
  }
  renderBoth(index);
}

let gesture = null;
function endGesture() {
  const id = gesture?.id;
  gesture = null;
  if (id !== undefined && gridWrap.hasPointerCapture(id))
    gridWrap.releasePointerCapture(id);
}
function cellAtPoint(event) {
  const el = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest('.cell');
  return el && gridWrap.contains(el)
    ? [Number(el.dataset.r), Number(el.dataset.c)]
    : null;
}
function selectCell(r, c) {
  const old = selectedCell;
  selectedCell = r * maze.cols + c;
  gridWrap.setAttribute('aria-activedescendant', cells[selectedCell].id);
  gridWrapRight.setAttribute(
    'aria-activedescendant',
    cellsRight[selectedCell].id,
  );
  $('cellPosition').textContent = `R${r + 1} · C${c + 1}`;
  renderBoth(old);
  renderBoth(selectedCell);
}
function paintLine(from, to) {
  // Interpolate fast pointer movements so strokes cannot skip cells.
  let [r, c] = from;
  const [endR, endC] = to;
  const dc = Math.abs(endC - c),
    dr = -Math.abs(endR - r),
    sc = c < endC ? 1 : -1,
    sr = r < endR ? 1 : -1;
  let error = dc + dr;
  for (;;) {
    paintCell(r, c);
    if (r === endR && c === endC) break;
    const twice = 2 * error;
    if (twice >= dr) {
      error += dr;
      c += sc;
    }
    if (twice <= dc) {
      error += dc;
      r += sr;
    }
  }
}

gridWrap.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  const target = cellAtPoint(event);
  if (!target && !panMode) return;
  event.preventDefault();
  gridWrap.focus({ preventScroll: true });
  if (!panMode && cellSize < 14) {
    showNotice(
      'Zoom in to draw accurately. Use + for editing, or Fit board for an overview.',
    );
    return;
  }
  gridWrap.setPointerCapture(event.pointerId);
  gesture = {
    id: event.pointerId,
    pan: panMode,
    x: event.clientX,
    y: event.clientY,
    left: gridWrap.scrollLeft,
    top: gridWrap.scrollTop,
    last: target,
  };
  if (!panMode) {
    invalidateMaze();
    hideNotice();
    selectCell(...target);
    paintCell(...target);
  }
});
gridWrap.addEventListener('pointermove', (event) => {
  if (!gesture || event.pointerId !== gesture.id) return;
  event.preventDefault();
  if (gesture.pan) {
    gridWrap.scrollLeft = gesture.left - (event.clientX - gesture.x);
    gridWrap.scrollTop = gesture.top - (event.clientY - gesture.y);
  } else {
    const target = cellAtPoint(event);
    if (target && target.join() !== gesture.last.join()) {
      if (['wall', 'erase'].includes(selectedTool))
        paintLine(gesture.last, target);
      else paintCell(...target);
      gesture.last = target;
      selectCell(...target);
    }
  }
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
  gridWrap.addEventListener(type, () => {
    gesture = null;
  });
gridWrap.addEventListener('focus', () => renderCell(selectedCell));
gridWrap.addEventListener('blur', () => renderCell(selectedCell));
gridWrap.addEventListener('keydown', (event) => {
  let r = Math.floor(selectedCell / maze.cols),
    c = selectedCell % maze.cols;
  const delta = {
    ArrowUp: [-1, 0],
    ArrowRight: [0, 1],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
  }[event.key];
  if (delta) {
    event.preventDefault();
    r = Math.max(0, Math.min(maze.rows - 1, r + delta[0]));
    c = Math.max(0, Math.min(maze.cols - 1, c + delta[1]));
    selectCell(r, c);
    cells[selectedCell].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    invalidateMaze();
    paintCell(r, c);
  }
});

function setCellSize(size) {
  cellSize = size;
  boardWraps.forEach((wrap) => {
    const grid = wrap.firstElementChild;
    if (!grid) return;
    grid.style.setProperty('--cell', `${size}px`);
    grid.style.marginTop = `${Math.max(0, (wrap.clientHeight - maze.rows * size - 2) / 2)}px`;
  });
  updateBoardHelp();
}
function fitBoard() {
  fitted = true;
  setCellSize(
    Math.max(
      3,
      Math.floor(
        Math.min(
          ...boardWraps.map((w) => (w.clientWidth - 3) / maze.cols),
          ...boardWraps.map((w) => (w.clientHeight - 3) / maze.rows),
          42,
        ) * 10,
      ) / 10,
    ),
  );
  boardWraps.forEach((w) => {
    w.scrollTop = 0;
    w.scrollLeft = 0;
  });
}
function zoom(direction) {
  fitted = false;
  const old = cellSize;
  setCellSize(
    direction > 0
      ? Math.min(64, Math.max(24, old * 1.3))
      : Math.max(6, old / 1.3),
  );
  cells[selectedCell].scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
const boardResizeObserver = new ResizeObserver(() => {
  if (fitted) fitBoard();
});
boardWraps.forEach((w) => boardResizeObserver.observe(w));
boardWraps.forEach((wrap, side) =>
  wrap.addEventListener('scroll', () => {
    const other = boardWraps[1 - side];
    if (other.scrollLeft !== wrap.scrollLeft)
      other.scrollLeft = wrap.scrollLeft;
    if (other.scrollTop !== wrap.scrollTop) other.scrollTop = wrap.scrollTop;
  }),
);
gridWrapRight.addEventListener('focus', () => renderCell(selectedCell, 1));
gridWrapRight.addEventListener('blur', () => renderCell(selectedCell, 1));
gridWrapRight.addEventListener('keydown', (event) => {
  const delta = {
    ArrowUp: [-1, 0],
    ArrowRight: [0, 1],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
  }[event.key];
  if (delta) {
    event.preventDefault();
    selectCell(
      Math.max(
        0,
        Math.min(
          maze.rows - 1,
          Math.floor(selectedCell / maze.cols) + delta[0],
        ),
      ),
      Math.max(
        0,
        Math.min(maze.cols - 1, (selectedCell % maze.cols) + delta[1]),
      ),
    );
    cellsRight[selectedCell].scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  } else if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
});

async function refreshList(selectedId) {
  try {
    const list = await api('/api/mazes');
    const selected = selectedId || $('savedList').value;
    $('savedList').replaceChildren();
    if (!list.length)
      $('savedList').append(new Option('No saved mazes yet', ''));
    list.forEach((item) =>
      $('savedList').append(
        new Option(`${item.name} (${item.rows} × ${item.cols})`, item.id),
      ),
    );
    if ([...$('savedList').options].some((o) => o.value === String(selected)))
      $('savedList').value = String(selected);
    $('loadBtn').disabled = !list.length;
  } catch (error) {
    showNotice(`Library unavailable: ${error.message}`, true);
  }
}
async function saveMaze() {
  $('saveBtn').disabled = true;
  try {
    const result = await api('/api/mazes', {
      ...buildPayload(),
      name: $('mazeName').value.trim() || 'Untitled maze',
    });
    showNotice(`Saved “${result.name}” to your library.`);
    await refreshList(result.id);
  } catch (error) {
    showNotice(`Save failed: ${error.message}`, true);
  } finally {
    $('saveBtn').disabled = false;
  }
}
async function loadSelected() {
  const id = $('savedList').value;
  if (!id) return;
  const { ticket, signal } = beginRequest('requesting');
  try {
    const result = await api(
      `/api/mazes/${encodeURIComponent(id)}`,
      undefined,
      signal,
    );
    if (ticket !== requestEpoch) return;
    replaceMaze(result.data);
    $('mazeName').value = result.name;
    showNotice(`Loaded “${result.name}”.`);
  } catch (error) {
    requestError(error, ticket);
  }
}
function exportMaze() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(buildPayload(), null, 2)], {
      type: 'application/json',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'algo-maze.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importMaze(file) {
  const version = inputVersion;
  try {
    if (file.size > 1024 * 1024) throw new Error('File is larger than 1 MiB.');
    const data = validateMaze(JSON.parse(await file.text()));
    if (version !== inputVersion)
      throw new Error(
        'Workspace changed while reading the file. Import again to replace it.',
      );
    replaceMaze(data);
    showNotice(`Imported ${maze.rows} × ${maze.cols} maze.`);
  } catch (error) {
    showNotice(`Import failed: ${error.message}`, true);
  } finally {
    $('importFile').value = '';
  }
}

function startDemo() {
  if (!demoSnapshot)
    demoSnapshot = {
      maze: buildPayload(),
      algorithm: $('algo').value,
      algorithmRight: $('algoRight').value,
      name: $('mazeName').value,
    };
  replaceMaze(exampleMaze());
  $('algo').value = 'BFS';
  $('algoRight').value = 'A*';
  updateAlgorithm();
  $('demoBanner').hidden = false;
  $('restoreBtn').disabled = false;
  runSearch();
}
function restoreDemo() {
  if (!demoSnapshot) return;
  const snapshot = demoSnapshot;
  demoSnapshot = null;
  replaceMaze(snapshot.maze);
  $('algo').value = snapshot.algorithm;
  $('algoRight').value = snapshot.algorithmRight;
  $('mazeName').value = snapshot.name;
  $('demoBanner').hidden = true;
  updateAlgorithm();
  updateUI();
  showNotice('Restored your pre-demo workspace.');
}
function togglePresentation(force) {
  const active = force ?? !document.body.classList.contains('presentation');
  document.body.classList.toggle('presentation', active);
  $('presentationBtn').setAttribute('aria-pressed', String(active));
  $('presentationBtn').querySelector('span').textContent = active
    ? 'Exit presentation'
    : 'Presentation mode';
  requestAnimationFrame(fitBoard);
}

$('tools').addEventListener('click', (event) => {
  const button = event.target.closest('[data-tool]');
  if (button) setTool(button.dataset.tool);
});
$('runBtn').addEventListener('click', primaryAction);
$('stepBtn').addEventListener('click', step);
$('replayBtn').addEventListener('click', replay);
$('resetBtn').addEventListener('click', clearSearch);
$('algo').addEventListener('change', () => {
  clearSearch();
  updateAlgorithm();
});
$('algoRight').addEventListener('change', () => {
  clearSearch();
  updateAlgorithm();
});
$('genMazeBtn').addEventListener('click', generateMaze);
$('clearBtn').addEventListener('click', () => {
  invalidateMaze();
  maze.grid.forEach((row) => row.forEach((cell) => (cell.wall = 0)));
  renderAll();
  showNotice('Walls cleared. Weights and endpoints kept.');
});
$('fitBtn').addEventListener('click', fitBoard);
$('zoomInBtn').addEventListener('click', () => zoom(1));
$('zoomOutBtn').addEventListener('click', () => zoom(-1));
$('panBtn').addEventListener('click', togglePan);
$('saveBtn').addEventListener('click', saveMaze);
$('loadBtn').addEventListener('click', loadSelected);
$('refreshList').addEventListener('click', () => refreshList());
$('exportBtn').addEventListener('click', exportMaze);
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (event) => {
  if (event.target.files[0]) importMaze(event.target.files[0]);
});
$('demoBtn').addEventListener('click', startDemo);
$('restoreBtn').addEventListener('click', restoreDemo);
$('presentationBtn').addEventListener('click', () => togglePresentation());
document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    document.body.classList.contains('presentation')
  ) {
    togglePresentation(false);
    $('presentationBtn').focus();
    return;
  }
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.target.closest('input,select,textarea')
  )
    return;
  if (event.key === ' ' && !event.target.closest('button,summary,a')) {
    event.preventDefault();
    primaryAction();
  }
  if (event.key.toLowerCase() === 'n' && !$('stepBtn').disabled) {
    event.preventDefault();
    step();
  }
  if (event.key.toLowerCase() === 'p') {
    event.preventDefault();
    togglePresentation();
  }
  if ('1234'.includes(event.key) && event.key.length === 1)
    setTool(['wall', 'erase', 'start', 'goal'][Number(event.key) - 1]);
});

// Normal page load never autoplays or writes to the database.
renderGrid();
updateAlgorithm();
updateUI();
refreshList();

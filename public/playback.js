'use strict';
const DEFAULT_PLAYBACK_RATE = 80;
function playbackRate(record) {
  return record?.kind === 'generation'
    ? DEFAULT_PLAYBACK_RATE * 4
    : DEFAULT_PLAYBACK_RATE;
}

function resetTrack(track) {
  track.index = 0;
  track.explored = 0;
  track.frontier = 0;
  track.peakFrontier = 0;
  track.active = -1;
  track.done = false;
  track.visited.fill(0);
  track.pending.fill(0);
  track.path.fill(0);
}

function advanceTrack(track) {
  if (track.done) return [];
  const event = track.result.events[track.index++];
  const index = event.r * track.cols + event.c,
    previous = track.active;
  const dirty = new Set([index]);
  if (event.type === 'frontier') {
    ++track.pending[index];
    ++track.frontier;
    track.peakFrontier = Math.max(track.peakFrontier, track.frontier);
  } else if (event.type === 'expand' || event.type === 'discard') {
    if (!track.pending[index])
      throw new Error('Trace removed an entry that was not in the frontier.');
    --track.pending[index];
    --track.frontier;
    if (event.type === 'expand') {
      if (track.visited[index]) throw new Error('Trace expanded a cell twice.');
      track.visited[index] = 1;
      ++track.explored;
      track.active = index;
    } else if (!track.visited[index])
      throw new Error('A stale entry must refer to an expanded cell.');
  } else {
    if (!track.result.found || !track.visited[index] || track.path[index])
      throw new Error('Invalid path reconstruction event.');
    track.path[index] = 1;
    track.active = index;
  }
  if (event.frontier !== track.frontier)
    throw new Error('Trace frontier counts are inconsistent.');
  if (previous !== track.active && previous >= 0) dirty.add(previous);
  if (track.index === track.result.events.length) {
    if (
      track.explored !== track.result.exploredNodes ||
      track.path.reduce((a, b) => a + b, 0) !==
        (track.result.found ? track.result.pathLength + 1 : 0)
    )
      throw new Error('Trace does not match its final metrics.');
    if (track.active >= 0) dirty.add(track.active);
    track.active = -1;
    track.done = true;
  }
  return [...dirty];
}

function createSearchPair(snapshot, results) {
  if (
    !Number.isInteger(snapshot.rows) ||
    !Number.isInteger(snapshot.cols) ||
    snapshot.rows < 1 ||
    snapshot.cols < 1 ||
    snapshot.rows > 60 ||
    snapshot.cols > 60
  )
    throw new Error('Invalid board dimensions.');
  const names = ['DFS', 'BFS', 'Dijkstra', 'A*', 'Greedy Best-First'];
  if (
    !Array.isArray(results) ||
    results.length !== 2 ||
    results.some((r) => !r || !names.includes(r.algorithm)) ||
    results[0].algorithm === results[1].algorithm
  )
    throw new Error('Choose two different algorithms.');
  if (results[0].found !== results[1].found)
    throw new Error('The algorithms disagree on reachability. Run both again.');
  const tracks = results.map((result) => {
    if (
      !Array.isArray(result.events) ||
      !result.events.length ||
      typeof result.found !== 'boolean' ||
      !Number.isInteger(result.exploredNodes) ||
      result.exploredNodes < 1 ||
      !Number.isInteger(result.pathLength) ||
      result.pathLength < 0 ||
      !Number.isFinite(result.totalCost) ||
      result.totalCost < 0
    )
      throw new Error(
        'Server returned incomplete recorded events. Rebuild and restart the server.',
      );
    const recorded = JSON.parse(JSON.stringify(result));
    recorded.events = Object.freeze(
      recorded.events.map((e) => {
        if (
          !['frontier', 'expand', 'discard', 'path'].includes(e.type) ||
          !Number.isInteger(e.r) ||
          !Number.isInteger(e.c) ||
          e.r < 0 ||
          e.r >= snapshot.rows ||
          e.c < 0 ||
          e.c >= snapshot.cols ||
          !Number.isInteger(e.frontier) ||
          e.frontier < 0
        )
          throw new Error('Server returned an invalid search event.');
        return Object.freeze(e);
      }),
    );
    const size = snapshot.rows * snapshot.cols;
    const track = {
      result: Object.freeze(recorded),
      cols: snapshot.cols,
      visited: new Uint8Array(size),
      pending: new Uint16Array(size),
      path: new Uint8Array(size),
    };
    resetTrack(track);
    // Validate once before playback, not midway through a visible animation.
    while (!track.done) advanceTrack(track);
    resetTrack(track);
    return track;
  });
  return { snapshot: JSON.parse(JSON.stringify(snapshot)), tracks };
}

function advanceSearchPair(pair) {
  return pair.tracks.map(advanceTrack);
}
function resetSearchPair(pair) {
  pair.tracks.forEach(resetTrack);
}
function pairProgress(pair) {
  return {
    current: pair.tracks.reduce((n, t) => n + t.index, 0),
    total: pair.tracks.reduce((n, t) => n + t.result.events.length, 0),
    done: pair.tracks.every((t) => t.done),
  };
}

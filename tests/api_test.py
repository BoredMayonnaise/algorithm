"""Integration checks. Use a disposable server/database, never the user's database."""
import json
import os
import subprocess
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

URL = os.environ.get('ALGO_URL', 'http://localhost:18080')


def api(path, data=None):
    request = Request(URL + path, data=None if data is None else json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
    with urlopen(request) as response:
        return json.load(response)


for size in [(5,5),(6,6),(19,33),(20,20),(60,60)]:
    request = dict(rows=size[0], cols=size[1], type='backtracker', seed=2405, trace=True)
    first = api('/api/generate', request)
    second = api('/api/generate', request)
    assert first == second, 'Fixed seed changed generation'
    rebuilt = [[1]*size[1] for _ in range(size[0])]
    for event in first['events']:
        rebuilt[event['r']][event['c']] = event['wall']
    assert rebuilt == [[c['wall'] for c in row] for row in first['grid']]
    assert api('/api/run', dict(first, algorithm='BFS'))['found'], f'Backtracker disconnected endpoints at {size}'
print('PASS: real generator trace recreates final maze, seed determinism, odd/even backtracker reachability through 60×60')

for seed in [1,42,2026]:
    request=dict(rows=15,cols=25,type='teaching',seed=seed,trace=True)
    teaching=api('/api/generate',request)
    assert teaching==api('/api/generate',request)
    assert any(cell['cost']>1 for row in teaching['grid'] for cell in row if not cell['wall']), 'Teaching mazes need visible positive weights'
    replay=[[{'wall':1,'cost':1} for _ in range(25)] for _ in range(15)]
    for e in teaching['events']:
        replay[e['r']][e['c']]['wall']=e['wall']
        if 'cost' in e: replay[e['r']][e['c']]['cost']=e['cost']
    assert replay==teaching['grid'], 'Generation events must reconstruct walls and weights'
    vertices=sum(not c['wall'] for row in replay for c in row)
    edges=sum(not replay[r][c]['wall'] and not replay[nr][nc]['wall'] for r in range(15) for c in range(25) for nr,nc in [(r+1,c),(r,c+1)] if nr<15 and nc<25)
    assert edges>=vertices, 'Teaching mazes need alternate routes, not only one tree path'
    results=api('/api/compare',teaching)
    assert all(r['found'] for r in results)
    assert abs(results[2]['totalCost']-results[3]['totalCost'])<1e-9
    snapshot={key:teaching[key] for key in ['rows','cols','grid','start','goal']}
    traced=[api('/api/run',dict(snapshot,algorithm=name,trace=True)) for name in ['BFS','A*']]
    assert traced[0]['totalCost']==results[1]['totalCost']
    assert traced[1]['totalCost']==results[3]['totalCost']
    code="const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const c=vm.createContext({});vm.runInContext(fs.readFileSync('public/playback.js','utf8'),c);const d=JSON.parse(fs.readFileSync(0,'utf8'));const p=c.createSearchPair(d.maze,d.results);while(!c.pairProgress(p).done)c.advanceSearchPair(p);assert.ok(p.tracks.every(t=>t.done&&t.explored===t.result.exploredNodes));assert.equal(c.pairProgress(p).current,c.pairProgress(p).total);c.resetSearchPair(p);assert.equal(c.pairProgress(p).current,0);"
    subprocess.run(['node','-e',code],cwd=Path(__file__).resolve().parents[1],input=json.dumps({'maze':snapshot,'results':traced}),text=True,check=True)
    greedy=api('/api/run',dict(snapshot,algorithm='Greedy Best-First',trace=True))
    assert greedy['found'] and greedy['algorithm']=='Greedy Best-First'
    assert type(greedy['execTimeUs']) is int and greedy['execTimeUs']>=0
    subprocess.run(['node','-e',code],cwd=Path(__file__).resolve().parents[1],input=json.dumps({'maze':snapshot,'results':[traced[0],greedy]}),text=True,check=True)
print('PASS: seeded teaching mazes are solvable, weighted, cyclic and fully reconstructable from real events')

maze = dict(rows=2, cols=3, grid=[[{'wall':0,'cost':1},{'wall':0,'cost':20},{'wall':0,'cost':1}],[0,0,0]], start=[0,0],goal=[0,2])
compared = api('/api/compare', dict(maze, algorithms=['DFS','BFS','Dijkstra','A*']))
for item in compared:
    single = api('/api/run', dict(maze, algorithm=item['algorithm'], trace=True))
    for field in ['path','explored','totalCost','pathLength','peakFrontier']:
        assert item[field] == single[field]
    assert single['totalCost'] == (21 if item['algorithm'] in ['DFS','BFS'] else 4)
print('PASS: comparison and traced runs agree on identical weighted inputs')
greedy=api('/api/run',dict(maze,algorithm='Greedy Best-First',trace=True))
assert greedy['found'] and greedy['pathLength']==2 and greedy['totalCost']==21
assert len(api('/api/compare',maze))==4, 'Optional algorithm must not change default comparisons'
assert [r['algorithm'] for r in api('/api/compare',dict(maze,algorithms=['BFS','Greedy Best-First']))]==['BFS','Greedy Best-First']
print('PASS: optional Greedy solver uses valid traces and heuristic-only routing; core defaults retained')

maze['marker'] = '🤖'
saved = api('/api/mazes', dict(maze,name='Marker persistence regression'))
loaded = api(f'/api/mazes/{saved["id"]}')['data']
assert loaded.get('marker') == '🤖', 'Supported start marker was lost on save/load'
print('PASS: persistence retains the selected marker')


def rejected(path, data):
    try:
        api(path, data)
    except HTTPError as error:
        assert error.code == 400, f'{path}: expected 400, got {error.code}'
        assert error.headers.get_content_type() == 'application/json'
        assert json.load(error).get('error'), 'Missing actionable JSON error'
    else:
        raise AssertionError(f'{path}: invalid input was accepted')


bad_inputs = [dict(maze, rows=2.5), dict(maze, rows='2'), dict(maze, cols=True),
              dict(maze, start=[0]), dict(maze, goal=[0.5,2]),
              dict(maze, grid=[[0,2,0],[0,0,0]]),
              dict(maze, grid=[[0,{'wall':0,'cost':'5'},0],[0,0,0]]),
              dict(maze, costs=[[1,1,1]]),
              dict(maze, costs=[[1,True,1],[1,1,1]]),
              dict(maze, start=[18446744073709551615,0]),
              dict(maze, grid=[[0,{'wall':True,'cost':1},0],[0,0,0]])]
for path in ['/api/run','/api/compare','/api/mazes']:
    for invalid in bad_inputs:
        rejected(path, invalid)
for fields in [dict(algorithm='unknown'), dict(algorithm=None), dict(trace='yes')]:
    rejected('/api/run', dict(maze, **fields))
for choices in [[], ['BFS','unknown'], ['A*','astar'], ['DFS']*5, 'BFS', [9]]:
    rejected('/api/compare', dict(maze, algorithms=choices))
for alias, canonical in [('DFS','DFS'),('AStar','A*'),('astar','A*'),("Dijkstra's",'Dijkstra')]:
    assert api('/api/run',dict(maze,algorithm=alias))['algorithm'] == canonical
print('PASS: malformed solver inputs and algorithm selections return JSON 400; supported aliases retained')

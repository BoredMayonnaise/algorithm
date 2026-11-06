"""Run against a disposable Algo server: ALGO_URL=http://localhost:18080 python3 tests/browser_test.py."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('ALGO_URL', 'http://localhost:18080')
ARTIFACTS = Path('/tmp/opencode/algo-screenshots')
ARTIFACTS.mkdir(exist_ok=True)


def upload(page, data):
    page.locator('#library').evaluate('(e) => e.open = true')
    page.locator('#importFile').set_input_files({
        'name': 'fixture.json', 'mimeType': 'application/json',
        'buffer': json.dumps(data).encode(),
    })


def fixture(rows=5, cols=7):
    return dict(rows=rows, cols=cols, grid=[[0]*cols for _ in range(rows)], start=[0, 0], goal=[rows-1, cols-1])


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1050})
    page.set_default_timeout(10000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_load_state('networkidle')

    # Catches the old absent frontier rendering, not merely a renamed control.
    page.locator('#runBtn').click()
    expect(page.locator('.cell.frontier').first).to_be_visible()
    print('PASS: real frontier is visible during playback')
    page.locator('#runBtn').click()
    expect(page.locator('#status')).to_have_text('Paused')
    index = page.evaluate('pairProgress(playback.record.pair).current')
    page.wait_for_timeout(180)
    assert page.evaluate('pairProgress(playback.record.pair).current') == index
    page.locator('#stepBtn').click()
    assert page.evaluate('pairProgress(playback.record.pair).current') != index
    expect(page.locator('#status')).to_have_text('Paused')
    page.locator('#runBtn').click()
    expect(page.locator('#status')).to_have_text('Path Found', timeout=15000)
    assert int(page.locator('#movesValue').inner_text()) > 0
    page.locator('#replayBtn').click()
    expect(page.locator('#status')).to_have_text('Searching')
    page.locator('#resetBtn').click()
    expect(page.locator('#status')).to_have_text('Ready')
    expect(page.locator('.cell.explored')).to_have_count(0)
    print('PASS: shared pause, resume, step, fixed playback, replay and clear search')

    upload(page, fixture())
    expect(page.locator('#gridWrap .cell')).to_have_count(35)
    expect(page.locator('#gridWrapRight .cell')).to_have_count(35)
    for tool, cell, cls in [('wall', (1,1), 'wall'), ('erase',(1,1),'open'), ('start',(1,0),'start'), ('goal',(3,6),'goal')]:
        page.locator(f'[data-tool="{tool}"]').click()
        target = page.locator(f'#gridWrap .cell[data-r="{cell[0]}"][data-c="{cell[1]}"]')
        target.click()
        if cls == 'open': assert 'wall' not in target.get_attribute('class')
        else: expect(target).to_have_class(__import__('re').compile(cls))
    weighted=page.evaluate('buildPayload()')
    weighted['grid'][2][2]['cost']=5
    upload(page,weighted)
    expect(page.locator('#gridWrap .cell[data-r="2"][data-c="2"]')).to_have_text('5')
    expect(page.locator('#gridWrapRight .cell[data-r="2"][data-c="2"]')).to_have_text('5')
    print('PASS: drawing, erasing, endpoints and weights')

    for algo in ['DFS','BFS','Dijkstra','A*','Greedy Best-First']:
        page.locator('#algoRight').select_option('BFS' if algo=='A*' else 'A*')
        page.locator('#algo').select_option(algo)
        page.locator('#runBtn').click()
        expect(page.locator('#status')).to_have_text('Path Found', timeout=15000)
        assert int(page.locator('#peakValue').inner_text()) > 0
        expect(page.locator('#coverageValue')).to_contain_text('%')
        expect(page.locator('#averageCostValue')).not_to_have_text('—')
    print('PASS: each solver in the paired lab')

    before = page.evaluate('buildPayload()')
    page.locator('#mazeName').fill('Browser regression maze')
    page.locator('#saveBtn').click()
    expect(page.locator('#notice')).to_contain_text('Saved')
    page.locator('#clearBtn').click()
    page.locator('#loadBtn').click()
    expect(page.locator('#notice')).to_contain_text('Loaded')
    assert page.evaluate('buildPayload()') == before
    with page.expect_download() as download:
        page.locator('#exportBtn').click()
    exported = json.loads(Path(download.value.path()).read_text())
    assert exported == before
    invalid = fixture(); invalid['goal'] = [500,0]
    upload(page, invalid)
    expect(page.locator('#notice')).to_contain_text('Import failed')
    assert page.evaluate('buildPayload()') == before
    upload(page, exported)
    assert page.evaluate('buildPayload()') == before
    print('PASS: save/load, export/import, rejected import preserves workspace')

    blocked = fixture()
    blocked['grid'][0][1] = blocked['grid'][1][0] = 1
    upload(page, blocked)
    page.locator('#runBtn').click()
    expect(page.locator('#status')).to_have_text('No Path')
    expect(page.locator('#movesValue')).to_have_text('—')
    page.locator('#demoBtn').click()
    expect(page.locator('#status')).to_have_text('Searching')
    page.locator('#restoreBtn').click()
    assert page.evaluate('buildPayload()')['grid'][0][1]['wall'] == 1
    print('PASS: no path and reversible demo')

    page.locator('#genMazeBtn').click()
    expect(page.locator('#status')).to_have_text('Generating')
    expect(page.locator('#status')).to_have_text('Ready', timeout=15000)
    page.locator('#runBtn').click()
    page.locator('#genMazeBtn').click()
    expect(page.locator('#status')).to_have_text('Ready', timeout=15000)
    expect(page.locator('.cell.explored')).to_have_count(0)
    page.wait_for_timeout(100)
    expect(page.locator('#status')).to_have_text('Ready')
    print('PASS: generation and regeneration cancels search')

    before = page.evaluate('buildPayload()')
    upload(page,fixture(61,1))
    expect(page.locator('#notice')).to_contain_text('1–60')
    assert page.evaluate('buildPayload()') == before
    page.locator('#presentationBtn').click()
    expect(page.locator('#inspector')).not_to_be_visible()
    page.keyboard.press('Escape')
    expect(page.locator('#inspector')).to_be_visible()
    print('PASS: dimensions validation and presentation exit')

    page.locator('#demoBtn').click()
    page.locator('#runBtn').click()
    page.screenshot(path=str(ARTIFACTS/'desktop.png'), full_page=True)
    for w,h in [(360,800),(390,844),(768,1024),(844,390)]:
        page.set_viewport_size({'width':w,'height':h})
        page.locator('#fitBtn').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(ARTIFACTS/f'{w}x{h}.png'), full_page=True)
    assert not errors, errors
    print('PASS: desktop, phone, tablet, landscape screenshots; no page errors or page overflow')
    browser.close()

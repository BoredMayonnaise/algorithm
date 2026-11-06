"""Race, keyboard, large-grid, and emulated-touch regression checks."""
import json
import os
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('ALGO_URL', 'http://localhost:18080')


def upload(page, rows, cols, start=None, goal=None):
    page.locator('#library').evaluate('(e)=>e.open=true')
    data = dict(rows=rows, cols=cols, grid=[[0]*cols for _ in range(rows)], start=start or [0,0], goal=goal or [rows-1,cols-1])
    page.locator('#importFile').set_input_files({'name':'edge.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
    expect(page.locator('#gridWrap .cell')).to_have_count(rows*cols)
    expect(page.locator('#gridWrapRight .cell')).to_have_count(rows*cols)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1440,'height':900}, reduced_motion='reduce')
    errors, external = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: external.append(request.url) if not request.url.startswith(URL) else None)
    page.goto(URL); page.wait_for_load_state('networkidle')
    expect(page.locator('#status')).to_have_text('Ready')
    expect(page.locator('.cell.explored')).to_have_count(0)
    upload(page,5,7)
    page.locator('#gridWrap').focus()
    page.keyboard.press('ArrowDown'); page.keyboard.press('ArrowRight'); page.keyboard.press('Enter')
    expect(page.locator('#gridWrap .cell[data-r="1"][data-c="1"]')).to_have_class('cell wall keyboard')
    page.keyboard.press('2'); page.keyboard.press('Enter')
    assert 'wall' not in page.locator('#gridWrap .cell[data-r="1"][data-c="1"]').get_attribute('class')
    page.keyboard.press('p'); expect(page.locator('#inspector')).not_to_be_visible()
    page.keyboard.press('Escape'); expect(page.locator('#inspector')).to_be_visible()
    print('PASS: keyboard drawing, tool shortcuts, presentation from grid focus, reduced-motion readiness')

    # Ending a stroke is mandatory before keyboard-triggered computation snapshots it.
    page.locator('[data-tool="wall"]').click()
    a=page.locator('#gridWrap .cell[data-r="2"][data-c="1"]').bounding_box()
    z=page.locator('#gridWrap .cell[data-r="2"][data-c="4"]').bounding_box()
    stroke_requests=[]
    page.route('**/api/run',lambda route:stroke_requests.append(route))
    page.mouse.move(a['x']+a['width']/2,a['y']+a['height']/2); page.mouse.down()
    page.keyboard.press('n')
    expect(page.locator('#runBtn')).to_be_disabled()
    page.mouse.move(z['x']+z['width']/2,z['y']+z['height']/2,steps=5); page.mouse.up()
    sent=stroke_requests[0].request.post_data_json
    actual=page.evaluate('buildPayload()')
    assert {key:sent[key] for key in actual} == actual, 'Stroke continued after the search input was snapshotted'
    assert len(stroke_requests)==2
    for route in stroke_requests:
        payload=route.request.post_data_json
        assert {key:payload[key] for key in actual}==actual
        route.fulfill(json=page.request.post(URL+'/api/run',data=payload).json())
    page.unroute('**/api/run')
    expect(page.locator('#status')).to_have_text('Paused')
    expect(page.locator('.cell.frontier').first).to_have_attribute('aria-label',__import__('re').compile('frontier'))
    page.locator('#stepBtn').click()
    expect(page.locator('.cell.explored').first).to_have_attribute('aria-label',__import__('re').compile('explored'))
    page.locator('#resetBtn').click()
    print('PASS: held strokes end before keyboard requests; frontier and explored states have accessible labels')

    # Hold a genuine solver response, cancel through the UI, then deliver it late.
    snapshot = page.evaluate('buildPayload()')
    response = page.request.post(URL+'/api/run',data=dict(snapshot,algorithm='A*',trace=True)).json()
    held = []
    page.route('**/api/run', lambda route: held.append(route))
    page.locator('#runBtn').click()
    expect(page.locator('#runBtn')).to_be_disabled()
    page.wait_for_function('document.querySelector("#status").textContent === "Searching"')
    page.locator('#resetBtn').click()
    assert held
    for route in held: route.fulfill(json=response)
    page.unroute('**/api/run')
    expect(page.locator('#status')).to_have_text('Ready')
    expect(page.locator('.cell.explored')).to_have_count(0)
    expect(page.locator('#computeValue')).to_have_text('—')
    expect(page.locator('#computeValueRight')).to_have_text('—')
    page.locator('#runBtn').click()
    expect(page.locator('#status')).to_have_text('Path Found')
    print('PASS: late cancelled search cannot resurrect playback; subsequent run succeeds')

    page.locator('#replayBtn').click()
    page.locator('#runBtn').click()
    initial_events = page.evaluate('pairProgress(playback.record.pair).total')
    page.locator('#replayBtn').click()
    expect(page.locator('#status')).to_have_text('Path Found')
    assert page.evaluate('pairProgress(playback.record.pair).total') == initial_events
    print('PASS: recorded replay retained')

    upload(page,1,1)
    page.locator('#runBtn').click(); expect(page.locator('#status')).to_have_text('Path Found')
    expect(page.locator('#movesValue')).to_have_text('0'); expect(page.locator('#costValue')).to_have_text('0')
    expect(page.locator('#gridWrap .cell')).to_have_text('S/G')
    expect(page.locator('#gridWrapRight .cell')).to_have_text('S/G')
    upload(page,60,60)
    page.locator('#algo').select_option('BFS'); page.locator('#runBtn').click()
    expect(page.locator('.cell.frontier').first).to_be_visible()
    page.locator('#resetBtn').click(); expect(page.locator('#status')).to_have_text('Ready')
    page.wait_for_timeout(100)
    expect(page.locator('.cell.explored')).to_have_count(0)
    assert not errors, errors
    assert not external, external
    print('PASS: one-cell maze, responsive 60×60 playback/reset, no external assets or script errors')
    page.close()

    context = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
    phone=context.new_page(); phone.goto(URL); phone.wait_for_load_state('networkidle')
    board=phone.locator('#gridWrap').bounding_box()
    assert board['height'] <= 230, 'Wide phone mazes should not sit in a tall empty viewport'
    expect(phone.locator('#gridWrapRight')).to_be_visible()
    print('PASS: phone overview avoids excess blank space and provides both algorithm boards')
    upload(phone,5,7)
    phone.locator('#gridWrap').scroll_into_view_if_needed()
    box=phone.locator('#gridWrap .cell[data-r="2"][data-c="2"]').bounding_box()
    phone.touchscreen.tap(box['x']+box['width']/2,box['y']+box['height']/2)
    assert phone.evaluate('buildPayload().grid[2][2].wall') == 1
    upload(phone,60,60)
    phone.locator('#zoomInBtn').click()
    phone.locator('#panBtn').click()
    phone.locator('#gridWrap').scroll_into_view_if_needed()
    before=phone.evaluate('buildPayload()')
    box=phone.locator('#gridWrap').bounding_box()
    x,y=box['x']+box['width']*.8,box['y']+120
    session=context.new_cdp_session(phone)
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-100,'y':y-50}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    assert phone.locator('#gridWrap').evaluate('(e)=>e.scrollLeft') > 50
    assert phone.evaluate('buildPayload()') == before
    phone.locator('#fitBtn').click()
    assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth')
    print('PASS: emulated touch painting, large-grid zoom/pan without edits, mobile fit without page overflow')
    context.close(); browser.close()

"""Build and verify against a temporary database. Browser checks are optional."""
import argparse
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--no-browser', action='store_true', help='Run native, API, and static UI checks without launching a browser.')
args = parser.parse_args()


def run(*command, env=None):
    subprocess.run(command, cwd=ROOT, env=env, check=True)


run('cmake', '-S', '.', '-B', 'build')
run('cmake', '--build', 'build', '-j2')
run('ctest', '--test-dir', 'build', '--output-on-failure')
run('node', '--check', 'public/app.js')
run('node', '--check', 'public/analysis.js')
run('node', '--check', 'public/playback.js')
run('node', 'tests/analysis_test.cjs')
run('node', 'tests/playback_test.cjs')
run('python3', 'tests/ui_structure_test.py')
with tempfile.TemporaryDirectory(prefix='algo-test-', dir='/tmp/opencode') as directory:
    runtime = Path(directory)
    (runtime/'public').symlink_to(ROOT/'public', target_is_directory=True)
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    env = dict(os.environ, PORT=str(port), ALGO_URL=f'http://localhost:{port}')
    with (runtime/'server.log').open('w+') as log:
        server = subprocess.Popen([str(ROOT/'build/algo')], cwd=runtime, env=env, stdout=log, stderr=log)
        try:
            deadline = time.monotonic()+15
            while True:
                try:
                    with urlopen(env['ALGO_URL']+'/api/health', timeout=1) as response:
                        assert response.status == 200
                    break
                except OSError:
                    if server.poll() is not None or time.monotonic()>deadline:
                        log.seek(0)
                        raise RuntimeError('Test server did not start: '+log.read()[-3000:])
                    time.sleep(.05)
            scripts = ['api_test.py']
            if not args.no_browser:
                scripts += ['browser_test.py','browser_edges.py']
            for script in scripts:
                run('python3', f'tests/{script}', env=env)
        finally:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
print(('Non-browser checks passed. Browser checks skipped.' if args.no_browser else 'All checks passed.') + ' The user database was not used.')

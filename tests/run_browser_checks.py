#!/usr/bin/env python3
"""Verify HitchFormSup in headless Chromium, without contacting WhatsApp or Teams."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--baseline', default='99da9f2c900d5b33b36d695917d1577957feead5')
p.add_argument('--chromium', default=shutil.which('chromium'))
a = p.parse_args()
if not a.chromium:
    p.error('Chromium unavailable')


def source(name, baseline):
    if baseline:
        return subprocess.check_output(['git', 'show', f'{a.baseline}:{name}'], cwd=ROOT).decode('utf-8')
    return (ROOT / name).read_text(encoding='utf-8')


def run(*, baseline=False, expected=None, restore=None, width=1440):
    page = source('index.html', baseline)
    bootstrap = '''
window.__errors = [];
window.addEventListener('error', e => window.__errors.push(e.message));
window.addEventListener('unhandledrejection', e => window.__errors.push(String(e.reason)));
localStorage.clear();
'''
    bootstrap += f'window.__baseline = {json.dumps(expected)};\nwindow.__restore = {json.dumps(restore)};\n'
    if restore:
        bootstrap += "localStorage.setItem('opsforms_passagem_servico_supervisao_v1', window.__restore.state);\n"
    page = page.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'">', 1)
    page = page.replace('<link rel="stylesheet" href="style.css" />', '<style>' + source('style.css', baseline) + '</style>')
    page = page.replace('<script src="script.js"></script>', '<script>' + bootstrap + '</script><script>' + source('script.js', baseline) + '</script>')
    body, closing, rest = page.rpartition('</body>')
    page = body + '<script>' + (ROOT / 'tests/browser.js').read_text(encoding='utf-8') + '</script>' + closing + rest
    with tempfile.TemporaryDirectory(prefix='hitch-browser-') as tmp:
        path = Path(tmp) / 'test.html'
        path.write_text(page, encoding='utf-8')
        proc = subprocess.run([a.chromium, '--headless', '--no-sandbox', '--disable-gpu',
                               '--disable-dev-shm-usage', '--no-first-run', '--disable-background-networking',
                               '--host-resolver-rules=MAP * ~NOTFOUND', '--user-data-dir=' + tmp + '/profile',
                               f'--window-size={width},900', '--virtual-time-budget=10000', '--dump-dom', path.as_uri()],
                              capture_output=True, text=True, timeout=45)
        match = re.search(r'<script id="test-result" type="application/json">(.*?)</script>', proc.stdout, re.S)
        if not match:
            raise RuntimeError('Browser checks did not complete: ' + proc.stderr[-2000:])
        result = json.loads(match[1])
        if not result['ok']:
            raise AssertionError(result['error'])
        return result


baseline = run(baseline=True)
desktop = run(expected=baseline['outputs'])
mobile = run(expected=baseline['outputs'], width=390)
reopened = run(restore=desktop['saved'])
legacy_output = desktop['outputs']['legacy'].encode('utf-8')
assert legacy_output == baseline['outputs']['legacy'].encode('utf-8')
print(json.dumps({'checks_passed': sum(len(r['checks']) for r in (desktop, mobile, reopened)),
                  'legacy_output_sha256': hashlib.sha256(legacy_output).hexdigest(),
                  'limits': 'Synthetic Chromium desktop/mobile and simulated clipboard. No external navigation or delivery.'}, indent=2))

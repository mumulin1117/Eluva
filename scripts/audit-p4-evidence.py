"""Audit saved P4 UI evidence and all four packaged Web resource copies.

Requires Pillow. Run from the repository root after Web and both iOS builds.
This audits browser artifacts; it does not drive or certify a real iPhone.
"""
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'docs/evidence/p4'
VIEWPORTS = {(320, 568), (375, 667), (375, 812), (390, 844), (393, 852), (430, 932)}
STATES = set(['comment-translation-unavailable', 'post-translation-unavailable', 'text-translation-unavailable', 'video-blocked-ended', 'video-ended', 'video-incoming-banner', 'video-incoming-ready', 'video-nonfriend-denied', 'video-ready', 'video-recorded-active', 'video-recorded-paused', 'video-unsupported', 'voice-draft-ready', 'voice-import-invalid', 'voice-native-unsupported', 'voice-playback-paused', 'voice-send-error', 'voice-transcription-unavailable'])
ERRORS = {'text-translation-unavailable': 'LANGUAGE_UNAVAILABLE', 'voice-transcription-unavailable': 'LANGUAGE_UNAVAILABLE', 'voice-import-invalid': 'MEDIA_UNSUPPORTED', 'voice-send-error': 'STORAGE_FAILED', 'post-translation-unavailable': 'LANGUAGE_UNAVAILABLE', 'comment-translation-unavailable': 'LANGUAGE_UNAVAILABLE', 'video-unsupported': 'DEVICE_UNSUPPORTED', 'video-nonfriend-denied': 'FRIENDSHIP_REQUIRED'}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

rows = json.loads((EVIDENCE / 'browser-matrix.json').read_text())
assert len(rows) == len(STATES) * 12
keys = {(r['state'], r['lang'], r['width'], r['height']) for r in rows}
expected = {(s, lang, w, h) for s in STATES for lang in ('en', 'fr') for w, h in VIEWPORTS}
assert keys == expected, f'missing={expected - keys}; extra={keys - expected}'
screenshots = []
for row in rows:
    path = EVIDENCE / 'screenshots' / row['file']
    with Image.open(path) as img:
        assert img.size == (row['width'], row['height']), path.name
        variation = max(ImageStat.Stat(img.convert('RGB')).stddev)
        assert variation >= 3, f'blank screenshot: {path.name}'
    assert row['bodyWidth'] <= row['width'] + 1, path.name
    assert row['font'] == 'loaded', path.name
    if row['main']:
        assert row['main']['scrollWidth'] <= row['main']['width'] + 1, path.name
    for part in ('dialog', 'footer', 'incoming', 'tabs'):
        bounds = row.get(part)
        if bounds:
            assert bounds['left'] >= -1 and bounds['right'] <= row['width'] + 1, (path.name, part)
            assert bounds['top'] >= -1 and bounds['bottom'] <= row['height'] + 1, (path.name, part)
    primary = row['state'] == 'video-incoming-banner'
    assert bool(row['tabs']) == primary, f'TabBar mismatch: {path.name}'
    errors = set(row['errors'])
    assert errors == ({ERRORS[row['state']]} if row['state'] in ERRORS else set()), (path.name, errors)
    if row['state'] == 'video-recorded-paused':
        assert row['video'] and row['video']['paused'], path.name
    if row['state'] == 'video-recorded-active':
        assert row['video'] and not row['video']['paused'] and row['video']['ready'] >= 2, path.name
    if row['state'] in ('video-ended', 'video-blocked-ended'):
        assert not row['video'], path.name
    screenshots.append({'file': 'screenshots/' + path.name, 'sha256': sha(path),
                        'width': row['width'], 'height': row['height'], 'pixelStddevMax': round(variation, 3)})

manifest = json.loads((EVIDENCE / 'build-manifest.json').read_text())
iterations = json.loads((EVIDENCE / 'build-iterations.json').read_text())
known_scripts = {'./' + f['file'] for i in iterations for f in i['files'] if f['file'].startswith('assets/index-') and f['file'].endswith('.js')}
for row in rows:
    assert row['applicationScript'] in known_scripts, row['file']

expected_files = {r['file'] for r in manifest['files']}
bundles = ['dist', 'ios/Eluva/Web', '.build/ios/Build/Products/Debug-iphonesimulator/Eluva.app/Web',
           '.build/device/Build/Products/Debug-iphoneos/Eluva.app/Web']
for prefix in bundles:
    base = ROOT / prefix
    found = {str(p.relative_to(base)) for p in base.rglob('*') if p.is_file() and p.name != '.generated-files.json'}
    assert found == expected_files, (prefix, found - expected_files, expected_files - found)
    for resource in manifest['files']:
        assert sha(base / resource['file']) == resource['sha256'], (prefix, resource['file'])

result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'passed': True,
          'scope': 'Saved browser screenshots across recorded phase iterations; final build artifacts. No device UI certification',
          'stateCount': len(STATES), 'screenshotCount': len(rows), 'languages': ['en', 'fr'],
          'viewports': sorted(VIEWPORTS), 'stateCounts': dict(Counter(r['state'] for r in rows)),
          'resourceCount': len(expected_files), 'verifiedBundles': bundles, 'screenshots': screenshots}
(EVIDENCE / 'evidence-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'P4 evidence audit passed: {len(rows)} screenshots, {len(STATES)} states, {len(expected_files)} resources × 4 bundles.')

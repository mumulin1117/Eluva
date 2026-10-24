#!/usr/bin/env python3
"""Validate saved P6 evidence and generated packages; never modify account data."""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'docs/evidence/p6'
read = lambda name: json.loads((EVIDENCE / name).read_text())
manifest = read('build-manifest.json')['files']
expected = {x['file']: x['sha256'] for x in manifest}
bundles = ['dist', 'ios/Eluva/Web', '.build/ios/Build/Products/Debug-iphonesimulator/Eluva.app/Web', '.build/device/Build/Products/Debug-iphoneos/Eluva.app/Web']
for folder in bundles:
    base = ROOT / folder
    actual = {str(p.relative_to(base)): sha256(p.read_bytes()).hexdigest() for p in base.rglob('*') if p.is_file() and p.name != '.generated-files.json'}
    assert actual == expected, f'Resource set/hash mismatch: {folder}'
assert not any(path.endswith('.storekit') for path in expected), 'QA config must stay out of production Web'
policy = json.loads((ROOT / 'dist/config/commerce-policy.json').read_text())
assert policy['confirmed'] is False and policy['products'] == [], 'Unapproved commercial configuration enabled'
for path in expected:
    if Path(path).suffix in ['.html', '.css', '.js', '.svg']:
        text = (ROOT / 'dist' / path).read_text()
        assert not any(x in text for x in ['lanhuapp.com', 'lanhu-oss-', 'alipic.lanhu', '/Users/', 'localhost:5173', '127.0.0.1:5173']), path
matrix = read('browser-matrix.json')
capture_build = {x['file']:x['sha256'] for x in read('capture-build-manifest.json')['files']}
states = ['store-native-only', 'store-restore-unavailable', 'store-recovery', 'store-terms-draft', 'store-benefits-unconfirmed', 'store-wallet-empty', 'compose-return-draft', 'store-wallet-after-private', 'compose-publish-failure', 'store-wallet-after-failure', 'store-wallet-usage']
sizes = [(320,568),(375,667),(375,812),(390,844),(393,852),(430,932)]
assert len(matrix) == len(states)*2*len(sizes)
assert len({x['file'] for x in matrix}) == len(matrix)
for state in states:
    for lang in ['en', 'fr']:
        rows = [x for x in matrix if x['state'] == state and x['locale'] == lang]
        assert sorted((x['width'],x['height']) for x in rows) == sorted(sizes), (state,lang)
for row in matrix:
    with Image.open(EVIDENCE / row['file']) as image:
        assert image.size == (row['width'],row['height']), row['file']
    dom = row['dom']
    assert dom['viewport'] == [row['width'],row['height']] and dom['lang'] == row['locale'], row['file']
    assert dom['bodyWidth'] <= row['width'] and dom['mainWidth'] <= dom['mainClientWidth']+1, row['file']
    assert not dom['missingImages'] and not dom['untranslated'] and not dom['tabBar'], row['file']
    assert 'Main navigation' not in row['ax'] and 'Navigation principale' not in row['ax'], row['file']
    for script in dom['script']:
        path=script.removeprefix('./')
        if path not in expected:
            # Vite's chunk filename changed with its CSS dependency. Reproduction
            # proves the captured JS bytes match the final JS, rather than silently
            # labelling historical CSS captures as the same final bundle.
            assert path in capture_build and capture_build[path] in expected.values(), (row['file'],script)
            assert sha256((EVIDENCE/'capture-build'/Path(path).name).read_bytes()).hexdigest()==capture_build[path]
summary = read('verification-summary.json')
for log, marker in [('logs/web-tests.log','pass 63'),('logs/native-tests.log','Executed 42 tests, with 0 failures'),('logs/web-build.log','Synchronized'),('logs/simulator-build.log','** BUILD SUCCEEDED **'),('logs/unsigned-device-build.log','** BUILD SUCCEEDED **')]:
    assert marker in (EVIDENCE/log).read_text(), log
assert summary['nativeTests']['includesRealXcodeStoreKitTest']
assert not summary['storeKitTest']['appleSandbox'] and not summary['storeKitTest']['realCharge']
sources = read('design-sources.json')
assert all(x['returnedDesignId'] == x['id'] and x['version'] == '版本1' for x in sources['primary'] + sources['directDependencies'])
result = {'result':'PASS','screenshots':len(matrix),'states':len(states),'resources':len(expected),'bundles':bundles,'webTests':63,'nativeTests':42,'commercialConfiguration':'disabled; confirmation pending','nativeUI':'not executed','appleSandbox':'not executed','physicalDevice':'not executed','formalVisualSignoff':False}
(EVIDENCE/'evidence-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f"P6 evidence passed: {len(matrix)} screenshots, {len(expected)} resources x {len(bundles)} bundles; commercial freeze and device acceptance remain pending.")

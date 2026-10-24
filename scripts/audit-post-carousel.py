"""Check saved observations and local packages, without driving UI or editing images."""
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
EV = ROOT / 'docs/evidence/post-carousel-2026-10-19'
def read(file): return json.loads((EV / file).read_text())
def save(file, value): (EV / file).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def pixels(path):
    b = path.read_bytes()
    if b[:8] == b'\x89PNG\r\n\x1a\n': return list(struct.unpack('>II', b[16:24]))
    assert b[:2] == b'\xff\xd8', path
    i = 2
    while i < len(b):
        assert b[i] == 255, path
        if b[i+1] in [192, 193, 194]: return [int.from_bytes(b[i+7:i+9], 'big'), int.from_bytes(b[i+5:i+7], 'big')]
        i += 2 + int.from_bytes(b[i+2:i+4], 'big')
    raise AssertionError(path)

manifest = {r['file']: r['sha256'] for r in read('build-manifest.json')['files']}
folders = {'dist': 'dist', 'ios-source': 'ios/Eluva/Web', 'simulator-app': '.build/ios/Build/Products/Debug-iphonesimulator/Eluva.app/Web', 'device-app-unsigned': '.build/device/Build/Products/Debug-iphoneos/Eluva.app/Web'}
sets = {name: {str(p.relative_to(ROOT/folder)): sha(p) for p in (ROOT/folder).rglob('*') if p.is_file() and p.name != '.generated-files.json'} for name, folder in folders.items()}
assert len(manifest) == 213
for name, files in sets.items(): assert files == manifest, name
save('resource-hashes.json', {'identical': True, 'filesPerSet': 213, 'sets': sets})
matrix = read('browser-matrix.json')
sizes = {(320,568), (375,667), (375,812), (390,844), (393,852), (430,932)}
assert len(matrix) == 36
for state in {r['state'] for r in matrix}:
    assert {(r['locale'], tuple(r['viewport'])) for r in matrix if r['state'] == state} == {(l,s) for l in ['en','fr'] for s in sizes}
for r in matrix:
    d = r['dom']
    assert pixels(EV/r['file']) == r['viewport'], r['file']
    assert [d['width'], d['height']] == r['viewport'] and d['documentWidth'] <= d['width']
    assert d['locale'] == r['locale'] and not d['errorCodes'] and all(i['loaded'] for i in d['images'])
    assert d['tabBar'] == r['state'].startswith('home')
    for src in d['script']: assert src.removeprefix('./') in manifest
    if r['state'].startswith('home'):
        photos = [i for i in d['images'] if '/post-' in i['src']]
        assert len(photos) == 10 and all(i['fit'] == 'cover' and i['position'] == '50% 50%' for i in photos)
    else: assert d['index'] == ('1' if 'two-photo' in r['state'] else '2')
assert not read('logs/browser-final.json')
web = (EV/'logs/web-tests.log').read_text()
native = (EV/'logs/native-web-tests.log').read_text()
assert 'pass 74' in web and 'fail 0' in web
assert '** TEST SUCCEEDED **' in native and 'Executed 2 tests, with 0 failures' in native
for file in ['simulator-build.log', 'device-build.log']: assert '** BUILD SUCCEEDED **' in (EV/'logs'/file).read_text()
save('verification-summary.json', {
    'scope': 'Other-profile post image carousel and Home ScaleAspectFill', 'webTests': {'passed':74,'failed':0},
    'nativeBundledWebTests': {'passed':2,'failed':0,'device':'iPhone SE (3rd generation) / iOS 17.5 Simulator','resultBundle':'.build/post-carousel-20261019-web-final.xcresult','observations':12,'coverage':'Existing offscreen welcome/EULA bootstrap, resources and layout; not native carousel touch or system keyboard'},
    'browser': {'matrixScreenshots':36,'locales':['en','fr'],'viewports':[list(s) for s in sorted(sizes)],'states':sorted({r['state'] for r in matrix}),'homeImagesCover':10,'overflow':False,'missingImages':False,'consoleErrorsAfterTimerFix':0,'consoleWindowStartsAt':'2026-10-19T04:10:49.088Z','observedInteractions':['automatic advance','pause retained','manual two/three image selection','mouse-driven horizontal swipe without navigation','keyboard arrows','language modal pauses advance','locale keeps selected image','opens current image viewer','back navigation']},
    'builds': {'vite':'passed','sync':'passed','simulator':'passed','deviceUnsigned':'passed','resourceSetsEqual':True,'sets':4,'filesPerSet':213},
    'dataChanges':False,'nativeBridgeChanges':False,'defaults':{'carouselIntervalMs':4000,'note':'Adjustable presentation default, not a newly confirmed business threshold'},
    'resolvedAttempts': [{'issue':'Browser timer Illegal invocation','evidence':'logs/browser-before-timer-fix.json','resolution':'Wrap browser timers as plain calls; actual automatic advance observed afterwards.'},{'issue':'First offscreen WKWebView 320x568 sample measured previous CSS visual height','evidence':'logs/native-web-tests-first.log','resolution':'Await CSS visual-height and viewport updates; retain assertions; final two tests passed.'}],
    'limitations':['No physical-device interaction or native carousel touch verification this round.','No system keyboard change or retest.','System background/reduced-motion and pointer cancellation were not exercised on hardware.','Native teardown contains WebKit RBS/ProcessSuspension messages.','Previous P7 acceptance gaps remain unchanged.']
})
purposes = {
    'src/components/PostImageCarousel.vue':'One-image presentation, pagination, pause, swipe, recovery and lifecycle cleanup.',
    'src/services/image-carousel.js':'One cancellable clock and independent suspension gates; ignore stale callbacks.',
    'src/components/PostCard.vue':'Reuse carousel only where enabled and forward current-image events.',
    'src/views/ProfileView.vue':'Enable only on other profiles; open current-index existing media viewer.',
    'src/content.css':'Home aspect-fill and responsive carousel/control styles.',
    'src/data/content-messages.js':'English/French image opening and pause/resume labels.',
    'tests/image-carousel.test.js':'Timing, independent gates, stable identity refresh and disposal tests.',
    'ios/EluvaTests/WebBundleTests.swift':'Await actual viewport CSS update before existing layout assertions.',
    'scripts/audit-post-carousel.py':'Recheck captured evidence and four built packages, without UI or image mutations.',
    'README.md':'Link current UI report.',
    'docs/app-flow-and-implementation-plan.md':'Record user-confirmed presentation; distinguish adjustable interval.',
    'docs/post-carousel-report.md':'Implementation, validation, resolved attempts and pending device checks.'
}
baseline = read('baseline.json')
save('source-files.json', {'files':[{'file':f,'purpose':p,'beforeSha256':baseline.get(f),'afterSha256':sha(ROOT/f)} for f,p in purposes.items()], 'generatedWeb':{'root':'ios/Eluva/Web','files':213,'hashManifest':'resource-hashes.json'},'evidence':'docs/evidence/post-carousel-2026-10-19/'})
print(json.dumps({'matrix':36,'webTests':74,'nativeBundledWebTests':2,'filesPerSet':213,'identicalSets':4}))

"""Audit saved fixture evidence and built resources; this does not drive UI."""
import hashlib
import json
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'docs/evidence/demo-data-2026-10-19'


def read(name):
    return json.loads((EVIDENCE / name).read_text())


def save(name, value):
    (EVIDENCE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pixels(path):
    data = path.read_bytes()
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return list(struct.unpack('>II', data[16:24]))
    assert data[:2] == b'\xff\xd8', path
    i = 2
    while i < len(data):
        assert data[i] == 255, (path, i)
        marker = data[i + 1]
        size = int.from_bytes(data[i + 2:i + 4], 'big')
        if marker in (192, 193, 194):
            return [int.from_bytes(data[i + 7:i + 9], 'big'), int.from_bytes(data[i + 5:i + 7], 'big')]
        i += size + 2
    raise AssertionError(path)


assets = read('assets.json')
assert len(assets) == 39
assert sum(a['role'] == 'avatar' for a in assets) == 20
assert sum(a['role'] == 'post' for a in assets) == 19
for item in assets:
    path = ROOT / item['file']
    assert sha(path) == item['sha256'], path
    assert pixels(path) == [item['width'], item['height']], path
    source = Path('/Users/linqian/Downloads') / item['source']
    if source.exists():
        assert sha(source) == item['sha256'], source

people = json.loads((ROOT / 'public/config/social-demo.json').read_text())
posts = json.loads((ROOT / 'public/config/content-demo.json').read_text())
config = json.loads((ROOT / 'public/config/demo-fixtures.json').read_text())
assert len(people) == 20 and len(posts) == 10 and config['version'] == 2
assert len(set(p['id'] for p in people)) == 20
assert sorted(p['fixtureNumber'] for p in posts) == list(range(1, 11))
assert len(set(p['authorId'] for p in posts)) == 10
assert sum(len(p['media']) for p in posts) == 19
assert all('demoKey' not in p and p['demoScope'] == 'eluva-test-user-v1' for p in posts)
assert all(any(u['id'] == p['authorId'] for u in people) for p in posts)
assert len(config['conversations']) == 2

roles = {'demo-friend-echo': 'existing-friend-and-thread', 'demo-friend-notes': 'existing-friend-and-thread', 'demo-requester': 'received-request', 'demo-recipient': 'sent-request', 'demo-stranger': 'nonfriend', 'demo-blocked-user': 'safety-scenario-peer-not-automatically-blocked'}
catalog = {
    'fixtureVersion': config['version'], 'scope': 'eluva-test-user-v1',
    'sourceInterpretation': 'Female avatars 1–5 author female posts 1–5; male avatars 6–10 author male posts 6–10. Male first text labelled 1 follows supplied directory 6. Other ten avatars have no seeded posts.',
    'generatedFields': ['displayName', 'age', 'major', 'interestIds', 'about', 'aboutTranslations', 'contextual demo messages'],
    'notInferredFromImages': ['real identity', 'birthday', 'university', 'email', 'credentials', 'online status'],
    'users': [{**person, 'initialTestRole': roles.get(person['id'], 'supplemental-local-persona'), 'postIds': [post['id'] for post in posts if post['authorId'] == person['id']]} for person in people],
    'posts': posts, 'contextMessages': config['conversations'],
    'sourceAssetManifest': 'evidence/demo-data-2026-10-19/assets.json',
    'note': 'Initial roles describe a fresh fixture only. Migration preserves existing resolved requests, blocks, read markers and relationship changes.'
}
(ROOT / 'docs/demo-data-catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')

roots = {
    'dist': ROOT / 'dist',
    'ios-source': ROOT / 'ios/Eluva/Web',
    'simulator-app': ROOT / '.build/ios/Build/Products/Debug-iphonesimulator/Eluva.app/Web',
    'device-app-unsigned': ROOT / '.build/device/Build/Products/Debug-iphoneos/Eluva.app/Web',
}
sets = {name: {str(p.relative_to(folder)): sha(p) for p in folder.rglob('*') if p.is_file() and p.name != '.generated-files.json'} for name, folder in roots.items()}
assert len(sets['dist']) == 213
for name, files in sets.items():
    assert files == sets['dist'], name
manifest = {r['file']: r['sha256'] for r in read('build-manifest.json')['files']}
assert manifest == sets['dist']
save('resource-hashes.json', {'filesPerSet': len(manifest), 'identical': True, 'sets': sets})

matrix = read('browser-matrix.json')
viewports = {(320, 568), (375, 667), (375, 812), (390, 844), (393, 852), (430, 932)}
states = sorted(set(r['state'] for r in matrix))
assert len(matrix) == 108 and len(states) == 9
for state in states:
    rows = [r for r in matrix if r['state'] == state]
    assert {(r['locale'], tuple(r['viewport'])) for r in rows} == {(lang, size) for lang in ['en', 'fr'] for size in viewports}
for row in matrix:
    dom = row['dom']
    assert pixels(EVIDENCE / row['file']) == row['viewport'] == row['pixels']
    assert [dom['width'], dom['height']] == row['viewport']
    assert dom['locale'] == row['locale'] and dom['documentWidth'] <= dom['width']
    assert not dom['errorCodes'] and all(i['loaded'] for i in dom['images'])
    assert dom['tabBar'] == (row['state'] in ['home-ten-original-posts', 'chats-related-people'])
    for script in dom['scripts']:
        assert script.removeprefix('./') in manifest, script

checks = read('ten-post-ui-checks.json')
assert sorted(r['number'] for r in checks) == list(range(1, 11))
for check in checks:
    post = next(p for p in posts if p['fixtureNumber'] == check['number'])
    person = next(p for p in people if p['id'] == post['authorId'])
    assert len(check['states']) == len(post['media'])
    for state, media in zip(check['states'], post['media']):
        assert state['body'] == post['body'] and state['author'] == person['displayName']
        assert not state['tabBar'] and all(i['loaded'] for i in state['images'])
        assert any(i['src'] == './' + media['asset'] for i in state['images'])

web = (EVIDENCE / 'logs/web-tests.log').read_text()
native = (EVIDENCE / 'logs/native-tests.log').read_text()
assert re.search(r'pass 70\b', web) and re.search(r'fail 0\b', web)
assert 'Executed 47 tests, with 0 failures' in native and '** TEST SUCCEEDED **' in native
for name in ['simulator-build', 'device-build']:
    assert '** BUILD SUCCEEDED **' in (EVIDENCE / f'logs/{name}.log').read_text()
console = read('browser-console.json')
assert not [line for line in console if line['level'] == 'error']

summary = {
    'scope': 'Supplied local user and post data integration; not full P7 release acceptance',
    'fixtureVersion': config['version'], 'users': 20, 'seedPosts': 10, 'postImages': 19,
    'sourceAssets': 39, 'sourceBytes': sum(a['bytes'] for a in assets),
    'assetsUnmodified': True, 'testAccountConversations': 2,
    'webTests': {'passed': 70, 'failed': 0}, 'nativeTests': {'passed': 47, 'failed': 0, 'device': 'iPhone SE (3rd generation) / iOS 17.5 Simulator', 'resultBundle': '.build/demo-data-20261019-tests.xcresult'},
    'browser': {'screenshotsInMatrix': len(matrix), 'states': states, 'locales': ['en', 'fr'], 'viewports': [list(v) for v in sorted(viewports)], 'allTenPostDetails': True, 'allNineteenPostImages': True, 'horizontalOverflow': False, 'missingImages': False, 'consoleErrors': 0, 'realSystemKeyboard': False},
    'builds': {'vite': 'passed', 'iosResourceSync': 'passed', 'simulator': 'passed', 'deviceUnsigned': 'passed', 'resourceSets': 4, 'filesPerSet': 213, 'identicalSha256': True},
    'nativeUI': {'status': 'partial', 'device': 'iPhone 17 / iOS 26.5 Simulator', 'observed': 'Actual bundled WKWebView home shows 10 Resonances Found and supplied post image/text', 'screenshot': 'screenshots/native-launch-attempt.png', 'notVerified': ['Native Chats/profile touch navigation: CUA coordinate input failed with windowNotFoundAtPosition', 'System keyboard', 'Full native viewport/language matrix']},
    'physicalDevice': {'status': 'not-run', 'inventory': 'iPhone 15 Pro connected; iPhone SE unavailable', 'note': 'No physical install or interaction; unsigned build is compile verification only'},
    'limitations': ['User-created posts and previously changed relationships remain; total visible items may differ from a fresh test fixture.', 'Seed persona identity/age/major/bio and contextual messages are fictional local test data.', 'Existing P7 design/StoreKit/hardware acceptance gaps remain outside this data task.', 'Native test teardown logs contain WebKit RBS/ProcessSuspension messages; not a clean-console claim.'],
}
save('verification-summary.json', summary)

purposes = {
    'src/social-state.js': 'Resolve canonical bundled persona avatars through existing profile state; keep real media Bridge resolution.',
    'src/data/demo-fixtures.js': 'Single source for 20 fictional personas, 10 original posts and related local conversation data.',
    'src/data/social-demo.js': 'Reuse canonical persona data and retain existing sticker configuration.',
    'src/data/content-demo.js': 'Reuse canonical ten-post data.',
    'src/views/PostDetailView.vue': 'Use existing PersonAvatar for the actual post author.',
    'src/domain/demo-upgrade.js': 'Versioned scoped fixture migration preserving user data and blocked relationships.',
    'src/domain/social.js': 'Apply migration and expose only canonical bundled demo avatar assets.',
    'src/domain/content.js': 'Apply versioned demo post upgrade without changing original post IDs.',
    'src/services/browser-repository.js': 'Persist old fixture upgrades atomically during initialization, with retry after failure.',
    'scripts/import-demo-assets.py': 'Import exactly 39 supplied PNGs byte-for-byte and record source hashes.',
    'scripts/prepare-assets.mjs': 'Generate shared native JSON from the canonical JavaScript fixture source.',
    'scripts/audit-demo-data.py': 'Recheck saved evidence, original assets, counts and four built resource sets.',
    'tests/demo-fixtures.test.js': 'Test exact input data, migration rollback/idempotency, isolation and avatar asset safety.',
    'public/config/content-demo.json': 'Generated canonical ten posts for the native repository.',
    'public/config/social-demo.json': 'Generated canonical twenty personas for the native repository.',
    'public/config/demo-fixtures.json': 'Generated migration version and local conversation/request configuration.',
    'ios/Eluva/SocialRepository.swift': 'Reuse the fixture upgrade and canonical avatar resource lookup.',
    'ios/Eluva/ContentRepository.swift': 'Mark fresh content with the canonical fixture version.',
    'ios/Eluva/DemoFixtures.swift': 'Native counterpart of scoped fixture migration using shared bundled JSON.',
    'ios/Eluva/LocalRepository.swift': 'Atomically persist changed upgraded vault before publishing snapshot.',
    'ios/EluvaTests/DemoFixtureTests.swift': 'Test native fixture resources, scope, old vault preservation and migration retry.',
    'ios/Eluva.xcodeproj/project.pbxproj': 'Generated Xcode source/test membership for new Swift files.',
    'README.md': 'Document latest data, fixed account usage and current validation boundaries.',
    'docs/demo-data-integration-report.md': 'Record mapping, implementation, persistence and executed versus pending validation.',
    'docs/demo-data-catalog.json': 'Generated complete user/post/role/source correspondence.'
}
baseline = read('baseline.json')['files']
source_files = []
for file, purpose in purposes.items():
    path = ROOT / file
    digest = sha(path)
    if baseline.get(file) != digest:
        source_files.append({'file': file, 'kind': 'modified' if file in baseline else 'added', 'purpose': purpose, 'beforeSha256': baseline.get(file), 'afterSha256': digest})
for asset in assets:
    source_files.append({'file': asset['file'], 'kind': 'added-asset', 'purpose': 'Unmodified supplied ' + asset['role'] + ' PNG; see source manifest.', 'afterSha256': asset['sha256']})
save('source-files.json', {'files': source_files, 'generatedIOSWeb': {'root': 'ios/Eluva/Web', 'files': 213, 'manifest': 'resource-hashes.json'}, 'evidence': {'root': 'docs/evidence/demo-data-2026-10-19', 'screenshotsAndObservations': 'browser-matrix.json', 'logs': 'logs/'}})
print(json.dumps({'assets': 39, 'posts': 10, 'users': 20, 'browserScreenshots': 108, 'resourceFiles': 213, 'resourceSetsEqual': True, 'webTests': 70, 'nativeTests': 47}))

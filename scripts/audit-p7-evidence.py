"""Audit saved P7 evidence, never drive UI or manufacture screenshots.

Run with a Python environment containing Pillow. Browser observations and
offscreen WebKit attachments are deliberately reported as different layers.
"""
import collections
import hashlib
import json
import pathlib
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/evidence/p7'
SIZES = [(320, 568), (375, 667), (375, 812), (390, 844), (393, 852), (430, 932)]
NOW = datetime.now(timezone.utc).isoformat()


def read(path):
    return json.loads(path.read_text())


def save(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def manifest(path):
    return {p.relative_to(path).as_posix(): sha(p) for p in sorted(path.rglob('*'))
            if p.is_file() and p.name != '.generated-files.json'}


issues = []
matrix = read(OUT / 'browser-matrix.json')
groups = collections.defaultdict(list)
builds = {}
for path in [OUT, *sorted(OUT.glob('capture-build-*'))]:
    source = ROOT / 'dist' if path == OUT else path
    mf = read(path / 'build-manifest.json')
    files = {f['file']: f['sha256'] for f in mf['files']}
    for name, digest in files.items():
        if name.startswith('assets/index-') or name == 'boot.js':
            actual = source / name
            if not actual.is_file() or sha(actual) != digest:
                issues.append({'kind': 'capture-build-bytes', 'path': str(actual)})
    builds[path.name] = files

excluded = []
bundle_distribution = collections.Counter()
for row in matrix:
    groups[row['state']].append(row)
    file = OUT / row['file']
    size = list(Image.open(file).size)
    d = row['dom']
    failures = []
    if size != row['viewport'] or size != row['pixels']:
        failures.append('pixel size')
    if d['locale'] != row['locale'] or [d['width'], d['height']] != row['viewport']:
        failures.append('DOM size/language')
    if d['documentWidth'] > d['width'] or (d.get('mainScrollWidth') or 0) > (d.get('mainWidth') or d['width']):
        failures.append('horizontal overflow')
    if d.get('missingImages') or d.get('unresolvedText'):
        failures.append('missing image/translation')
    route = urlsplit(d['url']).fragment.split('?')[0]
    if bool(d['tabBar']) != (route in ['/home', '/chats', '/mine']):
        failures.append('TabBar route rule')
    refs = [r.removeprefix('./') for r in d.get('scripts', []) + d.get('styles', [])]
    matching = [key for key, files in builds.items() if all(r in files for r in refs)]
    if not matching:
        failures.append('unknown captured bundle')
    bundle_distribution[next((k for k in matching if k == OUT.name), matching[0] if matching else 'unknown')] += 1
    if 'before-fix' in row['state'] or 'before-empty-fix' in row['state']:
        excluded.append(row['file'])
    if failures:
        issues.append({'kind': 'browser-observation', 'file': row['file'], 'failures': failures})

group_audit = []
expected = {(lang, *size) for lang in ['en', 'fr'] for size in SIZES}
for state, rows in sorted(groups.items()):
    actual = {(r['locale'], *r['viewport']) for r in rows}
    group_audit.append({'state': state, 'captures': len(rows), 'matrixComplete': actual == expected,
                        'missing': sorted(expected - actual),
                        'verdict': 'historical-defect-excluded' if any(r['file'] in excluded for r in rows)
                        else 'browser-observation-only',
                        'files': [r['file'] for r in rows]})

sets = {label: manifest(ROOT / path) for label, path in {
    'vite': 'dist', 'ios-source': 'ios/Eluva/Web',
    'simulator-app': '.build/ios/Build/Products/Debug-iphonesimulator/Eluva.app/Web',
    'unsigned-device-app': '.build/device/Build/Products/Debug-iphoneos/Eluva.app/Web'}.items()}
resource_equal = all(v == sets['vite'] for v in sets.values())
if sets['vite'] != builds[OUT.name]:
    issues.append({'kind': 'production-manifest-does-not-match-dist'})
if not resource_equal or len(sets['vite']) != 173:
    issues.append({'kind': 'four-resource-sets', 'counts': {k: len(v) for k, v in sets.items()}})
save('four-resource-hashes.json', {'createdAt': NOW, 'equal': resource_equal, 'sets': sets})

attachments = []
for test in read(OUT / 'native-attachments/manifest.json'):
    for item in test['attachments']:
        data = read(OUT / 'native-attachments' / item['exportedFileName'])
        attachments.append({'file': 'native-attachments/' + item['exportedFileName'],
                            'test': test['testIdentifier'], 'observation': data})
        if (data['origin'] != 'eluva://app' or data['tabBar'] or data['overflow'] or data['missing']
                or not data['fontReady'] or not data['poppins'] or not data['jakarta']
                or data['ordinary'] != 'none' or data['bootFailure']):
            issues.append({'kind': 'offscreen-WebKit', 'file': item['exportedFileName']})
if {(a['observation']['locale'], a['observation']['width'], a['observation']['height']) for a in attachments} != expected:
    issues.append({'kind': 'offscreen-WebKit-matrix'})
save('native-webkit-observations.json', {'scope': 'offscreen read-only WKWebView, not native UI/keyboard/physical', 'results': attachments})

web_log = (OUT / 'logs/web-tests.log').read_text()
native_log = (OUT / 'logs/native-acceptance-tests.log').read_text()
web_tests = re.findall(r'^✔ (.+?) \([\d.]+ms\)$', web_log, re.M)
native_tests = re.findall(r"Test Case '-\[EluvaTests\.([^\]]+)\]' passed", native_log)
if len(web_tests) != 67 or 'ℹ fail 0' not in web_log:
    issues.append({'kind': 'web-tests'})
if len(native_tests) != 45 or '** TEST SUCCEEDED **' not in native_log:
    issues.append({'kind': 'native-tests'})
for log in ['simulator-final-build.log', 'device-final-build.log']:
    if '** BUILD SUCCEEDED **' not in (OUT / 'logs' / log).read_text():
        issues.append({'kind': 'build', 'log': log})
policy = read(ROOT / 'dist/config/commerce-policy.json')
if policy['confirmed'] or policy['products']:
    issues.append({'kind': 'commercial-policy-not-frozen'})
if any(p.name.endswith('.storekit') for p in (ROOT / '.build/device/Build/Products/Debug-iphoneos/Eluva.app').rglob('*')):
    issues.append({'kind': 'test-storekit-in-production-app'})
fonts = read(OUT / 'font-inventory.json')
if any(font['missingFrenchCharacters'] for font in fonts):
    issues.append({'kind': 'font-french-coverage'})
save('test-index.json', {'web': web_tests, 'native': native_tests,
                        'note': 'Test names describe isolated domain/native coverage; not UI signoff.'})

baseline = read(OUT / 'baseline-code-hashes.json')['files']
current = {}
for base in ['src', 'tests', 'scripts', 'public', 'ios/Eluva', 'ios/EluvaTests']:
    for p in (ROOT / base).rglob('*'):
        if p.is_file() and 'ios/Eluva/Web/' not in p.as_posix():
            current[p.relative_to(ROOT).as_posix()] = sha(p)
for path in ['README.md', 'docs/app-flow-and-implementation-plan.md', 'docs/p7-implementation-report.md',
             'docs/p7-acceptance-registry.json', 'docs/p7-visual-audit.json']:
    if (ROOT / path).is_file():
        current[path] = sha(ROOT / path)
purposes = {
    'README.md': '更新当前阶段、分层验证边界、复测命令和30秒来电技术假设。',
    'docs/app-flow-and-implementation-plan.md': 'v9记录P7已执行部分和未通过出口，不改写历史确认。',
    'docs/p7-implementation-report.md': '逐项交付报告、验证证据、保留QA数据与剩余步骤。',
    'docs/p7-acceptance-registry.json': '54路由、原生启动与78契约的状态/设计/行为证据登记。',
    'docs/p7-visual-audit.json': '字体素材、倍率、视觉保留项与明确缺稿差异。',
    'scripts/audit-p7-evidence.py': '核对真实截图尺寸、语言、溢出、TabBar、捕获包来源、四份资源和测试计数。',
    'scripts/build-p7-registry.py': '将既有逐页契约、最新精确ID版本与实际观察状态关联，不自动签核。',
    'scripts/audit-p7-fonts.swift': '用CoreText核对本地字体身份、字重轴和法语字符覆盖。',
    'scripts/resource-reference.mjs': '枚举精确路径校验资源，避免大小写不敏感磁盘掩盖错误。',
    'scripts/audit-build.mjs': '增加HTML/CSS/JS静态素材路径校验和可选证据目录。',
    'scripts/sync-ios.mjs': '将同步证据写入指定阶段目录，日常构建不覆盖P6历史。',
    'src/components/MediaRecovery.vue': '共享媒体恢复控件；浏览器不支持时改选来源，原生拒绝才显示系统设置。',
    'src/components/MediaGrid.vue': '注册照片接入共享媒体恢复，保留当前选择。',
    'src/components/ContentMediaPicker.vue': '发帖媒体使用共享恢复，不再在浏览器引导无效系统设置。',
    'src/components/DraftImagePicker.vue': '资料/合集/反馈共享选图恢复入口。',
    'src/views/ConversationView.vue': '会话图片恢复复用同一控件与既有Bridge。',
    'src/i18n.js': '补齐改选媒体来源的英语/法语提示。',
    'src/styles.css': '恢复入口44pt触摸与长文案换行。',
    'src/components/AppModal.vue': '首次引导增加源设计两侧气泡球位置。',
    'src/content.css': '恢复引导卡/球/字体参数，320宽法语按钮分行不挤断。',
    'src/data/content-messages.js': '法语引导与正式三个Tab名称一致。',
    'src/views/HomeView.vue': '私密帖不误判发现筛选空态，首次引导球按步骤切换侧边。',
    'src/components/CollectionEditor.vue': '删除确认打开前清掉无关媒体错误。',
    'src/components/DeletePostDialog.vue': '帖子删除确认不继承之前无关错误。',
    'src/views/SettingsView.vue': '进入删号最终核对前清理无关错误，不提交删除。',
    'src/views/VideoCallView.vue': '重启重置样片/控制器状态；播放/暂停与实际video事件一致。',
    'src/views/ChatsView.vue': '真实用户语音与演示语音预览文案分别标识。',
    'src/data/social-messages.js': '真实语音消息标题双语，不冒称演示文件。',
    'src/components/VoiceMessage.vue': '未知时长显示占位，读取实际媒体后再显示真实秒数。',
    'src/components/IncomingVideoBanner.vue': '无人接受的演示来电自然超时、取消计时、失败重试及离页清理。',
    'src/domain/realtime.js': '唯一预览策略增加30秒来电期限与稳定timeout结束原因。',
    'src/data/realtime-messages.js': '双语来电过期及结束原因说明。',
    'public/config/realtime-policy.json': '构建从唯一JS策略生成原生共用配置；不是第二套规则。',
    'ios/Eluva/RealtimeRepository.swift': '同一原生服务允许timeout原因，保持首次结束结果幂等。',
    'ios/EluvaTests/RealtimeTests.swift': '验证超时写入回滚、重试释放占用和迟到离页不改原因。',
    'ios/EluvaTests/WebBundleTests.swift': '实际本地包+原生Bridge的双语六尺寸离屏WKWebView读取验证。',
    'tests/localization.test.js': '所有Vue字面量翻译键可解析，法语引导Tab名称一致。',
    'tests/realtime.test.js': '来电超时仓储失败/重试/释放/迟到结束幂等。',
    'tests/resources.test.js': '资源大小写、编码、缺失与越界边界回归。',
}
changes = [{'file': p, 'change': 'modified' if p in baseline else 'added',
            'purpose': purposes.get(p, '见P7报告；新增或更新的范围内验证工件。'),
            'beforeSha256': baseline.get(p), 'sha256': digest}
           for p, digest in sorted(current.items()) if baseline.get(p) != digest]
save('source-files.json', {'baselineAt': read(OUT / 'baseline-code-hashes.json')['capturedAt'],
                          'files': changes,
                          'generatedXcodeProject': {'file': 'ios/Eluva.xcodeproj/project.pbxproj',
                           'sha256': sha(ROOT / 'ios/Eluva.xcodeproj/project.pbxproj'),
                           'note': 'Existing generated project refreshed for new XCTest; pre-P7 hash not captured.'},
                          'generatedWeb': '173 files synchronized; see four-resource-hashes.json'})
summary = {'createdAt': NOW, 'acceptance': 'NOT RELEASE ACCEPTED; known gates remain',
           'evidenceIntegrityIssues': issues, 'browserCaptures': len(matrix),
           'browserNamedStates': len(groups), 'completeMatrices': sum(x['matrixComplete'] for x in group_audit),
           'historicalDefectCapturesExcluded': len(excluded), 'partialMatrices': [x for x in group_audit if not x['matrixComplete']],
           'captureBundleDistribution': dict(bundle_distribution), 'groups': group_audit,
           'webTests': len(web_tests), 'nativeTests': len(native_tests), 'offscreenWKWebViewObservations': len(attachments),
           'fourResourceSetsEqual': resource_equal, 'resourceCount': len(sets['vite']),
           'fonts': len(fonts), 'fontFamilies': sorted({f['family'] for f in fonts}),
           'pendingGates': ['Formal design browser layer/version signoff and missing screen/assets approval',
                           'Native interactive simulator launch/navigation/keyboard/Safe Area/media UI',
                           'Physical device permissions, recording, camera, translation, lifecycle and performance',
                           'Approved commercial SKU/type/grants/limits and Apple sandbox real-device verification',
                           'Human credential-reset final save and action-time QA deletion confirmation',
                           'Unobserved individual transient/failure/hardware states recorded per contract'],
           'nativeConsole': {'constraintConflictMatches': len(re.findall('Unable to simultaneously satisfy constraints', native_log)),
                             'notes': 'Offscreen WebKit teardown includes RBS/ProcessSuspension messages. Native interactive console/performance is not signed off.'}}
save('evidence-audit.json', summary)
save('verification-summary.json', {k: v for k, v in summary.items() if k != 'groups'})
print(json.dumps({k: v for k, v in summary.items() if k not in ['groups', 'partialMatrices', 'captureBundleDistribution']}, ensure_ascii=False, indent=2))
if issues:
    raise SystemExit(1)

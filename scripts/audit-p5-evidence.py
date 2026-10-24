"""Audit recorded P5 browser evidence and the four final local Web bundles.

Requires Pillow. This does not drive or certify an iPhone or claim pixel identity.
The browser journal explicitly retains captured phase iterations.
"""
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'docs/evidence/p5'
VIEWPORTS = {(320,568),(375,667),(375,812),(390,844),(393,852),(430,932)}
STATES = set('''blocklist-content blocklist-empty blocklist-unblock-confirm
collection-create-draft collection-delete-confirm collection-detail collection-edit-cover
collection-selection collections-empty collections-list delete-account-confirm
delete-account-review delete-fixed-account-protected feedback-draft feedback-empty
feedback-invalid-attachment feedback-save-error feedback-saved legal-guidelines legal-privacy
legal-terms legal-user-agreement logout-confirm mine-isolated-account mine-profile-saved
mine-relogin mine-theme-pink my-lights-content my-lights-empty my-posts-content my-posts-empty my-posts-more-menu
post-delete-confirm profile-camera-unsupported profile-editor profile-save-error settings
settings-about settings-language settings-load-error settings-notifications-unsupported
theme-cyan-preview theme-orange-preview theme-pink-preview theme-purple-preview theme-save-error'''.split())
ERRORS = {k:'STORAGE_FAILED' for k in ['profile-save-error','theme-save-error','feedback-save-error','settings-load-error']}
ERRORS.update({'profile-camera-unsupported':'DEVICE_UNSUPPORTED','feedback-invalid-attachment':'MEDIA_UNSUPPORTED'})

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

rows = json.loads((EVIDENCE/'browser-matrix.json').read_text())
expected = {(s,l,w,h) for s in STATES for l in ('en','fr') for w,h in VIEWPORTS}
keys = {(r['state'],r['lang'],r['width'],r['height']) for r in rows}
assert len(rows)==len(expected) and keys==expected, f'missing={expected-keys}; extra={keys-expected}'
iterations = json.loads((EVIDENCE/'build-iterations.json').read_text())
known = {'./'+f['file'] for i in iterations for f in i['files'] if f['file'].startswith('assets/index-') and f['file'].endswith('.js')}
screenshots=[]
for r in rows:
    path=EVIDENCE/'screenshots'/r['file']
    with Image.open(path) as image:
        assert image.size==(r['width'],r['height']),path.name
        variation=max(ImageStat.Stat(image.convert('RGB')).stddev)
        assert variation>=3,f'blank: {path.name}'
    assert r['lang'] in ('en','fr') and r['font']=='loaded',path.name
    assert r['bodyWidth']<=r['width']+1 and abs(r['bodyHeight']-r['height'])<=1,path.name
    if r['main']:assert r['main']['scrollWidth']<=r['main']['width']+1,path.name
    for key in ('header','dialog','footer','tabs'):
        b=r.get(key)
        if b:
            assert b['left']>=-1 and b['right']<=r['width']+1,(path.name,key)
            assert b['top']>=-1 and b['bottom']<=r['height']+1,(path.name,key)
    assert bool(r['tabs'])==r['state'].startswith('mine-'),f'TabBar: {path.name}'
    assert set(r['errors'])==({ERRORS[r['state']]} if r['state'] in ERRORS else set()),(path.name,r['errors'])
    assert r['applicationScript'] in known,path.name
    screenshots.append({'file':'screenshots/'+path.name,'sha256':sha(path),'width':r['width'],'height':r['height'],'pixelStddevMax':round(variation,3),'applicationScript':r['applicationScript']})

manifest=json.loads((EVIDENCE/'build-manifest.json').read_text())
expected_files={f['file'] for f in manifest['files']}
bundles=['dist','ios/Eluva/Web','.build/ios/Build/Products/Debug-iphonesimulator/Eluva.app/Web','.build/device/Build/Products/Debug-iphoneos/Eluva.app/Web']
for prefix in bundles:
    base=ROOT/prefix
    actual={str(p.relative_to(base)) for p in base.rglob('*') if p.is_file() and p.name!='.generated-files.json'}
    assert actual==expected_files,(prefix,actual-expected_files,expected_files-actual)
    for f in manifest['files']:
        assert sha(base/f['file'])==f['sha256'],(prefix,f['file'])
        if f['file'].endswith(('.js','.html','.css','.svg')):
            text=(base/f['file']).read_text()
            assert not re.search(r'lanhuapp\.com|lanhu-oss-|alipic\.lanhu|/Users/|(?:localhost|127\.0\.0\.1):\d+',text),(prefix,f['file'],'remote/developer reference')
            assert not re.search(r'(?:href|src)=["\']https?://',text),(prefix,f['file'],'remote asset')
            assert not re.search(r'Cimoa|CIRCA|53Hz|TopLive|MiaVoice',text),(prefix,f['file'],'foreign brand')

assets=json.loads((EVIDENCE/'asset-sources.json').read_text())
for a in assets:
    assert sha(ROOT/a['path'])==a['sha256'],a['path']
versions=json.loads((EVIDENCE/'version-verification.json').read_text())['versions']
assert len(versions)==19
assert {v['index'] for v in versions if v['status']!='verified'}=={32}
assert all(v['version']=='版本1' for v in versions if v['status']=='verified')
result={'checkedAt':datetime.now(timezone.utc).isoformat(),'passed':True,'scope':'Recorded browser phase iterations and final packaged resources; no native UI, physical-device or pixel-identity certification','stateCount':len(STATES),'screenshotCount':len(rows),'languages':['en','fr'],'viewports':sorted(VIEWPORTS),'stateCounts':dict(Counter(r['state'] for r in rows)),'capturedScriptCount':len(set(r['applicationScript'] for r in rows)),'resourceCount':len(expected_files),'verifiedBundles':bundles,'sourceAssetCount':len(assets),'designVersionVerified':18,'designVersionPending':[32],'screenshots':screenshots}
(EVIDENCE/'evidence-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f'P5 evidence audit passed: {len(rows)} screenshots, {len(STATES)} states, {len(expected_files)} resources × 4 bundles; #32 version remains pending.')

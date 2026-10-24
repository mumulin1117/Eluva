"""Join existing route contracts to observed P7 evidence without inventing passes."""
import collections
import json
import pathlib
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
OUT = DOCS / 'evidence/p7'


def read(p):
    return json.loads(p.read_text())


def write(p, d):
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')


def response(d):
    r = d.get('response', d)
    if 'content' in r:
        for c in r['content']:
            if c.get('type') == 'text':
                try:
                    return json.loads(c['text'])
                except ValueError:
                    pass
    return r


catalog = read(OUT / 'lanhu-catalog-live.json')['designs']
slice_files = {int(p.stem.split('-')[-1]): p for p in (OUT / 'designs').glob('slices-*.json')}
references = {r['index']: r for r in read(OUT / 'designs/reference-files.json')}
designs = []
for design in catalog:
    p = slice_files.get(design['index'])
    r = response(read(p)) if p else {}
    exact = r.get('status') == 'success' and r.get('design_id') == design['id']
    designs.append({**design, 'version': r.get('version') if exact else None,
                    'versionVerification': 'exact-ID API response' if exact else 'pending: ID mismatch/API error/not fetched',
                    'responseDesignId': r.get('design_id'), 'responseVersionNotAttributable': None if exact else r.get('version'),
                    'slicesEvidence': p.relative_to(DOCS).as_posix() if p else None,
                    'sliceScale': r.get('slice_scale') if exact else None,
                    'reference': references.get(design['index']),
                    'browserLayerSignoff': 'not executed: Mac locked',
                    'annotationBasis': 'Saved MCP text/data-css fallback, not a browser signoff or independently complete native-layer schema.'})
by_id = {d['id']: d for d in designs}
write(OUT / 'design-version-audit.json', {'recordGeneratedAt': datetime.now(timezone.utc).isoformat(), 'catalogEntries': len(catalog), 'sliceResponses': len(slice_files),
      'exactIdVersions': sum(d['version'] is not None for d in designs), 'designs': designs})

matrix = read(OUT / 'browser-matrix.json')
audit = read(OUT / 'evidence-audit.json')
groups = {g['state']: g for g in audit['groups']}
test_index = read(OUT / 'test-index.json')
observations = read(OUT / 'interaction-observations.json')

# These are evidence labels, not claimed equivalents for every combined contract state.
patterns = {
 'P1': [r'^eula-', r'^welcome-', r'^age-', r'^birthday-', r'^community-', r'^signup-', r'^verify-', r'^login-', r'^forgot-', r'^legal-', r'^onboarding-'],
 'P2': [r'^home-', r'^compose-', r'^post-', r'^comment-', r'^my-posts-', r'^my-lights-', r'^collection-'],
 'P3': [r'^chats-', r'^friends-', r'^requests-', r'^request-', r'^profile-', r'^friend-request-', r'^conversation-', r'^chat-photo-', r'^help-', r'^report-', r'^block-', r'^unblock-'],
 'P4': [r'^voice-', r'^video-', r'^incoming-', r'^text-translation-'],
 'P5': [r'^mine-', r'^profile-edit-', r'^collections-', r'^collection-', r'^settings-', r'^theme-', r'^blocklist-', r'^feedback-', r'^legal-', r'^about-', r'^account-', r'^logout-', r'^my-posts-', r'^my-lights-', r'^post-delete-'],
 'P6': [r'^store-', r'^compose-return-from-store'],
}
state_routes = collections.defaultdict(set)
for row in matrix:
    state_routes[row['state']].add(urlsplit(row['dom']['url']).fragment.split('?')[0])


def norm(route):
    # Contract units include overlays and round trips, so keep these separately.
    return route.split('?')[0].split(' modal')[0].split(' (')[0].strip()


def matches(route, actual):
    route = norm(route)
    return bool(re.fullmatch(re.sub(r':[A-Za-z]+', '[^/]+', re.escape(route).replace(r'\:', ':')), actual))


def related_states(phase, routes):
    result = []
    for state, actuals in state_routes.items():
        if not any(re.search(p, state) for p in patterns[phase]):
            continue
        if any(matches(route, actual) for route in routes for actual in actuals):
            result.append(state)
    return sorted(result)


units = []
for n in range(1, 7):
    phase = 'P' + str(n)
    source_name = f'p{n}-route-contracts.json'
    contract = read(DOCS / source_name)
    key = 'pages' if 'pages' in contract else 'cards'
    for i, card in enumerate(contract[key]):
        routes = card.get('routes') or [card['route']]
        if n == 4 and ' or ' in routes[0]:
            routes = routes[0].split(' or ')
        # Modal-only contracts have no standalone route, map to their actual hosts.
        extra_hosts = {
          'modal:profile-or-locked-conversation': ['/profile/:id', '/conversation/:peer'],
          'modal:/chats-more': ['/chats'], 'modal:/chats-read-lights': ['/chats'],
          'modal:profile-or-conversation-safety': ['/profile/:id', '/conversation/:peer', '/call/:peer'],
          '/store:help': ['/store'], '/store:terms': ['/store'],
          '/compose -> /store -> /compose': ['/compose', '/store'],
          '/edit-profile -> /store -> /edit-profile': ['/edit-profile', '/store'],
          '/welcome + eula': ['/welcome'],
        }
        hosts = [h for route in routes for h in extra_hosts.get(route, [route])]
        seen = related_states(phase, hosts)
        source_designs = card.get('designs', card.get('sources', []))
        ids = [d.get('designId') or d.get('imageId') or d.get('id') for d in source_designs]
        ids += card.get('directDesignImageIds', []) + card.get('visualReferenceImageIds', [])
        mapping = [{k: by_id[id].get(k) for k in ['index', 'id', 'name', 'update_time', 'version', 'versionVerification', 'slicesEvidence', 'reference']}
                   for id in dict.fromkeys(ids) if id in by_id]
        declared = card.get('states') or contract.get('commonStates') or ['initial', 'loading', 'success', 'failure', 'disabled', 'retry', 'cancel when applicable']
        # A single UI screenshot is evidence of that named observation only. It
        # must never auto-pass a compound loading/failure/cancellation contract.
        required = [{'state': s, 'verdict': 'not individually signed off',
                     'relatedBrowserObservations': seen,
                     'remaining': 'Review this specific transition, transient state or hardware branch against the original contract; screenshots are not a blanket pass.'}
                    for s in declared]
        units.append({'id': f'{phase}:{i:02}', 'phase': phase,
                      'name': card.get('id') or card.get('key') or card.get('page') or card.get('name') or routes[0],
                      'routes': routes, 'hostRoutes': hosts,
                      'contract': f'{source_name}#/{key}/{i}',
                      'behaviorContract': card,
                      'currentDesigns': mapping,
                      'designStatus': 'supplement/reference only; approval pending' if n == 1 and not card.get('directDesignImageIds')
                                      else 'API source checked; formal layer/signoff pending',
                      'requiredStateRecords': required,
                      'observedBrowserStates': [{'state': s, 'matrixComplete': groups[s]['matrixComplete'],
                         'verdict': groups[s]['verdict'], 'evidence': 'evidence/p7/browser-matrix.json#state=' + s} for s in seen],
                      'automatedDomainEvidence': 'evidence/p7/test-index.json (individual test names and repository scope; not UI validation)',
                      'nativeUI': 'unexecuted in P7: locked Mac; no screenshot substitution',
                      'physicalDevice': 'unexecuted: paired devices unavailable',
                      'releaseVerdict': 'pending'})

routes = ['/welcome'] + ['/auth/' + x for x in ['age', 'community', 'sign-up', 'log-in', 'verify/email', 'verify/code', 'verify/success', 'password/email', 'password/code', 'password/new']]
routes += ['/onboarding/' + x for x in ['basic', 'university', 'major', 'photos', 'about', 'interests', 'goal', 'icebreakers', 'notifications', 'complete']]
routes += ['/home', '/chats', '/mine', '/store', '/store/benefits', '/store/wallet', '/edit-profile', '/collections', '/collections/:id', '/collections/:id/posts']
routes += ['/settings' + x for x in ['', '/theme', '/language', '/blocked', '/about', '/delete-account']]
routes += ['/feedback', '/profile/:id', '/friends', '/friend-requests', '/conversation/:peer', '/conversation/:peer/photo/:message', '/call/:peer', '/help', '/compose', '/post/:id', '/post/:id/media/:index', '/my-posts', '/my-lights']
routes += ['/legal/' + x for x in ['terms', 'privacy', 'guidelines', 'eula']]
route_records = []
for route in routes:
    related = sorted(s for s, actuals in state_routes.items() if any(matches(route, actual) for actual in actuals))
    route_records.append({'route': route, 'tabBar': route in ['/home', '/chats', '/mine'],
                          'contracts': [u['id'] for u in units if any(norm(r) == route for r in u['hostRoutes'])],
                          'browserStates': related, 'browserStateCount': len(related),
                          'unexecuted': ['individual transient states not automatically inferred', 'native interactive simulator', 'physical device'],
                          'offscreenWebKit': 'initial Welcome/EULA only' if route == '/welcome' else 'not navigated in offscreen test'})

write(DOCS / 'p7-acceptance-registry.json', {
 'schemaVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
 'verdict': 'partial technical verification; NOT full/release acceptance',
 'interpretation': ['All original contractual state labels have a record, including unexecuted ones.',
                    'A recorded state is not necessarily a verified state. No compound contract state is automatically passed.',
                    'Original behaviorContract preserves entry/actions/back/save/validation/native dependencies; currentDesigns supersedes old source versions only with exact-ID evidence.'],
 'logicalRouteCount': len(routes), 'nativeUnits': ['native:launch', 'native:overlay/H5 boot'],
 'routeRecords': route_records, 'contractUnits': units,
 'namedBrowserObservations': [{'state': g['state'], 'matrixComplete': g['matrixComplete'], 'verdict': g['verdict'], 'files': g['files']} for g in audit['groups']],
 'unconfirmed': ['Incoming preview expiry 30 seconds is a reversible technical default, not a confirmed business rule.',
                 'Previous technical media/collection limits, multiple references and commercial benefits remain unconfirmed.'],
 'gates': audit['pendingGates'], 'interactionEvidence': 'evidence/p7/interaction-observations.json',
 'testEvidence': 'evidence/p7/test-index.json', 'nativeEvidence': 'evidence/p7/native-webkit-observations.json'})

visual = {
 'basis': {'logicalCanvas': [390, 844], 'catalogPreview': [195, 422], 'sliceExportScale': 4,
           'layout': 'Core controls use responsive Flex/Grid; only decorative design assets scale/crop. No whole-page transform.'},
 'sourceInventory': 'evidence/p7/design-version-audit.json',
 'annotationEvidence': [p.relative_to(DOCS).as_posix() for p in sorted((OUT / 'designs').glob('annotations-*.txt'))],
 'fonts': read(OUT / 'font-inventory.json'),
 'assetProvenance': ['evidence/p2/asset-sources.json', 'evidence/p3/asset-sources.json', 'evidence/p4/asset-sources.json', 'evidence/p5/asset-sources.json', 'evidence/p5/font-sources.json', 'evidence/p6/asset-sources.json'],
 'reviewedContactSheets': ['evidence/p7/guide-comparison.jpg', 'evidence/p7/visual-contact-1.jpg', 'evidence/p7/visual-contact-2.jpg', 'evidence/p7/visual-contact-3.jpg'],
 'propertyReview': [
  {'area': 'Welcome/auth/onboarding', 'retained': 'Poppins15/400/22 chat bubbles, purple/white local backgrounds, capsule controls, gradient borders; local Poppins/Jakarta', 'differences': 'New email forms and nine-step mixed layout lack exact new designs; 16px editing fields and 44pt touch areas are responsive adaptations.', 'result': 'preview reviewed; formal supplement approval pending'},
  {'area': 'Home guides', 'source': '#7/#8/#10 exact version2, #9 ID mismatch', 'retained': '314pt card,36pt orb,12pt gap at baseline; Poppins13/500/22 buttons; progress rgba192,166,236; alternating orb side; source purple/black gradients', 'differences': 'Business-specific text, added Skip, dynamic target positions, 320px footer stacks. Original connector arrows and source empty-panel illustration not individually reproduced.', 'result': 'visible source differences recorded; NOT pixel-perfect approval'},
  {'area': 'Feed/compose/details', 'retained': 'Source map/island/bulb/media/collection icons and background layers, source font families, rounded sheets/capsules, contain/cover per media role', 'differences': 'Local demo content and privacy replace obsolete matching/PRO assumptions; current card layout responsive rather than fixed page scaling. Video feed cards use a video-type placeholder, not an extracted video poster; detail/viewer play the actual file.', 'result': 'EN/FR matrix observed; exact layer-by-layer browser signoff pending'},
  {'area': 'Chats/profile/friends', 'retained': 'Zen Dots24/400/29 headings (18 at320), Inter and Jakarta rows, source help/light graphics, request and safety styles', 'differences': 'Real stable account IDs and counts; no fake online/remote delivery. Nonfriend request and block states use supplemental text.', 'result': 'browser functional/size reviewed; formal layer signoff pending'},
  {'area': 'Voice/video/language', 'retained': 'Source voice bubble/arc, call background and control assets; explicit native/microphone consent and real media controls', 'differences': 'Local camera/recorded sample instead of remote live call, actual3s WAV and1s looping sample. No invented transcript or translated result.', 'result': 'browser playback reviewed; hardware/permission/cancel surfaces pending native and physical'},
  {'area': 'Mine/collections/settings', 'retained': 'Source title/icon PNGs, Inter20/700/24 name, Jakarta12/15 ID, Bakbak One17/24 labels, four-theme local TabBar variants', 'differences': '#32 exact version unavailable, blank states and authority forms supplemented. Non-purple Home map is currently flat themed background without supplied matching map artwork.', 'result': 'four-theme browser preview only; missing designs/assets approval pending'},
  {'area': 'Store', 'retained': 'Local source purple background, Pro imagery, benefit icons, capsule cards and source type styles', 'differences': 'No fabricated prices/products; unavailable/retry/help instead of unapproved purchase.', 'result': 'unavailable EN/FR UI reviewed; SKU/configuration/sandbox/physical transaction gates open'},
 ],
 'gaps': ['#9/#32/#52 and duplicate #96/#97 responses are not their requested IDs; versions remain null. #49/#95 API json_url errors.',
          'Exact auth/nine-step/empty/failure/editor supplemental screens lack formal approved artboards.',
          'Source vector guide arrows and empty-panel illustration are not individually restored; do not claim every layer restored.',
          'Launch final brand artwork, app icon, approved Bundle ID/team, localized formal legal/contact copy remain missing.',
          'Theme-specific full Home maps beyond purple not supplied/restored; source black/purple button adaptation is pending formal review.',
          'Video feed card cover is a type placeholder; extracting and displaying an actual file poster remains unfinished.',
          'All browser matching uses same390x844 baseline where possible; source content/system chrome differs, so no invented pixel similarity score.'],
 'releaseSignoff': False}
write(DOCS / 'p7-visual-audit.json', visual)
print(json.dumps({'routes': len(routes), 'contractUnits': len(units), 'contractStateRecords': sum(len(u['requiredStateRecords']) for u in units), 'designs': len(designs), 'sliceResponses': len(slice_files), 'exactIdVersions': sum(d['version'] is not None for d in designs), 'routesWithoutBrowserEvidence': [r['route'] for r in route_records if not r['browserStates']]}, ensure_ascii=False, indent=2))

import test from 'node:test'
import assert from 'node:assert/strict'
import { actionNotice, noticeDuration, noticePresentation } from '../src/domain/notice.js'
import { translate } from '../src/i18n.js'

globalThis.window = {webkit: null}
const {state, notify, dismissNotice, advanceNoticeRoute, finishSignOut} = await import('../src/state.js')

test('success feedback names the operation; silent social actions have no default toast', () => {
  assert.equal(actionNotice('social','follow',{following:true}), '')
  for (const method of ['send','help','thread','read','replyPost','lightHelpSeen']) assert.equal(actionNotice('social',method), '')
  assert.equal(actionNotice('social','block',{blocked:true}), 'p2.blocked')
  assert.equal(actionNotice('social','block',{blocked:false}), 'p2.unblocked')
  assert.equal(actionNotice('social','readEvents'), 'toast.lightsRead')
  assert.equal(actionNotice('personal','saveProfile'), 'toast.profileUpdated')
  assert.equal(actionNotice('personal','savePreferences'), 'toast.themeUpdated')
})

test('repeated messages renew identity and stale dismissal cannot remove newer feedback', () => {
  state.user={id:'toast-owner'}
  const first=notify('p2.published'),second=notify('p2.published')
  assert.ok(second>first);dismissNotice(first);assert.equal(state.ui.notice,'p2.published')
  dismissNotice(second);assert.equal(state.ui.notice,'')
})

test('one success handoff survives a return; later navigation and contextual hints clear it', () => {
  notify('p2.published');advanceNoticeRoute();assert.equal(state.ui.notice,'p2.published')
  advanceNoticeRoute();assert.equal(state.ui.notice,'')
  notify('p4.controlsAfterConnected',{handoffs:0});advanceNoticeRoute();assert.equal(state.ui.notice,'')
})

test('switching accounts or signing out cannot carry feedback to another account', () => {
  state.user={id:'toast-owner'};notify('p2.published');state.user={id:'other-owner'}
  assert.equal(state.ui.notice,'');notify('toast.profileUpdated');finishSignOut();assert.equal(state.ui.notice,'')
  notify('p5.accountDeleted');assert.equal(state.ui.noticeMeta.position,'center')
  state.user={id:'third-owner'};assert.equal(state.ui.notice,'')
})

test('all reachable toast copy is bilingual, natural, and does not expose test bookkeeping', () => {
  const keys=['resent','languageSaved','p2.published','p2.draftSaved','p2.collectionSaved','p2.restored','p2.unblocked','p2.hidden','p2.blocked','p2.reportSaved',
    'p2.failureArmed','s.failureArmed','p5.failureArmed','s.filterSaved','s.requestSaved','s.saved','s.messageSaved','p5.saved','p5.feedbackSaved',
    'p5.postDeleted','p5.collectionDeleted','p5.notification_unsupported','p5.cleanupPending','p5.accountDeleted','p4.incomingExpired','p4.controlsAfterConnected',
    'p4.callClosedSaveFailed','toast.profileUpdated','toast.themeUpdated','toast.collectionCreated','toast.lightsRead','toast.connected','toast.requestDeclined']
  for(const locale of ['en','fr']) for(const key of keys){
    const text=translate(locale,key)
    assert.notEqual(text,key,`${locale}: ${key}`)
    assert.doesNotMatch(text,/\b(local|demo|saved|record(?:ed|s)?|diagnostic|browser|session|enregistr[ée]\w*|navigateur)\b/i,`${locale}: ${key}`)
  }
  assert.doesNotMatch(translate('en','resent'),/sent|email|567567/i)
  assert.ok(noticeDuration(translate('fr','p5.cleanupPending'))>noticeDuration('Done.'))
  assert.equal(noticeDuration('x'.repeat(500)),7500)
  assert.equal(noticePresentation('p5.notification_unsupported').tone,'attention')
})

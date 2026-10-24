import test from 'node:test'
import assert from 'node:assert/strict'
import { LoadingToastPresentation, loadingToastKey } from '../src/services/loading-toast.js'
import { loadingMessages } from '../src/data/loading-messages.js'

function fixture() {
  const jobs = new Map(), events = [], delays = []; let id = 0
  const view = new LoadingToastPresentation({ changed: value => events.push(value), schedule(fn, delay) { jobs.set(++id, fn); delays.push(delay); return id }, cancel: handle => jobs.delete(handle) })
  const current = { operation: 'content-publish', owner: 'user-a', route: '/share' }
  return { view, jobs, events, delays, current, update: patch => view.update({ ...current, ...patch }), tick() { const [key, fn] = jobs.entries().next().value; jobs.delete(key); fn() } }
}

test('only explicit submissions opt in, with complete English and French messages', () => {
  for (const operation of ['content-publish', 'personal-saveProfile', 'collection-save', 'personal-saveCollection', 'personal-collectionPosts', 'content-report', 'social-report', 'personal-submitFeedback', 'personal-savePreferences', 'personal-deletePost', 'personal-deleteCollection', 'delete-account']) {
    const key = loadingToastKey(operation).split('.')[1]
    assert.ok(key)
    for (const locale of ['en', 'fr']) {
      assert.ok(loadingMessages[locale][key])
      assert.doesNotMatch(loadingMessages[locale][key], /\b(local|demo|saved|recorded)\b/i)
    }
  }
  for (const operation of ['', 'toString', '__proto__', 'constructor', 'content-load', 'content-refresh', 'chat-send', 'social-follow', 'auth-login', 'store-purchase', 'content-media', 'personal-media', 'chat-media']) assert.equal(loadingToastKey(operation), '')
})

test('quick operations never flash; slow operations announce once and stop immediately on completion', () => {
  const f = fixture()
  f.update(); assert.deepEqual(f.events, []); assert.deepEqual(f.delays, [220])
  const stale = [...f.jobs.values()][0]
  f.update({ operation: '' }); stale(); assert.deepEqual(f.events, []); assert.equal(f.jobs.size, 0)
  f.update(); f.update(); assert.equal(f.jobs.size, 1)
  f.tick(); assert.deepEqual(f.events, [{ operation: 'content-publish', key: 'loading.publishing' }])
  f.update(); assert.equal(f.jobs.size, 0)
  f.update({ operation: '' }); assert.equal(f.events.at(-1), null); assert.equal(f.jobs.size, 0)
})

test('success/error notices and backgrounding take priority, without stale timer callbacks resurrecting feedback', () => {
  for (const revealFirst of [false, true]) {
    const f = fixture(); f.update(); const stale = [...f.jobs.values()][0]
    if (revealFirst) f.tick()
    f.update({ blocked: true }); stale()
    assert.equal(f.view.visible, false); assert.equal(f.jobs.size, 0)
    f.update(); const fresh = [...f.jobs.values()][0]
    stale(); assert.equal(f.jobs.size, 1); assert.equal(f.view.visible, false)
    f.tick(); assert.equal(f.view.visible, true)
    f.update({ blocked: true }); fresh(); assert.equal(f.view.visible, false)
  }
})

test('leaving the initiating page or account prevents its display returning, even on revisiting', () => {
  for (const changed of [{ route: '/mine' }, { owner: 'user-b' }, { owner: null }]) {
    const f = fixture(); f.update(); const stale = [...f.jobs.values()][0]; f.tick()
    f.update(changed); assert.equal(f.events.at(-1), null)
    f.update(); stale(); assert.equal(f.jobs.size, 0); assert.equal(f.view.visible, false)
    f.update({ operation: '' }); f.update(); f.tick(); assert.equal(f.view.visible, true)
  }
})

test('retries with the same operation get their own lifecycle; another operation cannot inherit a pending callback', () => {
  const f = fixture(); f.update(); const stale = [...f.jobs.values()][0]
  f.update({ operation: '' }); f.update(); stale(); assert.equal(f.view.visible, false); assert.equal(f.jobs.size, 1)
  f.tick(); f.update({ operation: 'content-report' }); assert.equal(f.events.at(-1), null)
  f.tick(); assert.equal(f.events.at(-1).key, 'loading.report')
  f.update({ operation: 'chat-send' }); assert.equal(f.events.at(-1), null); assert.equal(f.jobs.size, 0)
})

test('unmount disposes all presentation work without touching an operation or running a cancellation action', () => {
  for (const revealFirst of [false, true]) {
    const f = fixture(); f.update(); const stale = [...f.jobs.values()][0]
    if (revealFirst) f.tick()
    f.view.dispose(); f.view.dispose(); stale(); f.update()
    assert.equal(f.view.visible, false); assert.equal(f.jobs.size, 0)
    assert.equal(f.current.operation, 'content-publish')
  }
})


test('browser timer functions are invoked without the presentation object as their receiver', t => {
  const jobs = new Map(); let id = 0
  t.mock.method(globalThis, 'setTimeout', function (fn) { assert.equal(this, undefined); jobs.set(++id, fn); return id })
  t.mock.method(globalThis, 'clearTimeout', function (key) { assert.equal(this, undefined); jobs.delete(key) })
  const view = new LoadingToastPresentation()
  view.update({ operation: 'content-publish' }); assert.equal(jobs.size, 1)
  view.update({ operation: '' }); assert.equal(jobs.size, 0)
  view.update({ operation: 'content-publish' }); [...jobs.values()][0]()
  assert.equal(view.visible, true); view.dispose(); assert.equal(view.visible, false)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { firstFrameSources, launchRecoveryTarget, prepareFirstFrame } from '../src/services/launch-presentation.js'

function environment() {
  const images = [], frames = new Map(), timers = new Map(); let next = 0
  return { images, frames, timers, fonts: { ready: Promise.resolve(), load: () => Promise.resolve([{}]) },
    imageFactory() { const image = { naturalWidth: 10, removeAttribute() { this.removed = true } }; images.push(image); return image },
    frame(fn) { frames.set(++next, fn); return next }, cancelFrame(id) { frames.delete(id) },
    schedule(fn) { timers.set(++next, fn); return next }, cancel(id) { timers.delete(id) },
    paint() { const [id, fn] = [...frames][0]; frames.delete(id); fn() },
  }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

test('launch waits for every decoded first-frame asset, fonts and two frames, with one bounded deadline', async () => {
  const env = environment(); let decode, font, done = false
  env.fonts.ready = new Promise(resolve => { font = resolve })
  const task = prepareFirstFrame(['one', 'one', 'two'], env).then(() => { done = true })
  assert.equal(env.images.length, 2)
  env.images[0].decode = () => new Promise(resolve => { decode = resolve })
  env.images.forEach(image => image.onload())
  await flush(); assert.equal(env.frames.size, 0)
  decode(); await flush(); assert.equal(env.frames.size, 0)
  font(); await flush(); assert.equal(env.frames.size, 1)
  env.paint(); await flush(); assert.equal(done, false)
  env.paint(); await task
  assert.equal(done, true); assert.equal(env.frames.size, 0); assert.equal(env.timers.size, 0)
  assert.ok(env.images.every(image => !image.onload && !image.onerror))
})

test('cached decoded assets still require the two first-frame paint boundaries', async () => {
  const env = environment(), create = env.imageFactory
  env.imageFactory = () => Object.assign(create(), { complete: true, decode: () => Promise.resolve() })
  const task = prepareFirstFrame(['cached'], env)
  await flush(); assert.equal(env.frames.size, 1)
  env.paint(); env.paint(); await task
  assert.equal(env.timers.size, 0)
})

test('missing images, invalid pixels and decode errors fail immediately without exposing an empty first frame', async () => {
  for (const mode of ['error', 'pixels', 'decode']) {
    const env = environment(), task = prepareFirstFrame(['broken'], env), image = env.images[0]
    if (mode === 'error') image.onerror()
    else { if (mode === 'pixels') image.naturalWidth = 0; else image.decode = () => Promise.reject(new Error('invalid image')); image.onload() }
    await assert.rejects(task, { code: 'RESOURCE_MISSING' })
    assert.equal(env.frames.size, 0); assert.equal(env.timers.size, 0)
  }
})

test('a stalled decode or font has a finite failure and late callbacks cannot acknowledge readiness', async () => {
  for (const phase of ['decode', 'fonts', 'paint']) {
    const env = environment()
    if (phase === 'fonts') env.fonts.ready = new Promise(() => {})
    const task = prepareFirstFrame(['one'], env), image = env.images[0]
    let late
    if (phase === 'decode') image.decode = () => new Promise(resolve => { late = resolve })
    image.onload(); await flush()
    const deadline = [...env.timers.values()][0]; deadline()
    await assert.rejects(task, { code: 'RESOURCE_MISSING' })
    late?.(); await flush()
    assert.equal(env.frames.size, 0); assert.equal(env.timers.size, 0)
  }
})

test('route change, retry or unmount aborts owned decode and either pending paint', async () => {
  for (const phase of [0, 1, 2]) {
    const env = environment(), controller = new AbortController()
    const task = prepareFirstFrame(['one'], { ...env, signal: controller.signal })
    const late = env.images[0].onload
    if (phase > 0) { late(); await flush(); if (phase > 1) env.paint() }
    controller.abort(); await assert.rejects(task, { code: 'CANCELLED' })
    late(); await flush()
    assert.equal(env.frames.size, 0); assert.equal(env.timers.size, 0)
    assert.ok(env.images.every(image => image.removed && !image.onload && !image.onerror))
  }
  const env = environment(), controller = new AbortController(); controller.abort()
  await assert.rejects(prepareFirstFrame(['one'], { ...env, signal: controller.signal }), { code: 'CANCELLED' })
  assert.equal(env.images.length, 0)
})

test('font rejection or synchronous loading failure keeps launch recovery available', async () => {
  for (const synchronous of [true, false]) {
    const env = environment()
    env.fonts.load = () => { if (synchronous) throw new Error('invalid font'); return Promise.reject(new Error('missing font')) }
    const task = prepareFirstFrame([], env)
    await assert.rejects(task, { code: 'RESOURCE_MISSING' })
    assert.equal(env.frames.size, 0); assert.equal(env.timers.size, 0)
  }
})

test('first frame includes brand, home map and visible EULA/route media while excluding offscreen slides', () => {
  const image = (src, rect) => ({ src, getBoundingClientRect: () => rect })
  const inside = { left: 10, top: 20, right: 60, bottom: 70, width: 50, height: 50 }
  const root = { querySelectorAll: () => [image('avatar', inside), image('future-slide', { ...inside, left: 500, right: 550 }), image('hidden', { ...inside, width: 0 })] }
  const page = { querySelectorAll: () => [image('shield', inside), image('avatar', inside)] }
  const options = { document: page, viewport: { width: 390, height: 844 } }
  const sources = firstFrameSources(root, 'home', options)
  assert.ok(sources.includes('/images/launch-logo.png') && sources.includes('/images/p2/empty-background.png'))
  assert.ok(sources.includes('shield') && sources.includes('avatar'))
  assert.ok(!sources.includes('future-slide') && !sources.includes('hidden'))
  assert.equal(sources.filter(src => src === 'avatar').length, 1)
  assert.ok(!firstFrameSources(root, 'welcome', options).includes('/images/p2/empty-background.png'))
})

test('failed bootstrap retry reconciles authentication route without discarding valid destinations', () => {
  const guest = { user: null, consent: false }, member = { user: { id: 'stable' }, consent: true }
  for (const route of [{ name: 'home', meta: { main: true } }, { name: 'profile', meta: { protected: true } }]) assert.deepEqual(launchRecoveryTarget(route, guest), { name: 'welcome' })
  for (const route of [{ name: 'welcome' }, { name: 'login', meta: { auth: true } }, { name: 'basic', meta: { onboarding: true } }]) assert.deepEqual(launchRecoveryTarget(route, member), { name: 'home' })
  assert.equal(launchRecoveryTarget({ name: 'privacy', meta: { legal: true } }, member), null)
  assert.equal(launchRecoveryTarget({ name: 'profile', meta: { protected: true } }, member), null)
  assert.deepEqual(launchRecoveryTarget({ name: 'signup', meta: { auth: true } }, guest), { name: 'welcome' })
  assert.equal(launchRecoveryTarget({ name: 'signup', meta: { auth: true } }, { ...guest, consent: true }), null)
  assert.deepEqual(launchRecoveryTarget({}, guest), { name: 'welcome' })
})

test('early boot preserves native language and launch token, and only covered native launches pause Home', async () => {
  const source = await readFile(new URL('../public/boot.js', import.meta.url), 'utf8')
  for (const [native, token, expected] of [[true, 'current-launch', 'true'], [true, '', undefined], [false, 'browser', undefined]]) {
    const window = { location: { href: 'eluva://app/index.html' + (token ? '?launch=' + token : '') }, __ELUVA_BOOT__: { locale: 'fr' }, ...(native ? { webkit: { messageHandlers: { eluva: {} } } } : {}) }
    const document = { documentElement: { dataset: {} } }
    vm.runInNewContext(source, { window, document, localStorage: { getItem: () => 'en' }, navigator: { languages: ['en'] }, URL })
    assert.equal(document.documentElement.dataset.launchCovered, expected)
    assert.equal(document.documentElement.lang, 'fr'); assert.equal(window.__ELUVA_LOCALE__, 'fr')
    assert.equal(window.__ELUVA_BOOT__.launchId, token || undefined)
  }
})

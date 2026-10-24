import test from 'node:test'
import assert from 'node:assert/strict'
import { installNavigationMotion } from '../src/services/navigation-motion.js'

const pending = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
const route = (path, name = path.split('/').at(-1), meta = {}) => ({
  path, fullPath: path, name, query: {},
  meta: { main: ['home', 'chats', 'mine'].includes(name), ...meta },
})
const home = route('/home', 'home'), profile = route('/profile/peer', 'profile')

class Target {
  listeners = new Map()
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(callback)
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback) }
  dispatchEvent(event) { for (const callback of this.listeners.get(event.type) || []) callback(event) }
  send(type) { this.dispatchEvent({ type }) }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0) }
}

function setup({ capture = true, animate = true, tick = async () => {} } = {}) {
  const page = new Target(), view = new Target(), media = new Target(), viewport = new Target()
  const events = [], transitions = [], animations = [], frames = new Map(), timers = new Map(), hooks = {}
  let serial = 0, owner = 'owner', ready = true, allowed = true, dialog = false, hostPresent = true, current = home, commits = 0
  Object.assign(page, { hidden: false, documentElement: { dataset: {} }, querySelector: () => dialog ? {} : null })
  Object.assign(view, {
    history: { state: { position: 1 } }, visualViewport: viewport,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail } },
    matchMedia: () => media,
    requestAnimationFrame(callback) { const id = ++serial; frames.set(id, callback); return id },
    cancelAnimationFrame(id) { frames.delete(id) },
  })
  media.matches = false
  view.addEventListener('eluva:navigation-motion', event => events.push(event.detail))
  const host = {}
  if (animate) host.animate = (keyframes, options) => {
    const finished = pending()
    const animation = { keyframes, options, finished: finished.promise, cancelCount: 0, cancel() { this.cancelCount++ }, complete: finished.resolve, fail: finished.reject }
    animations.push(animation)
    return animation
  }
  if (capture) page.startViewTransition = callback => {
    const ready = pending(), finished = pending()
    const transition = { callback, ready: ready.promise, finished: finished.promise, captured: ready.resolve, failCapture: ready.reject, complete: finished.resolve, fail: finished.reject, skips: 0, skipTransition() { this.skips++ } }
    transitions.push(transition)
    return transition
  }
  const router = {
    beforeResolve(callback) { hooks.prepare = callback; return () => { delete hooks.prepare } },
    afterEach(callback) { hooks.commit = callback; return () => { delete hooks.commit } },
    onError(callback) { hooks.error = callback; return () => { delete hooks.error } },
  }
  const controller = installNavigationMotion(router, {
    page, view, tick, getHost: () => hostPresent ? host : null,
    ownerId: () => owner, isReady: () => ready, canCapture: () => allowed,
    schedule(callback, delay) { const id = ++serial; timers.set(id, { callback, delay }); return id },
    cancel(id) { timers.delete(id) },
  })
  return {
    page, view, media, viewport, host, events, transitions, animations, frames, timers, hooks, controller,
    begin: (to = profile, from = current) => hooks.prepare(to, from),
    commit(to = profile, from = current, failure) { hooks.commit(to, from, failure); if (!failure) { current = to; commits++ } },
    seed(screen = home) { hooks.commit(screen, route('/', 'launch')); current = screen },
    frame() { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback() },
    timeout(delay) { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.callback() } },
    set owner(value) { owner = value }, set ready(value) { ready = value }, set allowed(value) { allowed = value },
    set dialog(value) { dialog = value }, set hostPresent(value) { hostPresent = value },
    get current() { return current }, get commits() { return commits },
  }
}

function clean(h) {
  assert.deepEqual(h.page.documentElement.dataset, {})
  assert.equal(h.timers.size, 0, 'transition timers must be released')
  assert.equal(h.frames.size, 0, 'paint frames must be released')
}

test('capture releases navigation and completes after the single route commit without a render-frame dependency', async () => {
  const h = setup(); h.seed()
  let released = false
  const guard = h.begin().then(() => { released = true })
  await flush()
  assert.equal(released, false, 'router guard waits until the old view has been captured')
  assert.equal(h.current, home)
  let updateDone = false
  const transition = h.transitions[0], update = transition.callback().then(() => { updateDone = true })
  await guard
  assert.equal(h.current, home, 'snapshot callback must never perform a second route commit')
  assert.equal(h.commits, 0)
  assert.equal(h.frames.size, 0)
  assert.equal(updateDone, false, 'the snapshot callback must wait for the real router commit')
  h.commit()
  await flush()
  assert.equal(h.current, profile)
  assert.equal(h.commits, 1)
  // WebKit suspends rendering inside the snapshot callback. Deliberately never
  // advance a frame: waiting for one here would deadlock until the deadline.
  assert.equal(h.frames.size, 0, 'snapshot capture must not schedule a render frame')
  assert.equal(updateDone, true, 'route commit and Vue flush must release WebKit capture')
  await update
  assert.equal(h.animations.length, 0, 'native compositor snapshots do not animate a live duplicate route')
  transition.complete(); await flush()
  clean(h)
  assert.deepEqual(h.events.map(event => event.phase), ['start', 'commit', 'finish'])
  assert.equal(h.events.at(-1).reason, 'complete')
  assert.equal(transition.skips, 0)
  h.controller.dispose()
})

test('missing snapshot API animates only the new committed host, then releases every resource', async () => {
  const h = setup({ capture: false }); h.seed()
  await h.begin()
  assert.equal(h.animations.length, 0)
  h.commit(); await flush()
  assert.equal(h.frames.size, 1, 'the live-host fallback still waits for its first paint')
  assert.equal(h.animations.length, 0)
  h.frame(); await flush()
  assert.equal(h.animations.length, 1)
  assert.equal(h.animations[0].options.duration, 360)
  assert.equal(h.animations[0].options.fill, 'none')
  assert.equal(h.animations[0].keyframes.at(-1).transform, 'none')
  h.animations[0].complete(); await flush()
  clean(h)
  assert.equal(h.animations[0].cancelCount, 1)
  h.controller.dispose()
})

test('snapshot exceptions fall back without preventing route completion', async () => {
  const h = setup(); h.seed()
  h.page.startViewTransition = () => { throw new Error('capture unavailable') }
  await h.begin(); h.commit(); await flush(); h.frame(); await flush()
  assert.equal(h.page.documentElement.dataset.navigationMode, 'fallback')
  assert.equal(h.animations.length, 1)
  h.animations[0].complete(); await flush(); clean(h)
  h.controller.dispose()
})

test('missing or throwing host animation API has a clean immediate fallback', async () => {
  for (const throwing of [false, true]) {
    const h = setup({ capture: false, animate: false }); h.seed()
    if (throwing) h.host.animate = () => { throw new Error('animation unavailable') }
    await h.begin(); h.commit(); await flush(); h.frame(); await flush()
    assert.equal(h.current, profile)
    assert.equal(h.events.at(-1).reason, 'unsupported')
    clean(h); h.controller.dispose()
  }
})

test('capture rejection, capture timeout, and deadline always release the router guard', async () => {
  for (const failure of ['ready', 'finished', 'capture-timeout', 'timeout']) {
    const h = setup(); h.seed()
    const guard = h.begin(); await flush()
    const transition = h.transitions[0]
    if (failure === 'ready') transition.failCapture(new Error('skip capture'))
    else if (failure === 'finished') transition.fail(new Error('failed transition'))
    else h.timeout(failure === 'timeout' ? 1200 : 200)
    await guard; await flush()
    clean(h)
    assert.equal(transition.skips, 1)
    assert.equal(h.events.at(-1).reason, failure === 'ready' || failure === 'finished' ? 'capture-skipped' : failure)
    // A late native completion must not restore attributes or emit another finish.
    transition.complete(); transition.captured(); await transition.callback(); await flush()
    assert.equal(h.events.filter(event => event.phase === 'finish').length, 1)
    clean(h); h.controller.dispose()
  }
})

test('cancelled guards and router errors restore interaction without committing cancelled destinations', async () => {
  for (const error of [false, true]) {
    const h = setup(); h.seed()
    const guard = h.begin(); await flush()
    if (error) h.hooks.error(new Error('guard failed'))
    else h.commit(profile, home, new Error('guard cancelled'))
    await guard; await flush(); clean(h)
    assert.equal(h.current, home)
    assert.equal(h.commits, 0)
    assert.equal(h.events.at(-1).reason, error ? 'navigation-error' : 'navigation-cancelled')
    h.controller.dispose()
  }
})

test('rapid navigation supersedes pending captures and ignores stale completion callbacks', async () => {
  const h = setup(); h.seed()
  const first = h.begin(); await flush()
  const secondPage = route('/settings', 'settings'), second = h.begin(secondPage, home)
  await flush(); await first
  assert.equal(h.transitions.length, 2)
  assert.equal(h.transitions[0].skips, 1)
  await h.transitions[0].callback(); h.transitions[0].complete(); await flush()
  assert.equal(h.page.documentElement.dataset.navigationMotion, 'push')
  assert.equal(h.events.filter(event => event.phase === 'finish').length, 1)
  const update = h.transitions[1].callback(); await second
  h.commit(secondPage, home); await flush()
  assert.equal(h.frames.size, 0)
  await update
  h.transitions[1].complete(); await flush()
  clean(h)
  assert.equal(h.commits, 1)
  assert.equal(h.events.filter(event => event.phase === 'finish').length, 2)
  h.controller.dispose()
})

test('a newer no-motion navigation invalidates an older guard still awaiting Vue tick', async () => {
  const tick = pending(), h = setup({ tick: () => tick.promise }); h.seed()
  const first = h.begin(); await flush()
  assert.equal(h.transitions.length, 0)
  const queryHome = { ...home, fullPath: '/home?focus=card' }
  await h.begin(queryHome, home); h.commit(queryHome, home)
  tick.resolve(); await first; await flush()
  assert.equal(h.transitions.length, 0, 'stale preparation must not snapshot the newer route')
  assert.equal(h.events.length, 0)
  clean(h); h.controller.dispose()
})

test('interruptions during Vue tick cannot start a late transition', async () => {
  for (const interruption of ['reset', 'dispose', 'hidden', 'resize', 'reduced', 'error']) {
    const tick = pending(), h = setup({ tick: () => tick.promise }); h.seed()
    const guard = h.begin(); await flush()
    if (interruption === 'reset') h.controller.reset()
    if (interruption === 'dispose') h.controller.dispose()
    if (interruption === 'hidden') { h.page.hidden = true; h.page.send('visibilitychange'); h.page.hidden = false }
    if (interruption === 'resize') h.view.send('resize')
    if (interruption === 'reduced') { h.media.matches = true; h.media.send('change'); h.media.matches = false }
    if (interruption === 'error') h.hooks.error(new Error('guard error'))
    tick.resolve(); await guard; await flush()
    assert.equal(h.transitions.length, 0, interruption)
    clean(h); h.controller.dispose()
  }
})

test('hidden, viewport resize, and reduced-motion changes cancel active capture and pending paint', async () => {
  for (const capture of [true, false]) {
    for (const interruption of ['hidden', 'resize', 'visualViewport', 'reduced']) {
      const h = setup({ capture }); h.seed()
      const guard = h.begin(); await flush()
      let updateDone = !capture
      const update = capture ? h.transitions[0].callback().then(() => { updateDone = true }) : Promise.resolve()
      await guard
      h.commit(); await flush()
      assert.equal(h.frames.size, capture ? 0 : 1)
      assert.equal(updateDone, true, 'WebKit capture must finish its callback even while rendering is suspended')
      if (interruption === 'hidden') { h.page.hidden = true; h.page.send('visibilitychange') }
      if (interruption === 'resize') h.view.send('resize')
      if (interruption === 'visualViewport') h.viewport.send('resize')
      if (interruption === 'reduced') { h.media.matches = true; h.media.send('change') }
      await update; await flush(); clean(h)
      if (capture) assert.equal(h.transitions[0].skips, 1)
      else assert.equal(h.animations.length, 0, 'cancelled fallback paint must never animate')
      h.controller.dispose()
    }
  }
})

test('fallback cancellation and rejection leave no animation or deadline behind', async () => {
  for (const reject of [false, true]) {
    const h = setup({ capture: false }); h.seed()
    await h.begin(); h.commit(); await flush(); h.frame(); await flush()
    if (reject) h.animations[0].fail(new Error('animation cancelled'))
    else h.controller.reset()
    await flush(); clean(h)
    assert.equal(h.animations[0].cancelCount, 1)
    assert.equal(h.events.at(-1).reason, reject ? 'interrupted' : 'account-changed')
    h.controller.dispose()
  }
})

test('initial launch, continuous auth, unready pages, dialogs, and reduced motion do not animate', async () => {
  const h = setup()
  await h.begin(home, route('/', 'launch'))
  assert.equal(h.transitions.length, 0)
  const welcome = route('/welcome', 'welcome', { authFlow: true }), email = route('/auth/signup', 'signup', { authFlow: true })
  h.seed(welcome); await h.begin(email, welcome)
  assert.equal(h.transitions.length, 0)
  h.seed(home)
  for (const condition of ['ready', 'host', 'hidden', 'reduced', 'dialog', 'capture']) {
    h.ready = condition !== 'ready'; h.hostPresent = condition !== 'host'
    h.page.hidden = condition === 'hidden'; h.media.matches = condition === 'reduced'
    h.dialog = condition === 'dialog'; h.allowed = condition !== 'capture'
    await h.begin(profile, home)
    assert.equal(h.transitions.length, 0, condition)
    clean(h)
  }
  h.controller.dispose()
})

test('camera routes avoid compositor capture while retaining the lightweight committed-host fallback', async () => {
  const h = setup(); h.seed()
  const call = route('/call/peer', 'videoCall')
  await h.begin(call, home); h.commit(call, home); await flush(); h.frame(); await flush()
  assert.equal(h.transitions.length, 0)
  assert.equal(h.animations[0].options.duration, 200)
  assert.equal(h.animations[0].keyframes[0].transform, 'none')
  h.animations[0].complete(); await flush(); clean(h)
  h.controller.dispose()
})

test('account reset discards the old route trail and dispose detaches every controller listener', async () => {
  const h = setup(); h.seed()
  const guard = h.begin(); await flush()
  h.owner = 'next-owner'; h.controller.reset(); await guard
  clean(h)
  await h.begin(route('/mine', 'mine'), home)
  assert.equal(h.transitions.length, 1, 'first destination of another account never captures the previous account')
  h.controller.dispose()
  assert.deepEqual(h.hooks, {})
  assert.equal(h.page.listenerCount, 0)
  assert.equal(h.media.listenerCount, 0)
  assert.equal(h.viewport.listenerCount, 0)
  assert.equal(h.view.listenerCount, 1, 'only the test observer remains')
  const count = h.events.length
  h.page.hidden = true; h.page.send('visibilitychange'); h.view.send('resize'); h.viewport.send('resize')
  h.media.matches = true; h.media.send('change')
  assert.equal(h.events.length, count)
  clean(h)
})

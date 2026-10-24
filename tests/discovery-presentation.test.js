import test from 'node:test'
import assert from 'node:assert/strict'
import { DiscoveryPresentation } from '../src/services/discovery-presentation.js'

const posts = (...ids) => ids.map(id => ({ id, body: `Post ${id}` }))
const ids = items => items.map(item => typeof item === 'string' ? item : item.id)
function fixture() {
  const pending = new Map(), frames = [], delays = []
  let id = 0
  const presentation = new DiscoveryPresentation({
    changed: state => frames.push(state),
    schedule: (fn, ms) => { pending.set(++id, fn); delays.push(ms); return id },
    cancel: key => pending.delete(key),
  })
  const tick = () => {
    const [key, fn] = [...pending][0] || []
    assert.ok(fn, 'one presentation step is scheduled')
    pending.delete(key)
    fn()
  }
  return { p: presentation, pending, frames, delays, tick }
}

test('one real match lights each step and prepends its post; the last match finishes first in the list', () => {
  const { p, frames, pending, delays, tick } = fixture()
  const token = p.start()
  assert.equal(p.state.phase, 'searching')
  assert.equal(pending.size, 0, 'reading is not replaced by a timer')
  p.resolve(posts('one', 'two', 'three'), { token })
  assert.equal(p.state.activeId, 'one')
  assert.deepEqual(ids(p.state.items), ['one'])
  tick()
  assert.equal(p.state.activeId, 'two')
  assert.deepEqual(ids(p.state.items), ['two', 'one'])
  tick()
  assert.equal(p.state.phase, 'settling')
  assert.equal(p.state.activeId, 'three')
  assert.deepEqual(p.state.litIds, ['one', 'two', 'three'])
  assert.deepEqual(ids(p.state.items), ['three', 'two', 'one'])
  tick()
  assert.deepEqual(p.state, { phase: 'idle', items: posts('three', 'two', 'one'), activeId: null, litIds: [], busy: false })
  assert.deepEqual(delays, [420, 420, 260])
  assert.equal(pending.size, 0)
  const litFrames = frames.filter(frame => frame.activeId)
  assert.ok(litFrames.every(frame => frame.items.length === frame.litIds.length))
})

test('only valid stable matches are shown, deduplicated and capped at five; empty results invent no lights', () => {
  const { p, pending, frames, tick } = fixture()
  p.start()
  p.resolve([null, {}, { id: 3 }, ...posts('a', 'a', 'b', 'c', 'd', 'e', 'f')])
  while (pending.size) tick()
  assert.deepEqual(ids(p.state.items), ['e', 'd', 'c', 'b', 'a'])
  p.start()
  const before = frames.length
  p.resolve([])
  assert.equal(pending.size, 0)
  assert.deepEqual(p.state.items, [])
  assert.equal(p.state.phase, 'idle')
  assert.ok(frames.slice(before).every(frame => frame.activeId === null && frame.litIds.length === 0))
})

test('refresh keeps existing posts while reading and restores that exact order on failure or cancellation', () => {
  const { p, pending } = fixture()
  p.hydrate(posts('old-first', 'old-second'))
  const token = p.start()
  assert.deepEqual(ids(p.state.items), ['old-first', 'old-second'])
  assert.equal(pending.size, 0)
  p.resolve(posts('new-first', 'new-second'), { token })
  assert.deepEqual(ids(p.state.items), ['new-first'])
  p.fail({ token })
  assert.deepEqual(ids(p.state.items), ['old-first', 'old-second'])
  assert.equal(p.state.busy, false)
  assert.equal(pending.size, 0)
  p.start(); p.cancel()
  assert.deepEqual(ids(p.state.items), ['old-first', 'old-second'])
})

test('duplicate starts and results never create parallel clocks, and cancelled reads or callbacks cannot replace later data', () => {
  const { p, pending, tick } = fixture()
  const oldToken = p.start(posts('original'))
  assert.equal(p.start(posts('ignored')), oldToken)
  p.resolve(posts('a', 'b'), { token: oldToken })
  assert.equal(p.resolve(posts('duplicate'), { token: oldToken }), false)
  const stale = [...pending.values()][0]
  p.cancel()
  const token = p.start()
  assert.equal(p.resolve(posts('late'), { token: oldToken }), false)
  assert.equal(p.fail({ token: oldToken }), false)
  p.resolve(posts('current', 'latest'), { token })
  stale()
  assert.deepEqual(ids(p.state.items), ['current'])
  assert.equal(pending.size, 1)
  tick(); tick()
  assert.deepEqual(ids(p.state.items), ['latest', 'current'])
})

test('background and modal holds independently pause the single clock and reject already queued work', () => {
  const { p, pending, tick } = fixture()
  p.start(); p.resolve(posts('a', 'b', 'c'))
  const stale = [...pending.values()][0]
  p.hold('background', true)
  p.hold('modal', true)
  p.hold('background', false)
  stale()
  assert.deepEqual(ids(p.state.items), ['a'])
  assert.equal(pending.size, 0)
  p.hold('modal', false)
  assert.equal(pending.size, 1)
  p.hold('modal', false)
  assert.equal(pending.size, 1)
  tick()
  assert.deepEqual(ids(p.state.items), ['b', 'a'])
})

test('a read completed in the background waits for visibility before its first light and resumes settling safely', () => {
  const { p, pending, tick } = fixture()
  p.start()
  p.hold('background', true)
  p.resolve(posts('only'))
  assert.equal(p.state.activeId, null)
  assert.deepEqual(p.state.litIds, [])
  assert.equal(pending.size, 0)
  p.hold('background', false)
  tick()
  assert.equal(p.state.activeId, 'only')
  assert.equal(p.state.phase, 'settling')
  p.hold('modal', true)
  assert.equal(pending.size, 0)
  p.hold('modal', false)
  tick()
  assert.equal(p.state.phase, 'idle')
  assert.deepEqual(ids(p.state.items), ['only'])
  assert.deepEqual(p.state.litIds, [])
})

test('reduced motion and finish immediately settle actual results without inventing data during a read', () => {
  const { p, pending } = fixture()
  p.hydrate(posts('existing'))
  p.start(); p.finish()
  assert.equal(p.state.phase, 'searching')
  assert.deepEqual(ids(p.state.items), ['existing'])
  p.resolve(posts('a', 'b'))
  assert.equal(p.state.phase, 'idle')
  assert.deepEqual(ids(p.state.items), ['b', 'a'])
  assert.equal(pending.size, 0)
  p.start(); p.resolve(posts('c', 'd', 'e'))
  p.reduceMotion(true)
  assert.deepEqual(ids(p.state.items), ['e', 'd', 'c'])
  assert.equal(pending.size, 0)
  p.start(); p.resolve(posts('f', 'g'))
  assert.deepEqual(ids(p.state.items), ['g', 'f'])
  assert.equal(pending.size, 0)
  p.reduceMotion(false)
  p.start(); p.resolve(posts('h', 'i'), { immediate: true })
  assert.deepEqual(ids(p.state.items), ['i', 'h'])
  assert.equal(pending.size, 0)
})

test('hydration preserves order, invalidates an old read and exposes stable independent frame arrays', () => {
  const { p, frames, pending } = fixture()
  const token = p.start()
  p.hydrate(posts('first', 'second'))
  assert.equal(p.resolve(posts('stale'), { token }), false)
  assert.deepEqual(ids(p.state.items), ['first', 'second'])
  frames.at(-1).items.push({ id: 'changed-outside' })
  frames.at(-1).litIds.push('changed-outside')
  assert.deepEqual(ids(p.state.items), ['first', 'second'])
  assert.deepEqual(p.state.litIds, [])
  assert.equal(pending.size, 0)
})

test('leaving and disposal remove all timing work; late callbacks and all future operations are inert', () => {
  const { p, pending, frames } = fixture()
  const token = p.start(posts('previous'))
  p.resolve(posts('a', 'b'), { token })
  const stale = [...pending.values()][0]
  p.dispose()
  const count = frames.length
  stale(); p.start(); p.resolve(posts('late')); p.fail(); p.finish(); p.hydrate(posts('late')); p.reduceMotion(true); p.hold('modal', false); p.cancel(); p.dispose()
  assert.equal(frames.length, count)
  assert.equal(pending.size, 0)
  assert.deepEqual(ids(p.state.items), ['previous'])
  assert.equal(p.state.busy, false)
})

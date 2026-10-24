import test from 'node:test'
import assert from 'node:assert/strict'
import { createWelcomeRelay } from '../src/domain/welcome-relay.js'

const visible = { prepared: true, covered: false, hidden: false, modal: false, style: 'full', eligible: true }

test('welcome waits for a prepared visible page without an active cover, modal or background interval', () => {
  for (const gate of [{ prepared: false }, { covered: true }, { hidden: true }, { modal: true }]) {
    const relay = createWelcomeRelay()
    for (const now of [0, 5000]) {
      assert.deepEqual(relay.update({ ...visible, ...gate }, now), { phase: 'waiting', paused: true, held: true, elapsed: 0 })
    }
    assert.deepEqual(relay.update(visible, 5001), { phase: 'receiving', paused: false, held: true, elapsed: 0 })
    assert.equal(relay.update(visible, 5320).held, true)
    assert.deepEqual(relay.update(visible, 5321), { phase: 'done', paused: false, held: false, elapsed: 320 })
  }
})

test('prepared and native-cover notifications may arrive in either order without releasing the first bubble early', () => {
  for (const states of [
    [{ prepared: false, covered: true }, { prepared: true, covered: true }],
    [{ prepared: false, covered: true }, { prepared: false, covered: false }],
  ]) {
    const relay = createWelcomeRelay()
    states.forEach((state, index) => assert.equal(relay.update({ ...visible, ...state }, index * 1000).phase, 'waiting'))
    assert.equal(relay.update(visible, 2000).phase, 'receiving')
    assert.equal(relay.update(visible, 2319).held, true)
    assert.equal(relay.update(visible, 2320).held, false)
  }
})

test('a full handoff counts active presentation time and resumes after EULA, background or cover interruptions', () => {
  for (const interruption of [{ modal: true }, { hidden: true }, { covered: true }, { prepared: false }]) {
    const relay = createWelcomeRelay()
    relay.update(visible, 10)
    assert.equal(relay.update(visible, 110).elapsed, 100)
    assert.deepEqual(relay.update({ ...visible, ...interruption }, 120), { phase: 'receiving', paused: true, held: true, elapsed: 100 })
    assert.equal(relay.update({ ...visible, ...interruption }, 9000).elapsed, 100)
    assert.deepEqual(relay.update(visible, 9100), { phase: 'receiving', paused: false, held: true, elapsed: 100 })
    assert.equal(relay.update(visible, 9319).elapsed, 319)
    assert.deepEqual(relay.update(visible, 9320), { phase: 'done', paused: false, held: false, elapsed: 320 })
  }
})

test('brief and reduced-motion arrivals skip avatar animation only after the page becomes usable', () => {
  for (const setting of [{ style: 'brief' }, { style: 'reduced' }, { reduced: true }]) {
    const relay = createWelcomeRelay()
    assert.equal(relay.update({ ...visible, ...setting, modal: true }, 0).phase, 'waiting')
    assert.equal(relay.update({ ...visible, ...setting, covered: true }, 5000).held, true)
    assert.deepEqual(relay.update({ ...visible, ...setting }, 5001), { phase: 'done', paused: false, held: false, elapsed: 0 })
    assert.equal(relay.update(visible, 10000).phase, 'done')
  }
  const relay = createWelcomeRelay()
  relay.update(visible, 0)
  relay.update(visible, 100)
  assert.deepEqual(relay.update({ ...visible, reduced: true }, 150), { phase: 'done', paused: false, held: false, elapsed: 100 })
})

test('restored conversation history and direct authentication routes do not replay a welcome handoff', () => {
  const relay = createWelcomeRelay()
  assert.deepEqual(relay.update({ ...visible, eligible: false, covered: true }, 0), { phase: 'done', paused: true, held: true, elapsed: 0 })
  assert.deepEqual(relay.update({ ...visible, eligible: false }, 1000), { phase: 'done', paused: false, held: false, elapsed: 0 })
  assert.equal(relay.update(visible, 2000).phase, 'done')
  assert.equal(relay.update(visible, 5000).elapsed, 0)
})

test('completed handoff stays terminal while later modal and visibility gates still protect conversation input', () => {
  const relay = createWelcomeRelay()
  relay.update(visible, 0)
  assert.equal(relay.update(visible, 320).held, false)
  assert.deepEqual(relay.update({ ...visible, modal: true }, 400), { phase: 'done', paused: true, held: true, elapsed: 320 })
  assert.deepEqual(relay.update({ ...visible, hidden: true }, 5000), { phase: 'done', paused: true, held: true, elapsed: 320 })
  assert.deepEqual(relay.update(visible, 5100), { phase: 'done', paused: false, held: false, elapsed: 320 })
  assert.deepEqual(relay.update(visible, 10000), { phase: 'done', paused: false, held: false, elapsed: 320 })
})

test('duplicate or backward clock samples cannot reverse animation progress or create negative elapsed time', () => {
  const relay = createWelcomeRelay()
  relay.update(visible, 100)
  assert.equal(relay.update(visible, 200).elapsed, 100)
  for (const now of [200, 150, 150]) {
    assert.deepEqual(relay.update(visible, now), { phase: 'receiving', paused: false, held: true, elapsed: 100 })
  }
  assert.equal(relay.update(visible, 250).elapsed, 200)
  assert.deepEqual(relay.update(visible, 10000), { phase: 'done', paused: false, held: false, elapsed: 320 })
})

test('separate welcome lifecycles keep independent progress and honor their configured handoff duration', () => {
  const first = createWelcomeRelay({ duration: 80 }), second = createWelcomeRelay({ duration: 80 })
  first.update(visible, 0)
  assert.equal(first.update(visible, 79).held, true)
  assert.equal(first.update(visible, 80).held, false)
  assert.deepEqual(second.update(visible, 1000), { phase: 'receiving', paused: false, held: true, elapsed: 0 })
  assert.equal(second.update(visible, 1080).phase, 'done')
})

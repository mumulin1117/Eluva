import test from 'node:test'
import assert from 'node:assert/strict'
import { paintLoading, createLoadingPace, prepareLoadingImages } from '../src/services/loading-presentation.js'

function frames() {
  const jobs = new Map(); let id = 0
  return { jobs, frame: fn => { jobs.set(++id, fn); return id }, cancelFrame: id => jobs.delete(id), tick() { const [id, fn] = [...jobs][0]; jobs.delete(id); fn() } }
}
function pictures() {
  const images = [], timers = new Map(); let id = 0
  return { images, timers, imageFactory() { const image = { removeAttribute() { this.detached = true } }; images.push(image); return image }, schedule(fn) { timers.set(++id, fn); return id }, cancel(id) { timers.delete(id) } }
}

function clock() {
  let time = 0, id = 0
  const timers = new Map(), delays = []
  return { timers, delays, now: () => time, advance: ms => { time += ms }, schedule(fn, ms) { delays.push(ms); timers.set(++id, fn); return id }, cancel: id => timers.delete(id), tick() { const [id, fn] = [...timers][0]; timers.delete(id); fn() } }
}

test('fast successful reads retain one continuous second of skeleton, counting time already spent reading', async () => {
  const timer = clock(), pace = createLoadingPace(undefined, timer)
  timer.advance(180)
  let revealed = false
  const first = pace.finish(); assert.equal(pace.finish(), first)
  first.then(() => { revealed = true })
  await Promise.resolve(); assert.equal(revealed, false)
  assert.deepEqual(timer.delays, [820]); assert.equal(timer.timers.size, 1)
  timer.tick(); await first
  assert.equal(revealed, true); assert.equal(timer.timers.size, 0)
  pace.cancel(); assert.equal(pace.finish(), first)
})

test('slow reads and image preparation consume the same floor without another fixed wait afterward', async () => {
  const timer = clock(), pace = createLoadingPace(undefined, timer)
  timer.advance(1400); await pace.finish()
  assert.deepEqual(timer.delays, []); assert.equal(timer.timers.size, 0)
})

test('failure can cancel pacing immediately before success, without scheduling a cosmetic wait', async () => {
  const timer = clock(), controller = new AbortController(), pace = createLoadingPace(controller.signal, timer)
  timer.advance(25); pace.cancel(); pace.cancel()
  assert.equal(timer.timers.size, 0)
  await assert.rejects(pace.finish(), { code: 'CANCELLED' })
  controller.abort(); assert.deepEqual(timer.delays, [])
})

test('leaving or switching targets cancels an active remainder and ignores its queued callback', async () => {
  for (const cancelBySignal of [true, false]) {
    const timer = clock(), controller = new AbortController(), pace = createLoadingPace(controller.signal, timer)
    timer.advance(50); const done = pace.finish(), late = [...timer.timers.values()][0]
    if (cancelBySignal) controller.abort(); else pace.cancel()
    await assert.rejects(done, { code: 'CANCELLED' }); assert.equal(timer.timers.size, 0)
    late(); await assert.rejects(pace.finish(), { code: 'CANCELLED' })
  }
})

test('an aborted entry never allocates a pace timer and zero duration stays immediate', async () => {
  const timer = clock(), controller = new AbortController(); controller.abort()
  await assert.rejects(createLoadingPace(controller.signal, timer).finish(), { code: 'CANCELLED' })
  await createLoadingPace(undefined, { ...timer, minimumMs: 0 }).finish()
  assert.deepEqual(timer.delays, [])
})

test('a fast read gets a painted skeleton frame without a minimum-duration timer', async () => {
  const queue = frames(); let done = false
  const job = paintLoading(undefined, queue).then(() => { done = true })
  queue.tick(); await Promise.resolve(); assert.equal(done, false)
  queue.tick(); await job; assert.equal(done, true); assert.equal(queue.jobs.size, 0)
})

test('leaving before either frame cancels pending visual work', async () => {
  for (const before of [0, 1]) {
    const queue = frames(), controller = new AbortController()
    const job = paintLoading(controller.signal, queue)
    if (before) queue.tick()
    controller.abort()
    await assert.rejects(job, { code: 'CANCELLED' }); assert.equal(queue.jobs.size, 0)
  }
})

test('first-screen images deduplicate and wait for successful decode, then release all hooks', async () => {
  const factory = pictures(); let decode
  const job = prepareLoadingImages(['one', null, 'one', 'two', ''], factory)
  factory.images[0].decode = () => new Promise(resolve => { decode = resolve })
  factory.images[0].onload(); factory.images[1].onerror()
  assert.equal(factory.timers.size, 1)
  decode(); await job
  assert.equal(factory.images.length, 2); assert.equal(factory.timers.size, 0)
  assert.ok(factory.images.every(image => !image.onload && !image.onerror))
})

test('broken images, rejected decodes and unsupported decoding fall back without a false data failure', async () => {
  const factory = pictures()
  const job = prepareLoadingImages(['missing', 'invalid', 'compatible'], factory)
  factory.images[0].onerror()
  factory.images[1].decode = () => Promise.reject(new Error('Unsupported format'))
  factory.images[1].onload(); factory.images[2].onload()
  await job; assert.equal(factory.timers.size, 0)
})

test('a stalled image or decode has one bounded recovery deadline', async () => {
  const factory = pictures()
  const job = prepareLoadingImages(['slow', 'never-decoded'], factory)
  factory.images[1].decode = () => new Promise(() => {})
  factory.images[1].onload()
  assert.equal(factory.timers.size, 1)
  const late = factory.images[0].onload
  ;[...factory.timers.values()][0]()
  await job; late()
  assert.equal(factory.timers.size, 0)
  assert.ok(factory.images.every(image => !image.onload && !image.onerror))
})

test('account or route cancellation rejects once and detaches owned images', async () => {
  const factory = pictures(), controller = new AbortController()
  const job = prepareLoadingImages(['one', 'two'], { ...factory, signal: controller.signal })
  const late = factory.images[0].onerror
  controller.abort(); late()
  await assert.rejects(job, { code: 'CANCELLED' })
  assert.ok(factory.images.every(image => image.detached)); assert.equal(factory.timers.size, 0)
})

test('empty preparation finishes immediately and an already-cancelled page creates no work', async () => {
  const factory = pictures(), controller = new AbortController()
  await prepareLoadingImages([], factory)
  controller.abort()
  await assert.rejects(prepareLoadingImages(['one'], { ...factory, signal: controller.signal }), { code: 'CANCELLED' })
  await assert.rejects(paintLoading(controller.signal, frames()), { code: 'CANCELLED' })
  assert.equal(factory.images.length, 0); assert.equal(factory.timers.size, 0)
})

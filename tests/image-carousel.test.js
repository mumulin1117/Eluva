import test from 'node:test'
import assert from 'node:assert/strict'
import { ImageCarousel } from '../src/services/image-carousel.js'

function fixture() {
  const pending = new Map(), frames = []
  let id = 0
  const carousel = new ImageCarousel({ changed: i => frames.push(i), schedule: fn => { pending.set(++id, fn); return id }, cancel: key => pending.delete(key) })
  const tick = () => { const [key, fn] = [...pending][0] || []; assert.ok(fn); pending.delete(key); fn() }
  carousel.items(['one', 'two', 'three'])
  return { carousel, pending, frames, tick }
}
test('carousel cycles in original order with one clock; manual selections restart the full interval', () => {
  const { carousel: c, pending, tick } = fixture()
  assert.equal(pending.size, 0)
  c.hold('offscreen', false)
  tick(); assert.equal(c.index, 1)
  c.select(2); assert.equal(pending.size, 1)
  tick(); assert.equal(c.index, 0)
  c.select(-1); assert.equal(c.index, 2)
  assert.equal(pending.size, 1)
})
test('touch, modal, background, reduced motion and focus gates remain independent; stale callbacks cannot advance', () => {
  const { carousel: c, pending, tick } = fixture()
  c.hold('offscreen', false)
  const stale = [...pending.values()][0]
  c.hold('touch', true); c.hold('modal', true); c.hold('touch', false)
  stale(); assert.equal(c.index, 0); assert.equal(pending.size, 0)
  c.hold('modal', false); assert.equal(pending.size, 1)
  for (const reason of ['background', 'pagehide', 'reduced-motion', 'focus', 'paused', 'loading', 'failed']) {
    c.hold(reason, true); assert.equal(pending.size, 0)
    c.hold(reason, false); assert.equal(pending.size, 1)
  }
  tick(); assert.equal(c.index, 1)
})
test('a media refresh preserves the selected stable ID; empty/single images stop and manual controls still work with reduced motion', () => {
  const { carousel: c, pending } = fixture()
  c.hold('offscreen', false); c.select(1)
  c.items(['zero', 'one', 'two', 'three']); assert.equal(c.index, 2)
  c.hold('reduced-motion', true); c.select(3); assert.equal(c.index, 3); assert.equal(pending.size, 0)
  c.items(['one']); assert.equal(c.index, 0); assert.equal(pending.size, 0)
  c.items([]); c.select(1); assert.equal(c.index, 0); assert.equal(pending.size, 0)
})
test('leaving the page clears the clock and rejects late automatic or manual work', () => {
  const { carousel: c, pending, frames } = fixture()
  c.hold('offscreen', false)
  const stale = [...pending.values()][0], before = [...frames]
  c.dispose(); c.hold('offscreen', false); c.select(1); stale()
  assert.equal(pending.size, 0); assert.deepEqual(frames, before)
})

test('detail clock uses two seconds while ordinary profile carousel retains four seconds',()=>{
 const delays=[],detail=new ImageCarousel({delay:2000,changed:()=>{},schedule:(_,ms)=>{delays.push(ms);return delays.length},cancel:()=>{}})
 detail.items(['a','b']);detail.hold('offscreen',false);detail.select(1);assert.deepEqual(delays,[2000,2000]);detail.dispose()
 const defaults=[],profile=new ImageCarousel({changed:()=>{},schedule:(_,ms)=>{defaults.push(ms);return 1},cancel:()=>{}});profile.items(['a','b']);profile.hold('offscreen',false);assert.deepEqual(defaults,[4000]);profile.dispose()
})

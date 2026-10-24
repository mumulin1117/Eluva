import test from 'node:test'
import assert from 'node:assert/strict'
import { layoutDiscoverySignals, signalColor } from '../src/services/discovery-signals.js'

const realControls = (width, height) => [
  { x: width - 142, y: 10, width: 104, height: 140 },
  { x: 25, y: height - 160, width: 131, height: 130 },
  { x: 12, y: height - 45, width: 225, height: 44 },
]

function assertSafe(points, width, height, avoid) {
  for (const point of points) {
    assert.ok(point.x >= 32 && point.x <= width - 32, '52px lamp leaves 6px horizontal edge clearance')
    assert.ok(point.y >= 34 && point.y <= height - 34, '56px lamp leaves 6px vertical edge clearance')
    for (const rect of avoid) {
      assert.ok(point.x <= rect.x - 32 || point.x >= rect.x + rect.width + 32
        || point.y <= rect.y - 34 || point.y >= rect.y + rect.height + 34, 'lamp clears actual controls by 6px')
    }
  }
  for (let index = 0; index < points.length; index++) {
    for (const other of points.slice(index + 1)) {
      assert.ok(Math.abs(points[index].x - other.x) >= 58 || Math.abs(points[index].y - other.y) >= 62, 'lamp artwork never overlaps another lamp')
    }
  }
}

test('five lamps spread across common map bounds while avoiding share, avatar and count controls', () => {
  for (const [width, height] of [[304, 330], [359, 330], [359, 355], [374, 355], [377, 360], [414, 370]]) {
    const avoid = realControls(width, height)
    const points = layoutDiscoverySignals({ width, height, avoid })
    assert.equal(points.length, 5, `${width}×${height} retains five genuine signals`)
    assertSafe(points, width, height, avoid)
    assert.ok(Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)) > width * .7, 'signals occupy more horizontal space than the old 62% diagonal')
    assert.ok(Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)) > height * .7, 'signals occupy more vertical space than the old 64% diagonal')
  }
})

test('layout is deterministic across calls, obstacle order and independent returned objects', () => {
  const avoid = realControls(374, 355), before = structuredClone(avoid)
  const first = layoutDiscoverySignals({ width: 374, height: 355, avoid })
  assert.deepEqual(first, layoutDiscoverySignals({ width: 374, height: 355, avoid }))
  assert.deepEqual(first, layoutDiscoverySignals({ width: 374, height: 355, avoid: [...avoid].reverse() }))
  assert.deepEqual(avoid, before)
  first[0].x = -200
  assert.ok(layoutDiscoverySignals({ width: 374, height: 355, avoid })[0].x >= 32)
})

test('all five signals fit the measured map with a language-independent full-width count exclusion', () => {
  for (const width of [304, 359, 374, 377, 414]) {
    const height = 333, avoid = [
      { x: width - 160, y: 16, width: 104, height: 140 },
      { x: 16, y: 180, width: 131, height: 130 },
      { x: 0, y: 290, width, height: 44 },
    ]
    const points = layoutDiscoverySignals({ width, height, avoid })
    assert.equal(points.length, 5, `${width}px map keeps five safe positions above the entire count bar`)
    assertSafe(points, width, height, avoid)
    assert.ok(Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)) >= width - 64, 'signals use the full safe horizontal span')
    assert.ok(Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)) >= 222, 'signals use the full vertical space left above the count controls')
  }
})

test('short-screen 280px map fits five signals around the actual avatar artwork and count row', () => {
  for (const [width, shareX] of [[304, 193], [359, 193], [359, 248]]) {
    const height = 268, avoid = [
      { x: shareX, y: 0, width: 104, height: 122 },
      { x: 78, y: 60, width: 70, height: 70 },
      { x: 0, y: 134, width, height: 44 },
    ]
    const points = layoutDiscoverySignals({ width, height, avoid })
    assert.equal(points.length, 5, `${width}px short-screen map keeps every signal around the real artwork`)
    assertSafe(points, width, height, avoid)
    assert.ok(Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)) >= width - 64, 'short-screen signals span the full safe width')
    assert.ok(Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)) >= height - 68, 'signals occupy both sides of the count row rather than clustering above it')
    assert.deepEqual(points, layoutDiscoverySignals({ width, height, avoid }), 'short-screen batch positions remain stable')
  }
})

test('a smaller signal count uses only safe actual positions and never invents extra signals', () => {
  const avoid = realControls(374, 355)
  for (const count of [1, 2, 3, 4, 5]) {
    const points = layoutDiscoverySignals({ width: 374, height: 355, avoid, count })
    assert.equal(points.length, count)
    assertSafe(points, 374, 355, avoid)
  }
  assert.equal(layoutDiscoverySignals({ width: 374, height: 355, count: 20 }).length, 5, 'home batches are capped at five')
})

test('insufficient space omits lights instead of overlapping controls, edges or one another', () => {
  assert.deepEqual(layoutDiscoverySignals({ width: 63, height: 300 }), [])
  assert.deepEqual(layoutDiscoverySignals({ width: 300, height: 67 }), [])
  assert.deepEqual(layoutDiscoverySignals({ width: 100, height: 100, avoid: [{ x: 0, y: 0, width: 100, height: 100 }] }), [])
  assert.deepEqual(layoutDiscoverySignals({ width: 64, height: 68 }), [{ x: 32, y: 34 }])
  const avoid = realControls(304, 184), points = layoutDiscoverySignals({ width: 304, height: 184, avoid })
  assert.ok(points.length < 5, 'a short map explicitly returns only the positions it can fit')
  assertSafe(points, 304, 184, avoid)
})

test('exact narrow clear space and invalid measurements are handled without mutation or NaN positions', () => {
  const avoid = [{ x: 0, y: 0, width: 78, height: 180 }, { x: 143, y: 0, width: 77, height: 180 }]
  const points = layoutDiscoverySignals({ width: 220, height: 180, avoid })
  assert.ok(points.length > 0, 'exact obstacle boundaries remain candidates between grid positions')
  assertSafe(points, 220, 180, avoid)
  for (const options of [undefined, {}, { width: NaN, height: 300 }, { width: 300, height: Infinity }, { width: 300, height: 300, count: 0 }]) {
    assert.deepEqual(layoutDiscoverySignals(options), [])
  }
  const valid = layoutDiscoverySignals({ width: 200, height: 200, avoid: [null, {}, { x: 0, y: 0, width: NaN, height: 10 }] })
  assertSafe(valid, 200, 200, [])
})

test('lamp, flight and landed edge can share one stable warm signal color per batch index', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(signalColor), ['hsl(48 90% 78%)', 'hsl(56 90% 78%)', 'hsl(64 90% 78%)', 'hsl(72 90% 78%)', 'hsl(80 90% 78%)'])
  assert.equal(signalColor(), 'hsl(48 90% 78%)')
  assert.equal(signalColor(NaN), 'hsl(48 90% 78%)')
})

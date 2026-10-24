const LAMP_WIDTH = 52
const LAMP_HEIGHT = 56
const CLEARANCE = 6
const HALF_X = LAMP_WIDTH / 2 + CLEARANCE
const HALF_Y = LAMP_HEIGHT / 2 + CLEARANCE

const finite = value => typeof value === 'number' && Number.isFinite(value)
const distance = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

function coordinates(length, radius, obstacles, start, size) {
  const low = radius, high = length - radius
  if (high < low) return []
  const intervals = Math.max(1, Math.ceil((high - low) / 16))
  const values = [low, high]
  for (let index = 1; index < intervals; index++) values.push(low + (high - low) * index / intervals)
  // Include the exact free-space boundaries so a narrow valid gap does not
  // disappear merely because it falls between two regular grid positions.
  for (const rect of obstacles) values.push(rect[start] - radius, rect[start] + rect[size] + radius)
  return [...new Set(values.filter(value => value >= low && value <= high))].sort((a, b) => a - b)
}

function overlapsObstacle(point, rect) {
  return point.x > rect.x - HALF_X && point.x < rect.x + rect.width + HALF_X
    && point.y > rect.y - HALF_Y && point.y < rect.y + rect.height + HALF_Y
}

function overlapsLamp(a, b) {
  return Math.abs(a.x - b.x) < LAMP_WIDTH + CLEARANCE
    && Math.abs(a.y - b.y) < LAMP_HEIGHT + CLEARANCE
}

function spread(points) {
  let minimum = Infinity, total = 0
  for (let index = 0; index < points.length; index++) {
    for (let other = index + 1; other < points.length; other++) {
      const squared = distance(points[index], points[other])
      minimum = Math.min(minimum, squared)
      total += squared
    }
  }
  const coverage = (Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)))
    * (Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)))
  return { minimum: points.length > 1 ? minimum : 0, total, coverage }
}

// Decorative positions only: no randomness, timers, DOM reads or business data.
// Callers pass measured controls in the beacon layer's coordinate space.
// Insufficient space returns fewer lights; it never overlaps a control or
// squeezes the lamp artwork to manufacture five positions.
export function layoutDiscoverySignals({ width, height, avoid = [], count = 5 } = {}) {
  if (!finite(width) || !finite(height) || width < HALF_X * 2 || height < HALF_Y * 2 || !finite(count) || count < 1) return []
  const target = Math.min(5, Math.floor(count))
  const obstacles = (Array.isArray(avoid) ? avoid : []).filter(rect => rect
    && ['x', 'y', 'width', 'height'].every(key => finite(rect[key])) && rect.width > 0 && rect.height > 0)
  const xs = coordinates(width, HALF_X, obstacles, 'x', 'width')
  const ys = coordinates(height, HALF_Y, obstacles, 'y', 'height')
  const candidates = ys.flatMap(y => xs.map(x => ({ x, y }))).filter(point => !obstacles.some(rect => overlapsObstacle(point, rect)))
  if (!candidates.length) return []

  // Farthest-point placement spreads lights over the available island, rather
  // than the old narrow diagonal. Several fixed starting anchors prevent a
  // greedy first choice from needlessly losing a fifth light around controls.
  const anchors = [[.12, .12], [.88, .88], [.88, .12], [.12, .88], [.5, .5], [.5, .12], [.88, .5], [.5, .88], [.12, .5]]
  const seeds = [...new Set(anchors.map(([x, y]) => {
    const anchor = { x: x * width, y: y * height }
    return candidates.reduce((nearest, point) => distance(point, anchor) < distance(nearest, anchor) ? point : nearest)
  }))]
  let best = [], bestSpread = { minimum: 0, total: 0, coverage: 0 }
  for (const seed of seeds) {
    const selected = [seed]
    while (selected.length < target) {
      let next, furthest = -1
      for (const point of candidates) {
        if (selected.some(existing => overlapsLamp(point, existing))) continue
        const nearest = Math.min(...selected.map(existing => distance(point, existing)))
        if (nearest > furthest) { next = point; furthest = nearest }
      }
      if (!next) break
      selected.push(next)
    }
    const currentSpread = spread(selected)
    if (selected.length > best.length || (selected.length === best.length
      && (currentSpread.coverage > bestSpread.coverage || (currentSpread.coverage === bestSpread.coverage
        && (currentSpread.minimum > bestSpread.minimum || (currentSpread.minimum === bestSpread.minimum && currentSpread.total > bestSpread.total)))))) {
      best = selected
      bestSpread = currentSpread
    }
  }
  return best.map(({ x, y }) => ({ x, y }))
}

// One color source keeps each lamp and its falling/landed card glow in sync.
export function signalColor(index = 0) {
  return `hsl(${48 + (finite(index) ? Math.max(0, Math.floor(index)) : 0) * 8} 90% 78%)`
}

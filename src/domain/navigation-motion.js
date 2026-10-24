const mainOrder = ['chats', 'home', 'mine']
const mediaRoutes = new Set(['videoCall', 'chatPhoto', 'postMedia'])
const trailLimit = 30

function destination(route) {
  if (!route || typeof route.path !== 'string' || !route.path.startsWith('/')) return null
  return {
    path: route.path,
    fullPath: typeof route.fullPath === 'string' ? route.fullPath : route.path,
    name: route.name,
    main: !!route.meta?.main,
    auth: !!route.meta?.authFlow,
    source: typeof route.query?.from === 'string' ? route.query.from : null,
  }
}

function parentOf(parent, child) {
  return parent !== '/' && child.startsWith(parent.replace(/\/$/, '') + '/')
}

function historyPosition(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// Visual direction follows successful app destinations, including the existing
// explicit-source returns that use router.push rather than browser history.
// Planning is read-only: cancelled guards must not change the next direction.
export function createNavigationTrail() {
  let entries = [], owner, initialized = false, position = null

  function plan(toRoute, fromRoute, { ownerId = null, position: nextPosition } = {}) {
    const to = destination(toRoute), from = destination(fromRoute)
    if (!to || !from || !initialized || ownerId !== owner) return 'none'
    if (to.path === from.path || to.auth && from.auth) return 'none'
    if (mediaRoutes.has(to.name) || mediaRoutes.has(from.name)) return 'fade'
    if (to.name === 'compose') return 'present'
    if (from.name === 'compose') return 'dismiss'

    const nextTab = mainOrder.indexOf(to.name), previousTab = mainOrder.indexOf(from.name)
    if (to.main && from.main && nextTab >= 0 && previousTab >= 0) {
      return nextTab > previousTab ? 'tab-forward' : 'tab-back'
    }
    if (to.main && !from.main) return 'pop'
    if (from.source === to.fullPath || parentOf(to.path, from.path)) return 'pop'
    if (entries.slice(0, -1).some(entry => entry.fullPath === to.fullPath)) return 'pop'

    const candidatePosition = historyPosition(nextPosition)
    if (candidatePosition !== null && position !== null && candidatePosition < position) return 'pop'
    return 'push'
  }

  function commit(toRoute, { ownerId = null, position: nextPosition } = {}) {
    const to = destination(toRoute)
    if (!to) return
    if (!initialized || owner !== ownerId) {
      entries = [to]
      owner = ownerId
      initialized = true
    } else if (entries.at(-1)?.path === to.path) {
      // Query-only changes update context without adding another screen.
      entries[entries.length - 1] = to
    } else {
      const previous = entries.findLastIndex(entry => entry.fullPath === to.fullPath)
      if (previous >= 0) entries = [...entries.slice(0, previous), to]
      else entries = [...entries, to].slice(-trailLimit)
    }
    position = historyPosition(nextPosition)
  }

  function reset() {
    entries = []
    owner = undefined
    initialized = false
    position = null
  }

  return { plan, commit, reset }
}

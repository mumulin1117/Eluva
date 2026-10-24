const itemId = item => typeof item === 'string' ? item : item?.id
const uniqueItems = items => {
  const seen = new Set()
  return (Array.isArray(items) ? items : []).filter(item => {
    const id = itemId(item)
    if (typeof id !== 'string' || !id || seen.has(id)) return false
    seen.add(id)
    return true
  }).slice(0, 5)
}

// Presentation begins only after a real read succeeds. One cancellable clock
// pairs each lamp with one returned post; it never creates matches or waits
// before returning data to the business state.
export class DiscoveryPresentation {
  constructor({ changed = () => {}, schedule = (fn, ms) => setTimeout(fn, ms), cancel = timer => clearTimeout(timer), stepMs = 420, settleMs = 260 } = {}) {
    Object.assign(this, { changed, schedule, cancelTimer: cancel, stepMs, settleMs })
    this.state = { phase: 'idle', items: [], activeId: null, litIds: [], busy: false }
    this.holds = new Set()
    this.operation = 0
    this.clockGeneration = 0
    this.disposed = false
    this.reduced = false
    this.previous = []
    this.incoming = []
  }

  update(next) {
    this.state = { ...next, busy: next.phase !== 'idle' }
    this.changed({ ...this.state, items: [...this.state.items], litIds: [...this.state.litIds] })
  }

  stopClock() {
    if (this.timer !== undefined) this.cancelTimer(this.timer)
    this.timer = undefined
    this.clockGeneration++
  }

  valid(token) {
    return !this.disposed && (token === undefined || token === this.operation)
  }

  // Returning to the page preserves its established order without replaying.
  hydrate(items) {
    if (this.disposed) return
    this.operation++
    this.stopClock()
    this.previous = uniqueItems(items)
    this.incoming = []
    this.immediate = false
    this.update({ phase: 'idle', items: this.previous, activeId: null, litIds: [] })
  }

  start(previousItems = this.state.items) {
    if (this.disposed) return undefined
    if (this.state.busy) return this.operation
    this.stopClock()
    this.operation++
    this.previous = uniqueItems(previousItems)
    this.incoming = []
    this.immediate = this.reduced
    this.update({ phase: 'searching', items: this.previous, activeId: null, litIds: [] })
    return this.operation
  }

  resolve(items, { immediate = false, token } = {}) {
    if (!this.valid(token) || this.state.phase !== 'searching') return false
    this.incoming = uniqueItems(items)
    this.cursor = 0
    if (!this.incoming.length || immediate || this.immediate || this.reduced) {
      this.complete()
      return true
    }
    this.state = { phase: 'revealing', items: [], activeId: null, litIds: [], busy: true }
    if (this.holds.size) this.update(this.state)
    else this.advance()
    return true
  }

  advance() {
    const item = this.incoming[this.cursor++]
    this.update({
      phase: this.cursor === this.incoming.length ? 'settling' : 'revealing',
      items: [item, ...this.state.items],
      activeId: itemId(item),
      litIds: [...this.state.litIds, itemId(item)],
    })
    this.restartClock()
  }

  restartClock() {
    this.stopClock()
    if (this.disposed || this.holds.size || !['revealing', 'settling'].includes(this.state.phase)) return
    const generation = this.clockGeneration, operation = this.operation
    this.timer = this.schedule(() => {
      if (this.disposed || generation !== this.clockGeneration || operation !== this.operation) return
      this.timer = undefined
      if (this.state.phase === 'settling') this.complete()
      else this.advance()
    }, this.state.phase === 'settling' ? this.settleMs : this.stepMs)
  }

  complete() {
    this.stopClock()
    const items = [...this.incoming].reverse()
    this.incoming = []
    this.previous = items
    this.update({ phase: 'idle', items, activeId: null, litIds: [] })
  }

  fail({ token } = {}) {
    if (!this.valid(token) || !this.state.busy) return false
    this.operation++
    this.stopClock()
    this.incoming = []
    this.update({ phase: 'idle', items: this.previous, activeId: null, litIds: [] })
    return true
  }

  finish() {
    if (this.disposed || !this.state.busy) return
    if (this.state.phase === 'searching') this.immediate = true
    else this.complete()
  }

  reduceMotion(value) {
    if (this.disposed) return
    this.reduced = !!value
    if (this.reduced) this.finish()
  }

  hold(reason, value) {
    if (this.disposed || this.holds.has(reason) === !!value) return
    if (value) this.holds.add(reason)
    else this.holds.delete(reason)
    this.restartClock()
  }

  cancel() {
    if (this.disposed) return
    if (this.state.busy) this.fail()
    else { this.operation++; this.stopClock() }
  }

  dispose() {
    if (this.disposed) return
    this.cancel()
    this.disposed = true
    this.holds.clear()
  }
}

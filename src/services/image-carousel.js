// A single cancellable clock. Visibility, touch, modal and accessibility gates
// share the same scheduler so resuming can never accumulate intervals.
export class ImageCarousel {
  constructor({ changed, delay = 4000, schedule = (fn, ms) => setTimeout(fn, ms), cancel = timer => clearTimeout(timer) }) {
    Object.assign(this, { changed, delay, schedule, cancel })
    this.ids = []; this.index = 0; this.holds = new Set(['offscreen']); this.generation = 0; this.disposed = false
  }
  items(ids) {
    const current = this.ids[this.index]
    this.ids = [...ids]
    this.index = Math.max(0, this.ids.indexOf(current))
    this.changed(this.index); this.restart()
  }
  hold(reason, value) {
    if (this.holds.has(reason) === value) return
    if (value) this.holds.add(reason); else this.holds.delete(reason)
    this.restart()
  }
  select(index) {
    if (this.disposed || !this.ids.length) return
    this.index = (index % this.ids.length + this.ids.length) % this.ids.length
    this.changed(this.index); this.restart()
  }
  restart() {
    this.cancel(this.timer); this.timer = undefined
    const generation = ++this.generation
    if (this.disposed || this.ids.length < 2 || this.holds.size) return
    this.timer = this.schedule(() => {
      if (generation === this.generation && !this.disposed) this.select(this.index + 1)
    }, this.delay)
  }
  dispose() { this.disposed = true; this.restart() }
}

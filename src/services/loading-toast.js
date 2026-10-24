// Submission feedback only. Reads and native system sheets keep their own UI.
const operations = Object.freeze({
  'content-publish': 'publishing',
  'personal-saveProfile': 'profile',
  'collection-save': 'createCollection',
  'personal-saveCollection': 'collection',
  'personal-collectionPosts': 'collection',
  'content-report': 'report',
  'social-report': 'report',
  'personal-submitFeedback': 'feedback',
  'personal-savePreferences': 'preferences',
  'personal-deletePost': 'deletePost',
  'personal-deleteCollection': 'deleteCollection',
  'delete-account': 'deleteAccount',
})

export const loadingToastKey = operation => Object.hasOwn(operations, operation) ? `loading.${operations[operation]}` : ''

// This owns presentation timers, never the business operation or its lock.
export class LoadingToastPresentation {
  constructor({ changed = () => {}, schedule = (fn, ms) => setTimeout(fn, ms), cancel = handle => clearTimeout(handle), delay = 220 } = {}) {
    Object.assign(this, { changed, schedule, cancel, delay, lastOperation: '', entry: null, timer: null, visible: false, version: 0, disposed: false })
  }

  clearTimer() {
    this.version++
    if (this.timer !== null) this.cancel(this.timer)
    this.timer = null
  }

  publish(value) {
    if (this.visible === value) return
    this.visible = value
    this.changed(value ? { operation: this.entry.operation, key: this.entry.key } : null)
  }

  update({ operation = '', owner = null, route = '', blocked = false }) {
    if (this.disposed) return
    if (operation !== this.lastOperation) {
      this.clearTimer()
      this.publish(false)
      this.lastOperation = operation
      const key = loadingToastKey(operation)
      this.entry = key ? { operation, key, owner, route, invalid: false } : null
    }
    const entry = this.entry
    if (!entry) return
    // Leaving the initiating page/account permanently invalidates this display.
    if (entry.owner !== owner || entry.route !== route) entry.invalid = true
    if (entry.invalid || blocked) {
      this.clearTimer()
      this.publish(false)
      return
    }
    if (this.visible || this.timer !== null) return
    const version = ++this.version
    this.timer = this.schedule(() => {
      if (this.disposed || version !== this.version || this.entry !== entry || entry.invalid) return
      this.timer = null
      this.publish(true)
    }, this.delay)
  }

  dispose() {
    this.clearTimer()
    this.publish(false)
    this.disposed = true
    this.entry = null
  }
}

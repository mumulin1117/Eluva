import { AppError } from '../domain/errors.js'

const cancelled = () => new AppError('CANCELLED')

// Give the already-rendered skeleton one paint before a fast local read can
// replace it. This is a frame boundary, not a simulated network delay.
export function paintLoading(signal, { frame = requestAnimationFrame, cancelFrame = cancelAnimationFrame } = {}) {
  if (signal?.aborted) return Promise.reject(cancelled())
  return new Promise((resolve, reject) => {
    let pending
    const clean = () => { if (pending !== undefined) cancelFrame(pending); signal?.removeEventListener('abort', abort) }
    const abort = () => { clean(); reject(cancelled()) }
    signal?.addEventListener('abort', abort, { once: true })
    pending = frame(() => {
      pending = frame(() => { pending = undefined; clean(); resolve() })
    })
  })
}

// A short, explicit presentation floor for the three requested entry screens.
// Start alongside the real read, then wait only its remainder on success. Keep
// this separate from paintLoading: Home's guide waits for frames, not a delay.
export function createLoadingPace(signal, { minimumMs = 1000, now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  const startedAt = now(), duration = Number.isFinite(minimumMs) ? Math.max(0, minimumMs) : 1000
  let stopped = !!signal?.aborted, completed = false, timer, result, rejectPending
  const clean = () => {
    if (timer !== undefined) cancel(timer)
    timer = undefined
    signal?.removeEventListener('abort', stop)
  }
  const stop = () => {
    if (stopped || completed) return
    stopped = true; clean(); rejectPending?.(cancelled()); rejectPending = undefined
  }
  if (!stopped) signal?.addEventListener('abort', stop, { once: true })
  return {
    finish() {
      if (stopped) return Promise.reject(cancelled())
      if (result) return result
      const remaining = Math.max(0, duration - (now() - startedAt))
      if (!remaining) { completed = true; clean(); return result = Promise.resolve() }
      result = new Promise((resolve, reject) => {
        rejectPending = reject
        timer = schedule(() => {
          timer = undefined
          if (stopped) return
          completed = true; clean(); rejectPending = undefined; resolve()
        }, remaining)
      })
      return result
    },
    cancel: stop,
  }
}

// Await only the images the page is about to show. A missing/slow image must
// return control to that page's existing fallback, never leave an endless shell.
export function prepareLoadingImages(urls, { signal, imageFactory = () => new Image(), timeoutMs = 8000, schedule = setTimeout, cancel = clearTimeout } = {}) {
  if (signal?.aborted) return Promise.reject(cancelled())
  const sources = [...new Set((Array.isArray(urls) ? urls : []).filter(url => typeof url === 'string' && url.trim()))].slice(0, 8)
  if (!sources.length) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const pending = new Set(), images = []
    let settled = false, timer
    const clean = () => {
      if (timer !== undefined) cancel(timer)
      signal?.removeEventListener('abort', abort)
      for (const image of images) { image.onload = null; image.onerror = null }
    }
    const finish = error => {
      if (settled) return
      settled = true; clean()
      if (error) reject(error); else resolve()
    }
    const abort = () => {
      finish(cancelled())
      for (const image of images) image.removeAttribute?.('src')
    }
    signal?.addEventListener('abort', abort, { once: true })
    // One bounded deadline for the entire visual preparation, with no minimum.
    timer = schedule(() => finish(), timeoutMs)
    sources.forEach((url, index) => pending.add(index))
    sources.forEach((url, index) => {
      let image
      const complete = () => { pending.delete(index); if (!pending.size) finish() }
      try {
        image = imageFactory(); images.push(image)
        image.decoding = 'async'
        image.onerror = complete
        image.onload = () => {
          if (settled) return
          if (typeof image.decode !== 'function') { complete(); return }
          try { Promise.resolve(image.decode()).then(complete, complete) } catch { complete() }
        }
        image.src = url
      } catch { complete() }
    })
  })
}

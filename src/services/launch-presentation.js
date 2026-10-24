import { AppError } from '../domain/errors.js'

const cancelled = () => new AppError('CANCELLED')
const missing = () => new AppError('RESOURCE_MISSING')

// Bootstrap retries do not rerun a guard that already accepted the failed
// initial navigation. Reconcile only that entry route, preserving legal pages
// and valid authenticated destinations.
export function launchRecoveryTarget(route, { user, consent }) {
  if (!route?.name) return { name: user ? 'home' : 'welcome' }
  if (route.meta?.legal) return null
  if (user && (route.meta?.auth || route.meta?.onboarding || route.name === 'welcome')) return { name: 'home' }
  if (!user && (route.meta?.main || route.meta?.protected)) return { name: 'welcome' }
  if (!consent && (route.meta?.auth || route.meta?.onboarding)) return { name: 'welcome' }
  return null
}

export function firstFrameSources(root, routeName, { document: page = document, viewport = { width: innerWidth, height: innerHeight } } = {}) {
  const sources = ['/images/auth-background.png', '/images/launch-logo.png']
  if (routeName === 'home') sources.push('/images/p2/empty-background.png', '/images/p2/share-island.png', '/images/p2/resonance-avatar.png', '/images/p2/tab-home.png')
  // Include the active EULA, if present, and only the media actually visible in
  // the first viewport. A later carousel slide must not hold the launch screen.
  const images = [...root.querySelectorAll('img'), ...page.querySelectorAll('.eula-content img')]
  for (const image of images) {
    const rect = image.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < viewport.height && rect.left < viewport.width) sources.push(image.currentSrc || image.src)
  }
  return [...new Set(sources.filter(Boolean))]
}

// Strict launch preparation differs from the optional media loaders: a missing
// brand/map asset keeps the branded recovery screen instead of revealing a gap.
// One deadline owns image decoding, fonts and both paint frames; abort removes
// every hook and rejects once, so a stale route can never acknowledge readiness.
export function prepareFirstFrame(sources, {
  signal, fonts = document.fonts, imageFactory = () => new Image(),
  frame = requestAnimationFrame, cancelFrame = cancelAnimationFrame,
  schedule = setTimeout, cancel = clearTimeout, timeoutMs = 12000,
} = {}) {
  if (signal?.aborted) return Promise.reject(cancelled())
  return new Promise((resolve, reject) => {
    const images = [], pending = new Set()
    let settled = false, frameId, timer
    const clean = () => {
      if (timer !== undefined) cancel(timer)
      if (frameId !== undefined) cancelFrame(frameId)
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
    const paint = () => {
      if (settled || pending.size) return
      frameId = frame(() => {
        if (settled) return
        frameId = frame(() => { frameId = undefined; finish() })
      })
    }
    signal?.addEventListener('abort', abort, { once: true })
    timer = schedule(() => finish(missing()), timeoutMs)
    const urls = [...new Set(sources.filter(url => typeof url === 'string' && url.trim()))]
    urls.forEach((_, index) => pending.add(index))
    pending.add('fonts')
    for (const [index, url] of urls.entries()) {
      try {
        const image = imageFactory(); images.push(image)
        let decoding = false
        const complete = () => {
          if (settled) return
          if (!(image.naturalWidth > 0)) { finish(missing()); return }
          pending.delete(index); paint()
        }
        const decode = () => {
          if (settled || decoding) return
          decoding = true
          if (typeof image.decode !== 'function') { complete(); return }
          try { Promise.resolve(image.decode()).then(complete, () => finish(missing())) }
          catch { finish(missing()) }
        }
        image.decoding = 'async'; image.onload = decode; image.onerror = () => finish(missing()); image.src = url
        if (image.complete) decode()
      } catch { finish(missing()) }
    }
    try {
      const fontJobs = fonts?.load ? ['400 14px "Poppins"', '600 16px "Plus Jakarta Sans"', '800 24px "Plus Jakarta Sans"'].map(font => fonts.load(font)) : []
      Promise.all([...fontJobs, fonts?.ready]).then(() => {
        if (settled) return
        pending.delete('fonts'); paint()
      }, () => finish(missing()))
    } catch { finish(missing()) }
  })
}

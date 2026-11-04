(() => {
  const launchId = window.__ELUVA_BOOT__?.launchId || new URL(window.location.href).searchParams.get('launch')
  if (launchId) {
    window.__ELUVA_BOOT__ = { ...window.__ELUVA_BOOT__, launchId }
    if (window.webkit?.messageHandlers?.eluva) document.documentElement.dataset.launchCovered = 'true'
  }
  const match = list => {
    for (const code of list) {
      const base = String(code).toLowerCase().replace('_', '-').split('-')[0]
      if (base === 'en' || base === 'de') return base
    }
    return 'en'
  }
  let saved
  try { saved = localStorage.getItem('eluva.locale') } catch { /* storage can be unavailable */ }
  const locale = window.__ELUVA_BOOT__?.locale || (['en', 'de'].includes(saved) ? saved : match(navigator.languages || [navigator.language]))
  window.__ELUVA_LOCALE__ = locale
  document.documentElement.lang = locale
})()

(() => {
  const match = list => {
    for (const code of list) {
      const base = String(code).toLowerCase().replace('_', '-').split('-')[0]
      if (base === 'en' || base === 'fr') return base
    }
    return 'en'
  }
  let saved
  try { saved = localStorage.getItem('eluva.locale') } catch { /* storage can be unavailable */ }
  const locale = window.__ELUVA_BOOT__?.locale || (['en', 'fr'].includes(saved) ? saved : match(navigator.languages || [navigator.language]))
  window.__ELUVA_LOCALE__ = locale
  document.documentElement.lang = locale
  document.addEventListener('DOMContentLoaded', () => {
    const copy = document.getElementById('boot-copy')
    if (copy) copy.textContent = locale === 'fr' ? 'Partagez. Ressentez. Échangez.' : 'Share. Feel. Connect.'
  }, { once: true })
})()

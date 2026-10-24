import test from 'node:test'
import assert from 'node:assert/strict'
await import('vue')
globalThis.window = { __ELUVA_LOCALE__: 'en' }
globalThis.document = { documentElement: { lang: 'en' } }
const { state, bridge, run, saveLocale } = await import('../src/state.js')
test('language changes retain the current business error and draft input', async () => {
  const original = bridge.call
  bridge.call = async () => ({ locale: 'fr' })
  try {
    state.ui.error = 'INVALID_VERIFICATION_CODE'
    state.draft = { code: '000000', displayName: 'Élodie' }
    await saveLocale('fr')
    assert.equal(state.ui.error, 'INVALID_VERIFICATION_CODE')
    assert.equal(state.draft.code, '000000')
    assert.equal(state.draft.displayName, 'Élodie')
    assert.equal(document.documentElement.lang, 'fr')
  } finally { bridge.call = original }
})
test('single-flight submission releases after failure and allows retry', async () => {
  let release, count = 0
  const first = run('commit', async () => { count++; await new Promise(resolve => { release = resolve }); throw { code: 'STORAGE_FAILED' } }, { critical: true })
  assert.equal(await run('commit', async () => { count++ }), false)
  release(); assert.equal(await first, false)
  assert.equal(state.ui.error, 'STORAGE_FAILED'); assert.equal(state.ui.busy, '')
  assert.equal(await run('commit', async () => { count++ }), true)
  assert.equal(count, 2)
})

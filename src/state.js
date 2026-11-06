import { reactive, watch } from 'vue'
import { NativeBridge } from './services/bridge.js'
import { BrowserRepository } from './services/browser-repository.js'
import { AppError, asAppError } from './domain/errors.js'
import { newId } from './domain/id.js'
import { LEGAL_VERSION } from './domain/validation.js'
import { translate } from './i18n.js'
import { noticePresentation } from './domain/notice.js'

export const bridge = new NativeBridge({ adapter: window.webkit?.messageHandlers?.eluva ? null : new BrowserRepository() })
export const state = reactive({
  booting: true, bootError: null, locale: window.__ELUVA_LOCALE__ || 'en', consent: false,
  theme:'purple', user: null, fixtures: { threads: [], friends: [], requests: [] }, environment: bridge.isNative ? 'ios' : 'browser',
  draft: null, login: { email: '', password: '' }, reset: { email: '', code: '', password: '', confirm: '', flowId: null, verified: false },
  ui: { busy: '', error: null, notice: '', noticeMeta: null, modal: '' },
  legalReturn: null, auth: null, authEpoch: 0,
})
let active = null
export const t = (key, values) => translate(state.locale, key, values)
let noticeSequence = 0
export function notify(key, options = {}) {
  if (!key) return dismissNotice()
  const presentation = noticePresentation(key)
  state.ui.noticeMeta = {id: ++noticeSequence, ownerId: state.user?.id || null, values: {},
    handoffs: 1, ...presentation, ...options}
  state.ui.notice = key
  return noticeSequence
}
export function dismissNotice(id) {
  if (id !== undefined && id !== state.ui.noticeMeta?.id) return
  state.ui.notice = ''; state.ui.noticeMeta = null
}
export function advanceNoticeRoute() {
  if (!state.ui.notice) return
  if (state.ui.noticeMeta?.handoffs > 0) state.ui.noticeMeta.handoffs--
  else dismissNotice()
}
watch(() => state.user?.id, (id, previous) => { if (id !== previous) dismissNotice() }, {flush: 'sync'})
export function startDraft() {
  if (!state.draft) state.draft = { id: newId(), commitId: newId(), flowId: null, email: '', password: '', code: '', verified: false, communityAccepted: false, birthday: '', displayName: '', gender: 'private', pronouns: '', university: '', year: '', major: '', otherMajor: '', photos: [], about: '', interestIds: [], goalIds: [], icebreakerIds: [], notificationChoice: 'notNow' }
  return state.draft
}
export function fail(code) { throw new AppError(code) }
export function clearError() { state.ui.error = null }
export async function run(name, action, { critical = false, preserveError = false } = {}) {
  if (active) return false
  const operation = { controller: new AbortController(), critical, done: false }
  active = operation; state.ui.busy = name
  if (!preserveError) state.ui.error = null
  try { await action(operation.controller.signal, () => { operation.done = true }); return true }
  catch (error) { const normalized = asAppError(error); if (normalized.code !== 'CANCELLED') state.ui.error = normalized.code; return false }
  finally { if (active === operation) { active = null; state.ui.busy = '' } }
}
export function canNavigate() { return !state.ui.busy || !active?.critical || active.done }
export function cancelTransient() { if (active && !active.done && !active.critical) active.controller.abort() }
export async function hydrateUser(result) {
  const user = result.user
  if (user?.profile?.photos) for (const photo of user.profile.photos) {
    try { const resolved = await bridge.call('media', 'resolve', { id: photo.id }); photo.url = resolved.url }
    catch { photo.url = null; photo.missing = true }
  }
  state.user = user; state.theme=result.theme||result.preferences?.theme||(user?state.theme:'purple'); state.fixtures = result.fixtures || { threads: [], friends: [], requests: [] }
}
export async function bootstrap() {
  state.booting = true; state.bootError = null
  try {
    const result = await bridge.call('app', 'bootstrap')
    state.locale = result.locale; document.documentElement.lang = result.locale
    state.consent = result.eulaConsent; state.environment = result.environment
    await hydrateUser(result)
    if (!state.user && !state.consent) state.ui.modal = 'eula'
    state.booting = false
  } catch (error) { state.bootError = asAppError(error).code; state.booting = false }
}
export async function saveConsent(accepted) {
  return run('consent', async signal => {
    await bridge.call('preferences', 'consent', { accepted, version: LEGAL_VERSION }, { signal })
    state.consent = accepted; state.ui.modal = ''
  })
}
export async function saveLocale(locale) {
  if (state.locale === locale) return
  return run('locale', async signal => {
    await bridge.call('preferences', 'locale', { locale }, { signal })
    state.locale = locale; document.documentElement.lang = locale
  }, { preserveError: true })
}
export function profilePayload() {
  const d = state.draft
  return { displayName: d.displayName, birthday: d.birthday, gender: d.gender, pronouns: d.pronouns, university: d.university.trim(), year: d.year, major: d.major, otherMajor: d.otherMajor.trim(), photos: d.photos.map(x => ({ id: x.id })), about: d.about, interestIds: [...d.interestIds], goalIds: [...d.goalIds], icebreakerIds: [...d.icebreakerIds], notificationChoice: d.notificationChoice }
}

export function finishSignOut(){state.user=null;state.theme="purple";state.fixtures={threads:[],friends:[],requests:[]};state.draft=null;state.login={email:"",password:""};state.reset={email:"",code:"",password:"",confirm:"",flowId:null,verified:false};state.ui.modal="";state.ui.error=null;state.auth=null;state.authEpoch++}

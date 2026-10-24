import { conversationVersion } from '../data/auth-conversation.js'
import { validateOnboarding } from '../domain/auth-conversation.js'
import { AppError, invariant } from '../domain/errors.js'
import { LEGAL_VERSION, normalizeEmail, TEST_EMAIL, TEST_USER_ID, validateCredentials, validateProfile, validEmail, verifyCode, matchLocale } from '../domain/validation.js'
import { choices } from '../data/choices.js'
import { browserContent } from './browser-content.js'
import { contentState, canReadPost, contentPolicy } from '../domain/content.js'
import { validateMediaFile } from './media-files.js'
import { browserSocial } from './browser-social.js'
import { browserCommerce } from './browser-commerce.js'
import { commerceState } from '../domain/commerce.js'
import { browserPersonal } from './browser-personal.js'
import { personalState,referencedMedia } from '../domain/personal.js'
import { browserRealtime } from './browser-realtime.js'
import { realtimeState,readableMessage } from '../domain/realtime.js'
import { socialState, socialMediaReadable, requirePeer, isBlocked } from '../domain/social.js'
import { demoFixtureVersion } from '../data/demo-fixtures.js'
import { presentationFixture } from '../data/demo-fixtures.js'
import { upgradePresentation } from '../domain/demo-upgrade.js'

const iterations = 120000
const bytesTo64 = bytes => btoa(String.fromCharCode(...bytes))
const from64 = text => Uint8Array.from(atob(text), ch => ch.charCodeAt(0))
const req = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new AppError('STORAGE_FAILED')) })
async function credential(password, salt = bytesTo64(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: from64(salt), iterations }, key, 256)
  return { salt, hash: bytesTo64(new Uint8Array(result)), iterations }
}
function equal(a, b) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0 }
const publicUser = user => user ? { id: user.id, email: user.email, profile: user.profile, isTest: !!user.isTest, registrationVersion:user.onboarding?.version||null } : null
const accountByEmail = (state, email) => Object.values(state.accounts).find(user => user.email === normalizeEmail(email))

export function testFixtures() {
  return { friends: ['demo-friend-echo', 'demo-friend-notes'], requests: [{ id: 'demo-request-in', direction: 'received' }, { id: 'demo-request-out', direction: 'sent' }],
    threads: ['echo', 'notes'].map((name, i) => ({ id: 'demo-thread-' + name, participantId: 'demo-friend-' + name, title: { en: 'Local demo ' + (i + 1), fr: 'Démo locale ' + (i + 1) }, messages: [
      { id: name + '-text', kind: 'text', body: { en: 'A small hello from the local demo.', fr: 'Un petit bonjour de la démo locale.' }, sentByMe: false },
    ] })), scenarios: { empty: true, failed: true, blockedUserId: 'demo-blocked-user' } }
}

// Development-browser adapter for the same RPC contract. iOS always uses the native repository.
export class BrowserRepository {
  constructor({ dbName = 'eluva-local-v1', indexedDB = globalThis.indexedDB, beforeWrite = () => {}, contentConfig = contentPolicy } = {}) {
    this.contentPolicy = contentConfig; this.dbName = dbName; this.indexedDB = indexedDB; this.beforeWrite = beforeWrite
    this.flows = new Map(); this.urls = new Map(); this.initializing = null
  }
  async open() {
    if (this.db) return this.db
    invariant(this.indexedDB && crypto.subtle, 'STORAGE_UNAVAILABLE')
    this.db = await new Promise((resolve, reject) => {
      const request = this.indexedDB.open(this.dbName, 1)
      request.onupgradeneeded = () => { request.result.createObjectStore('state'); request.result.createObjectStore('media', { keyPath: 'id' }) }
      request.onerror = () => reject(new AppError('STORAGE_UNAVAILABLE'))
      request.onblocked = () => reject(new AppError('STORAGE_BUSY'))
      request.onsuccess = () => resolve(request.result)
    })
    this.db.onversionchange = () => { this.db.close(); this.db = null }
    return this.db
  }
  async read() {
    const db = await this.open()
    const value = await req(db.transaction('state').objectStore('state').get('root'))
    if (value) invariant(value.version === 1 && value.accounts && value.preferences && value.commits, 'STORAGE_CORRUPT')
    if(value?.commerce!==undefined)commerceState(value)
    if(value?.content!==undefined)contentState(value)
    if(value?.social!==undefined)socialState(value)
    if(value?.personal!==undefined)personalState(value)
    if(value?.realtime!==undefined)realtimeState(value)
    if(value)upgradePresentation(value)
    return value
  }
  async write(operation, signal) {
    invariant(!signal?.aborted, 'CANCELLED')
    const db = await this.open()
    const tx = db.transaction(['state', 'media'], 'readwrite')
    const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(new AppError('STORAGE_FAILED')) })
    try {
      const store = tx.objectStore('state')
      const state = await req(store.get('root'))
      invariant(!signal?.aborted, 'CANCELLED')
      this.beforeWrite()
      const { state: next, result } = await operation(state, tx.objectStore('media'))
      invariant(!signal?.aborted, 'CANCELLED')
      await req(store.put(next, 'root'))
      await done
      return result
    } catch (error) { try { tx.abort() } catch { /* already settled */ } await done.catch(() => {}); throw error }
  }
  async initialize() {
    if (this.initializing) return this.initializing
    this.initializing = (async () => {
      const existing = await this.read()
      if (existing) {
        const db=await this.open(),stored=await req(db.transaction('state').objectStore('state').get('root'))
        if((stored.presentationVersion||0)<presentationFixture.version||(stored.content&&((stored.content.fixtureVersion||0)<demoFixtureVersion||(stored.content.safetyVersion||0)<1))||(stored.social&&(stored.social.fixtureVersion||0)<demoFixtureVersion))await this.write(s=>{
          upgradePresentation(s)
          if(s.content!==undefined)contentState(s)
          if(s.social!==undefined)socialState(s)
          return {state:s,result:undefined}
        })
        return
      }
      const testCredential = await credential('123qweasd')
      await this.write(state => {
        if (state) return { state, result: undefined }
        const next = { version: 1, installId: crypto.randomUUID(), preferences: { locale: matchLocale(globalThis.navigator?.languages || ['en'], globalThis.__ELUVA_LOCALE__), eulaConsent: false, eulaVersion: LEGAL_VERSION }, accounts: {}, commits: {}, session: null, fixtures: {} }
        next.accounts[TEST_USER_ID] = { id: TEST_USER_ID, email: TEST_EMAIL, credential: testCredential, isTest: true, profile: { displayName: 'Eluva Demo', birthday: '2000-01-01', photos: [], about: '', interestIds: [], goalIds: [], icebreakerIds: [] } }
        next.fixtures[TEST_USER_ID] = testFixtures()
        upgradePresentation(next)
        return { state: next, result: undefined }
      })
    })().catch(error => { this.initializing = null; throw error })
    return this.initializing
  }
  flow(id, purpose) {
    const flow = this.flows.get(id)
    invariant(flow && flow.purpose === purpose, 'FLOW_EXPIRED')
    return flow
  }
  async execute(service, method, params = {}, { signal } = {}) {
    invariant(params && typeof params === 'object', 'INVALID_ARGUMENT')
    if (service === 'system' && method === 'cancel') return {}
    await this.initialize()
    invariant(!signal?.aborted, 'CANCELLED')
    const state = await this.read()
    if (service === 'content'||service==='social') {
      const result=await (service==='content'?browserContent(this,method,params,signal):browserSocial(this,method,params,signal))
      if(this.playback){try{const current=await this.read();readableMessage(current,this.playback.messageId,current.session?.userId)}catch{this.playback?.audio.pause();this.playback=null}}
      return result
    }
    if (service === 'commerce') return browserCommerce(this,method,params,signal)
    if (service === 'personal') return browserPersonal(this,method,params,signal)
    if (service === 'realtime') return browserRealtime(this, method, params, signal)
    const key = service + '.' + method
    switch (key) {
      case 'app.bootstrap': {
        const user = state.accounts[state.session?.userId]
        return { theme:user?(personalState(state).preferences[user.id]?.theme||'purple'):'purple', locale: state.preferences.locale, eulaConsent: state.preferences.eulaConsent && state.preferences.eulaVersion === LEGAL_VERSION, user: publicUser(user), session: user ? state.session : null, environment: 'browser', fixtures: user ? state.fixtures[user.id] || { friends: [], requests: [], threads: [] } : null }
      }
      case 'app.ready': return { ready: true }
      case 'preferences.locale': {
        invariant(['en', 'fr'].includes(params.locale), 'INVALID_ARGUMENT')
        const result = await this.write(s => { s.preferences.locale = params.locale; return { state: s, result: { locale: params.locale } } }, signal)
        try { localStorage.setItem('eluva.locale', params.locale) } catch { /* IndexedDB is authoritative */ }
        return result
      }
      case 'preferences.consent': {
        invariant(typeof params.accepted === 'boolean' && params.version === LEGAL_VERSION, 'INVALID_ARGUMENT')
        return this.write(s => { s.preferences.eulaConsent = params.accepted; s.preferences.eulaVersion = params.version; return { state: s, result: { accepted: params.accepted } } }, signal)
      }
      case 'auth.checkEmail': {
        invariant(validEmail(params.email), 'INVALID_EMAIL')
        invariant(!accountByEmail(state, params.email), 'ACCOUNT_EXISTS')
        return { email: normalizeEmail(params.email) }
      }
      case 'auth.beginRegistration': {
        invariant(params.version===undefined||params.version===conversationVersion,'INVALID_ARGUMENT')
        const version=params.version===conversationVersion?conversationVersion:null
        if(version)invariant(validEmail(params.email),'INVALID_EMAIL');else validateCredentials(params.email,params.password)
        invariant(state.preferences.eulaConsent, 'CONSENT_REQUIRED')
        invariant(!accountByEmail(state, params.email), 'ACCOUNT_EXISTS')
        const id = params.flowId && this.flows.has(params.flowId) ? params.flowId : crypto.randomUUID()
        const previous = this.flows.get(id)
        invariant(!previous || previous.purpose === 'signup', 'INVALID_ARGUMENT')
        this.flows.set(id, { id, purpose: 'signup', email: normalizeEmail(params.email), version,password:version?'':params.password, verified: !!previous?.verified && previous.email === normalizeEmail(params.email) })
        return { flowId: id, email: normalizeEmail(params.email) }
      }
      case 'auth.setRegistrationPassword': {
        const flow=this.flow(params.flowId,'signup')
        invariant(flow.version===conversationVersion,'INVALID_ARGUMENT');invariant(flow.verified,'VERIFICATION_REQUIRED')
        validateCredentials(flow.email,params.password);flow.password=params.password;return {saved:true}
      }
      case 'auth.startVerification': {
        const flow = this.flow(params.flowId, 'signup')
        invariant(validEmail(params.email), 'INVALID_EMAIL')
        invariant(!accountByEmail(state, params.email), 'ACCOUNT_EXISTS')
        if (flow.email !== normalizeEmail(params.email)) flow.verified = false
        flow.email = normalizeEmail(params.email)
        return { simulation: true, codeLength: 6 }
      }
      case 'auth.verify': {
        invariant(['signup', 'reset'].includes(params.purpose), 'INVALID_ARGUMENT')
        const flow = this.flow(params.flowId, params.purpose)
        verifyCode(params.code); flow.verified = true
        return { verified: true, email: flow.email, simulation: true }
      }
      case 'auth.resend': this.flow(params.flowId, params.purpose); return { simulation: true, codeLength: 6 }
      case 'auth.cancelReset': this.flows.delete(params.flowId); return { cancelled: true }
      case 'auth.beginReset': {
        invariant(validEmail(params.email), 'INVALID_EMAIL')
        const user = accountByEmail(state, params.email)
        invariant(user, 'ACCOUNT_NOT_FOUND'); invariant(!user.isTest, 'TEST_ACCOUNT_READ_ONLY')
        const id = crypto.randomUUID()
        this.flows.set(id, { id, purpose: 'reset', userId: user.id, email: user.email, verified: false })
        return { flowId: id, email: user.email, simulation: true }
      }
      case 'auth.resetPassword': {
        const flow = this.flow(params.flowId, 'reset')
        invariant(flow.verified, 'VERIFICATION_REQUIRED')
        validateCredentials(flow.email, params.password)
        const hash = await credential(params.password)
        const result = await this.write(s => {
          const user = s.accounts[flow.userId]
          invariant(user && user.email === flow.email, 'ACCOUNT_NOT_FOUND'); invariant(!user.isTest, 'TEST_ACCOUNT_READ_ONLY')
          user.credential = hash
          if (s.session?.userId === user.id) s.session = null
          return { state: s, result: { reset: true } }
        }, signal)
        this.flows.delete(flow.id); return result
      }
      case 'auth.login': {
        invariant(state.preferences.eulaConsent, 'CONSENT_REQUIRED')
        invariant(validEmail(params.email), 'INVALID_EMAIL')
        const user = accountByEmail(state, params.email)
        invariant(user, 'ACCOUNT_NOT_FOUND')
        const candidate = await credential(params.password || '', user.credential.salt)
        invariant(equal(candidate.hash, user.credential.hash), 'WRONG_PASSWORD')
        return this.write(s => {
          const current = s.accounts[user.id]
          invariant(current && current.credential.hash === candidate.hash, 'WRONG_PASSWORD')
          s.session = { userId: user.id, token: crypto.randomUUID() }
          return { state: s, result: { theme:personalState(s).preferences[current.id]?.theme||'purple', user: publicUser(current), session: s.session, fixtures: s.fixtures[user.id] || { friends: [], requests: [], threads: [] } } }
        }, signal)
      }
      case 'auth.logout': {
        const result = await this.write(async (s,media) => { const owner=s.session?.userId,used=referencedMedia(s);for(const f of await req(media.getAll()))if(!f.committed&&!used.has(f.id)&&(owner&&f.userId===owner||this.flows.has(f.flowId)))await req(media.delete(f.id));s.session = null; return { state: s, result: { loggedOut: true } } }, signal)
        this.playback?.audio.pause();this.playback=null;this.callLeases?.clear();this.flows.clear(); this.contentDrafts?.clear();this.socialDrafts?.clear();this.profileMediaGrants?.clear();this.personalFailure=null;this.socialFailure=null; this.contentFailure=null; for (const url of this.urls.values()) URL.revokeObjectURL(url); this.urls.clear()
        return result
      }
      case 'auth.completeRegistration': {
        invariant(typeof params.commitId === 'string' && params.commitId.length >= 20, 'INVALID_ARGUMENT')
        const committed = state.commits[params.commitId]
        if (committed) { invariant(committed.flowId === params.flowId, 'COMMIT_CONFLICT'); invariant(state.session?.userId===committed.userId,'AUTH_REQUIRED'); return { user: publicUser(state.accounts[committed.userId]), session: state.session, commitId: params.commitId,theme:state.personal?.preferences?.[committed.userId]?.theme||'purple' } }
        const flow = this.flow(params.flowId, 'signup')
        invariant(flow.verified, 'VERIFICATION_REQUIRED')
        invariant(params.communityAccepted === true, 'CONSENT_REQUIRED')
        validateCredentials(flow.email,flow.password)
        const onboarding=flow.version===conversationVersion?validateOnboarding(params.onboarding):null
        const profile = validateProfile(params.profile, choices,new Date(),null,!!onboarding)
        const hash = await credential(flow.password)
        const id = crypto.randomUUID()
        const result = await this.write(async (s, media) => {
          const prior = s.commits[params.commitId]
          if (prior) { invariant(prior.flowId === flow.id, 'COMMIT_CONFLICT'); invariant(s.session?.userId===prior.userId,'AUTH_REQUIRED'); return { state: s, result: { user: publicUser(s.accounts[prior.userId]), session: s.session, commitId: params.commitId,theme:s.personal?.preferences?.[prior.userId]?.theme||'purple' } } }
          invariant(s.preferences.eulaConsent, 'CONSENT_REQUIRED')
          invariant(!accountByEmail(s, flow.email), 'ACCOUNT_EXISTS')
          for (const ref of profile.photos) { const file = await req(media.get(ref.id)); invariant(file && file.flowId === flow.id && !file.userId, 'MEDIA_MISSING'); file.userId = id; file.committed=true; delete file.flowId; await req(media.put(file)) }
          const user = { id, email: flow.email, credential: hash, isTest: false,...(onboarding?{onboarding}:{}), profile: { ...profile, photos: profile.photos.map(x => ({ id: x.id })), communityVersion: LEGAL_VERSION } }
          if(onboarding){const personal=personalState(s);personal.preferences[id]={theme:onboarding.theme}}
          s.accounts[id] = user; s.commits[params.commitId] = { userId: id, flowId: flow.id }; s.session = { userId: id, token: crypto.randomUUID() }
          return { state: s, result: { user: publicUser(user), session: s.session, commitId: params.commitId,theme:onboarding?.theme||'purple', fixtures: { friends: [], requests: [], threads: [] } } }
        }, signal)
        this.flows.delete(flow.id); return result
      }
      case 'auth.cancelRegistration': {
        if (params.flowId) {
          const removed = await this.write(async (s, media) => { const all = await req(media.getAll()), ids = []; for (const file of all) if (file.flowId === params.flowId && !file.userId) { await req(media.delete(file.id)); ids.push(file.id) }; return { state: s, result: ids } }, signal)
          this.flows.delete(params.flowId)
          for (const id of removed) { if (this.urls.has(id)) URL.revokeObjectURL(this.urls.get(id)); this.urls.delete(id) }
        }
        return { cancelled: true }
      }
      case 'media.import': {
        const isPost = !!params.draftId, owner = state.session?.userId
        const chat=this.socialDrafts?.get(params.draftId)
        if(chat){invariant(chat.ownerId===owner,'DRAFT_EXPIRED');requirePeer(state,owner,chat.peerId,{friend:true})}
        const flow = isPost ? null : this.flow(params.flowId, 'signup')
        invariant(isPost ? owner && (this.contentDrafts?.get(params.draftId) === owner||chat?.ownerId===owner) : flow.verified, isPost ? 'DRAFT_EXPIRED' : 'VERIFICATION_REQUIRED')
        const video = ['video/mp4','video/quicktime'].includes(params.mime)
        invariant(!chat||!video,'MEDIA_UNSUPPORTED')
        invariant(['image/png', 'image/jpeg', 'image/webp', ...(isPost ? ['video/mp4','video/quicktime'] : [])].includes(params.mime), 'MEDIA_UNSUPPORTED')
        invariant(typeof params.base64 === 'string' && params.base64.length < (video ? 70_000_000 : 28_000_000), 'MEDIA_TOO_LARGE')
        const data = from64(params.base64)
        invariant(data.byteLength <= (video ? contentPolicy.videoBytes : 20*1024*1024), 'MEDIA_TOO_LARGE')
        invariant((video && String.fromCharCode(...data.slice(4,8))==='ftyp') || (params.mime === 'image/png' && data[0] === 137 && data[1] === 80) || (params.mime === 'image/jpeg' && data[0] === 255 && data[1] === 216) || (params.mime === 'image/webp' && data[0] === 82 && data[8] === 87), 'MEDIA_UNSUPPORTED')
        const id = crypto.randomUUID(), blob = new Blob([data], { type: params.mime })
        if(video){invariant(typeof document!=='undefined','DEVICE_UNSUPPORTED');await validateMediaFile(blob,signal)}
        if (!video && typeof createImageBitmap === 'function') { try { const bitmap = await createImageBitmap(blob); bitmap.close() } catch { throw new AppError('MEDIA_UNSUPPORTED') } }
        await this.write(async (s, media) => { invariant(!isPost || s.session?.userId===owner,'AUTH_REQUIRED');if(chat)requirePeer(s,owner,chat.peerId,{friend:true}); await req(media.put({ id, ...(isPost?{draftId:params.draftId,userId:owner,kind:video?'video':'image',...(chat?{messagePeerId:chat.peerId}:{})}:{flowId:flow.id}), blob })); return { state: s, result: {} } }, signal)
        const url = URL.createObjectURL(blob); this.urls.set(id, url)
        return { id, url, kind: video?'video':'image' }
      }
      case 'media.resolve': {
        const db = await this.open(), file = await req(db.transaction('media').objectStore('media').get(params.id))
        const viewer=state.session?.userId, c=contentState(state)
        const readable = file && Object.values(c.posts).some(p=>p.media.some(m=>m.id===file.id)&&canReadPost(state,p,viewer))
        const photoReadable=viewer&&this.profileMediaGrants?.get(viewer)?.has(file?.id)&&Object.values(state.accounts).some(a=>!isBlocked(state,viewer,a.id)&&a.profile.photos.some(p=>p.id===file?.id))
        const chat=file?.messagePeerId,staged=chat&&this.socialDrafts?.get(file.draftId)
        if(chat&&!file.committed&&staged&&staged.ownerId===viewer)requirePeer(state,viewer,chat,{friend:true})
        invariant(file && (chat ? socialMediaReadable(state,file,viewer)||(!file.committed&&staged?.ownerId===viewer) : file.userId ? file.userId === viewer || readable || photoReadable : this.flows.has(file.flowId)), 'MEDIA_MISSING')
        if (!this.urls.has(file.id)) this.urls.set(file.id, URL.createObjectURL(file.blob))
        return { id: file.id, url: this.urls.get(file.id) }
      }
      case 'media.remove': {
        if(params.draftId)invariant(this.contentDrafts?.get(params.draftId)===state.session?.userId||this.socialDrafts?.get(params.draftId)?.ownerId===state.session?.userId,'DRAFT_EXPIRED');else this.flow(params.flowId, 'signup')
        let deleted=false
        await this.write(async (s, media) => { const file = await req(media.get(params.id)); invariant(params.draftId ? file?.draftId===params.draftId && file.userId===s.session?.userId : file?.flowId === params.flowId && !file.userId, 'MEDIA_MISSING'); if(!file.committed){await req(media.delete(params.id));deleted=true} return { state: s, result: {} } }, signal)
        if(deleted){if (this.urls.has(params.id)) URL.revokeObjectURL(this.urls.get(params.id)); this.urls.delete(params.id)}
        return { removed: true }
      }
      case 'notifications.status': return { status: 'unsupported' }
      case 'notifications.request': return { status: 'unsupported' }
      case 'system.openSettings': throw new AppError('DEVICE_UNSUPPORTED')
      default: throw new AppError('METHOD_NOT_FOUND')
    }
  }
  close() { this.db?.close(); this.db = null; this.playback?.audio.pause();this.playback=null;this.callLeases?.clear();this.flows.clear(); this.contentDrafts?.clear();this.socialDrafts?.clear();this.profileMediaGrants?.clear();this.personalFailure=null;this.socialFailure=null; this.contentFailure=null; for (const url of this.urls.values()) URL.revokeObjectURL(url); this.urls.clear() }
}

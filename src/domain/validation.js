import { invariant } from './errors.js'

export const VERIFICATION_CODE = '567567'
export const TEST_EMAIL = 'eluva@gmail.com'
export const TEST_USER_ID = 'eluva-test-user-v1'
export const LEGAL_VERSION = 'local-preview-2026-10-17'
export const normalizeEmail = value => String(value || '').trim().toLowerCase()
export const validEmail = value => /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(normalizeEmail(value)) && normalizeEmail(value).length <= 254
export const validPassword = value => typeof value === 'string' && textLength(value) >= 8 && /[0-9]/.test(value)
export function textLength(value) {
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value || '')].length
  return Array.from(value || '').length
}
export function ageOn(birthday, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday || '')) return null
  const [y, m, d] = birthday.split('-').map(Number)
  const birth = new Date(y, m - 1, d)
  if (y < 1900 || birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) return null
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (birth > current) return null
  return current.getFullYear() - y - (current.getMonth() < m - 1 || (current.getMonth() === m - 1 && current.getDate() < d) ? 1 : 0)
}
export function validateCredentials(email, password) {
  invariant(validEmail(email), 'INVALID_EMAIL')
  invariant(validPassword(password), 'WEAK_PASSWORD')
}
export function validateProfile(profile, choices, today = new Date(), existing = null, sparse = false) {
  invariant(profile && typeof profile === 'object', 'INVALID_PROFILE')
  invariant(typeof profile.displayName === 'string' && profile.displayName.trim().length > 0 && textLength(profile.displayName.trim()) <= 60, 'INVALID_NAME')
  const age = ageOn(profile.birthday, today)
  invariant(age !== null, 'INVALID_BIRTHDAY')
  invariant(age >= 18, 'AGE_RESTRICTED')
  const same = field => !!existing && JSON.stringify(profile[field]) === JSON.stringify(existing[field])
  invariant(Array.isArray(profile.photos) && (sparse || profile.photos.length >= 2 || same('photos')) && profile.photos.every(p => typeof p?.id === 'string') && new Set(profile.photos.map(p => p.id)).size === profile.photos.length, 'PHOTOS_REQUIRED')
  invariant(Array.isArray(profile.interestIds) && (sparse || new Set(profile.interestIds).size >= 3 || same('interestIds')) && profile.interestIds.every(id => choices.interests.some(x => x.id === id)), 'INTERESTS_REQUIRED')
  invariant(Array.isArray(profile.icebreakerIds) && (sparse || profile.icebreakerIds.length === 3 || same('icebreakerIds')) && new Set(profile.icebreakerIds).size === profile.icebreakerIds.length && profile.icebreakerIds.every(id => choices.icebreakers.some(x => x.id === id)), 'ICEBREAKERS_REQUIRED')
  invariant(typeof profile.about === 'string' && textLength(profile.about) <= 300, 'ABOUT_TOO_LONG')
  invariant(Array.isArray(profile.goalIds) && profile.goalIds.every(id => choices.goals.some(x => x.id === id)), 'INVALID_PROFILE')
  for (const [field,group] of [['gender','genders'],['year','years'],['major','majors']]) invariant(!profile[field] || choices[group].some(x => x.id === profile[field]), 'INVALID_PROFILE')
  for (const [field,max] of [['pronouns',60],['university',120],['otherMajor',120]]) invariant(profile[field] === undefined || (typeof profile[field] === 'string' && textLength(profile[field]) <= max), 'INVALID_PROFILE')
  invariant(!profile.notificationChoice || ['notNow','notDetermined','authorized','provisional','ephemeral','denied','unsupported'].includes(profile.notificationChoice), 'INVALID_PROFILE')
  return Object.fromEntries(['displayName','birthday','gender','pronouns','university','year','major','otherMajor','photos','about','interestIds','goalIds','icebreakerIds','notificationChoice'].filter(key=>profile[key]!==undefined).map(key=>[key,key==='displayName'?profile.displayName.trim():profile[key]]))
}
export function verifyCode(value) { invariant(String(value) === VERIFICATION_CODE, 'INVALID_VERIFICATION_CODE'); return true }
export function matchLocale(preferred, saved) {
  if (['en', 'de'].includes(saved)) return saved
  for (const code of preferred) { const base = String(code).toLowerCase().replace('_', '-').split('-')[0]; if (['en', 'de'].includes(base)) return base }
  return 'en'
}

import { invariant } from './errors.js'
import { contentDemo } from '../data/content-demo.js'
import { commercePolicy } from './commerce.js'
import { upgradeDemoContent } from './demo-upgrade.js'

// Local preview policy. Commercial limits remain unfrozen; one configuration feeds both repositories.
export const contentPolicy = Object.freeze({ bodyLimit: 2000, commentLimit: 1000, imageLimit: 9, videoLimit: 1, videoBytes: 50 * 1024 * 1024, videoSeconds: 60, dailyPublicPosts: commercePolicy.confirmed ? commercePolicy.publicPostFree : null, proAudienceEnabled: false })
export const defaultVisibility = () => ({ private: false, audience: 'everyone', discover: true, profile: true })
export const audienceFilterIds = Object.freeze(['any','men','women','excludeMen','excludeWomen'])
export const defaultFeedFilter = () => ({ media: 'all', topic: 'all' })
export const characterCount = value => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value || '')].length
export function visibility(raw = {}) {
  invariant(typeof raw.private === 'boolean' && ['everyone', 'friends'].includes(raw.audience) && typeof raw.discover === 'boolean' && typeof raw.profile === 'boolean', 'INVALID_VISIBILITY')
  return { private: raw.private, audience: raw.audience, discover: !raw.private && raw.discover, profile: !raw.private && raw.profile }
}
export function validatePost(raw, policy = contentPolicy) {
  const body = String(raw.body || '').trim(), media = raw.media || []
  invariant(characterCount(body) <= policy.bodyLimit, 'POST_TOO_LONG')
  invariant(Array.isArray(media) && media.every(x => typeof x.id === 'string' && ['image', 'video'].includes(x.kind)) && new Set(media.map(x => x.id)).size === media.length, 'INVALID_MEDIA')
  invariant(body || media.length, 'EMPTY_POST')
  const videos = media.filter(x => x.kind === 'video').length
  invariant(videos ? videos === 1 && media.length === 1 : media.length <= policy.imageLimit, 'MEDIA_LIMIT')
  invariant(audienceFilterIds.includes(raw.audienceFilter), 'INVALID_FILTER')
  invariant(raw.audienceFilter === 'any' || policy.proAudienceEnabled, 'PRO_LOCKED')
  return { body, media: media.map(({ id, kind }) => ({ id, kind })), visibility: visibility(raw.visibility), audienceFilter: raw.audienceFilter, tagIds: [...new Set(raw.tagIds || [])] }
}
export const contentSafetyVersion = 1
export function emptyContent() { return { version: 1, safetyVersion:contentSafetyVersion, posts: Object.fromEntries(contentDemo.map(p=>[p.id,structuredClone(p)])), comments: {}, echoes: {}, events: {}, collections: {}, operations: {}, preferences: {}, hidden: {}, blocks: {}, reports: {}, quota: {} } }
// Upgrade only the old per-account hidden-post choices. Keep their records
// until that account explicitly restores the author through its blacklist.
export function upgradeContentSafety(root,c) {
  if((c.safetyVersion||0)>=contentSafetyVersion)return
  for(const viewer of Object.keys(root.accounts||{}))for(const post of Object.values(c.posts)) {
    if(post.authorId&&post.authorId!==viewer&&c.hidden[viewer+':'+post.id]===true)c.blocks[viewer+':'+post.authorId]=true
  }
  c.safetyVersion=contentSafetyVersion
}
export function setAuthorBlock(root,c,viewer,author,blocked) {
  const key=viewer+':'+author
  if(blocked) {
    c.blocks[key]=true
    const now=new Date().toISOString()
    for(const call of Object.values(root.realtime?.calls||{}))if([call.ownerId,call.peerId].includes(viewer)&&[call.ownerId,call.peerId].includes(author)&&call.state!=='ended'){call.state='ended';call.reason='blocked';call.endedAt=now}
  } else {
    delete c.blocks[key]
    for(const post of Object.values(c.posts))if(post.authorId===author)delete c.hidden[viewer+':'+post.id]
  }
}
export function contentState(root) {
  if(root.content===undefined)root.content=emptyContent()
  const c=root.content
  invariant(c&&c.version===1&&['posts','comments','echoes','events','collections','operations','preferences','hidden','blocks','reports','quota'].every(key=>c[key]&&typeof c[key]==='object'&&!Array.isArray(c[key])),'STORAGE_CORRUPT')
  upgradeDemoContent(c)
  upgradeContentSafety(root,c)
  return c
}
export function areFriends(root, a, b) { return root.social ? (root.social.conversationRulesVersion ? !!(root.social.follows?.[a+':'+b]&&root.social.follows?.[b+':'+a]) : !!root.social.friendships?.[[a,b].sort().join('|')]) : !!root.fixtures?.[a]?.friends?.includes(b) || !!root.fixtures?.[b]?.friends?.includes(a) }
export function canReadPost(root, post, viewer, { ignoreHidden = false } = {}) {
  if (!post || post.deletedAt || (post.demoScope && post.demoScope !== viewer)) return false
  const c = contentState(root)
  if (c.blocks[viewer + ':' + post.authorId] || c.blocks[post.authorId + ':' + viewer] || (!ignoreHidden && c.hidden[viewer + ':' + post.id])) return false
  if (post.authorId === viewer) return true
  return !post.visibility.private && (post.visibility.audience === 'everyone' || areFriends(root, viewer, post.authorId))
}
// Discovery preferences never grant or remove detail/profile viewing access.
export function discoveryEligible(root, post, viewer) {
  if (post.authorId === viewer) return true
  const gender = root.accounts?.[viewer]?.profile?.gender
  switch (post.audienceFilter) {
    case 'men': return gender === 'man'
    case 'women': return gender === 'woman'
    case 'excludeMen': return gender !== 'man'
    case 'excludeWomen': return gender !== 'woman'
    default: return true // Old posts without a preference use the open default.
  }
}
export function feedPosts(posts, filter = defaultFeedFilter(), { viewerId = null } = {}) {
  return posts.filter(p => p.authorId !== viewerId && p.discoveryEligible !== false && !p.visibility.private && p.visibility.discover && (filter.media === 'all' || (filter.media === 'text' ? !p.media.length : p.media.some(m => m.kind === filter.media))) && (filter.topic === 'all' || p.tagIds.includes(filter.topic)))
}
export const discoveryBatchLimit = 5
// Select a bounded circular batch without changing the authoritative post list.
export function discoveryBatch(posts, filter = defaultFeedFilter(), { viewerId = null, startId = null, afterId = null } = {}) {
  const candidates = feedPosts(posts, filter, { viewerId }).sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
  if (!candidates.length) return []
  const start = afterId === null ? Math.max(0, candidates.findIndex(p => p.id === startId)) : candidates.findIndex(p => p.id === afterId) + 1
  return Array.from({ length: Math.min(discoveryBatchLimit, candidates.length) }, (_,i) => candidates[(start+i) % candidates.length])
}
export const utcDay = (date = new Date()) => date.toISOString().slice(0, 10)

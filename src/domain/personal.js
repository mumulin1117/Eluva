import { removeCommerceAccount } from './commerce.js'
import { invariant } from './errors.js'
import { contentState, canReadPost } from './content.js'

export const themeIds = ['purple','pink','orange','cyan']
export const feedbackTopics = ['lag','crash','payment','other']
export const personalPolicy = {feedbackLimit:2000,feedbackImages:3,collectionNameLimit:60,collectionDescriptionLimit:300}
export function personalState(root) {
  if(root.personal===undefined)root.personal={version:1,preferences:{},feedback:{},operations:{},deletedReceipts:{}}
  const p=root.personal
  invariant(p&&p.version===1&&['preferences','feedback','operations','deletedReceipts'].every(k=>p[k]&&typeof p[k]==='object'&&!Array.isArray(p[k])),'STORAGE_CORRUPT')
  return p
}
export const stablePayload = p => JSON.stringify(p,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
export const ownerId=root=>{const id=root.session?.userId;invariant(id&&root.accounts[id],'AUTH_REQUIRED');return id}
export function visibleCollection(root,id,viewer) {
  const c=contentState(root),collection=c.collections[id]
  invariant(collection,'COLLECTION_UNAVAILABLE')
  const own=collection.ownerId===viewer,blocks=c.blocks
  invariant(own||(!blocks[viewer+':'+collection.ownerId]&&!blocks[collection.ownerId+':'+viewer]),'COLLECTION_UNAVAILABLE')
  const postIds=collection.postIds.filter(id=>{const p=c.posts[id];return canReadPost(root,p,viewer)&&(own||p.visibility.profile)})
  invariant(own||postIds.length,'COLLECTION_UNAVAILABLE')
  // A custom cover belongs to its owner. Never reveal it through someone else's public references.
  return {...collection,postIds,coverId:own?collection.coverId:null,editable:own}
}

// Only target-owned originals and their references are removed. Other accounts' authored messages remain stored.
export function removeAccountData(root,owner) {
  removeCommerceAccount(root,owner)
  const c=contentState(root),removedPosts=new Set(Object.values(c.posts).filter(p=>p.authorId===owner).map(p=>p.id))
  const removedComments=new Set(Object.values(c.comments).filter(x=>x.authorId===owner||removedPosts.has(x.postId)).map(x=>x.id))
  const filter=(map,predicate)=>{for(const[k,v]of Object.entries(map||{}))if(predicate(v,k))delete map[k]}
  filter(c.posts,x=>removedPosts.has(x.id));filter(c.comments,x=>removedComments.has(x.id))
  filter(c.echoes,x=>x.userId===owner||removedPosts.has(x.postId));filter(c.events,x=>x.senderId===owner||x.recipientId===owner||removedPosts.has(x.postId))
  filter(c.collections,x=>x.ownerId===owner);for(const x of Object.values(c.collections))x.postIds=x.postIds.filter(id=>!removedPosts.has(id))
  for(const map of ['preferences','quota','operations','hidden','blocks'])filter(c[map],(_,k)=>k===owner||k.startsWith(owner+':')||(map==='blocks'&&k.endsWith(':'+owner)))
  filter(c.operations,x=>removedPosts.has(x.target)||removedPosts.has(x.resultId)||removedComments.has(x.resultId))
  filter(c.reports,x=>x.ownerId===owner)
  const s=root.social,removedMessages=new Set()
  if(s){
    filter(s.messages,x=>{if(x.senderId===owner){removedMessages.add(x.id);return true}return false})
    for(const k of ['follows','requests','connections'])filter(s[k],x=>[x.senderId,x.recipientId].includes(owner))
    filter(s.friendships,x=>x.users.includes(owner));filter(s.feedback,x=>x.ownerId===owner);filter(s.reports,x=>x.ownerId===owner)
    for(const k of ['preferences','operations','eventReads','dismissedEvents'])filter(s[k],(_,key)=>key===owner||key.startsWith(owner+':'))
    delete s.profiles[owner]
  }
  if(root.realtime){
    filter(root.realtime.calls,x=>x.ownerId===owner)
    for(const call of Object.values(root.realtime.calls))if(call.peerId===owner&&call.state!=='ended'){call.state='ended';call.reason='blocked';call.endedAt=new Date().toISOString()}
    filter(root.realtime.language,x=>x.ownerId===owner||removedMessages.has(x.entityId)||removedPosts.has(x.entityId)||removedComments.has(x.entityId))
  }
  const p=personalState(root);delete p.preferences[owner];filter(p.feedback,x=>x.ownerId===owner);filter(p.operations,(_,k)=>k.startsWith(owner+':'))
  filter(root.commits,x=>x.userId===owner);delete root.fixtures[owner];delete root.accounts[owner];root.session=null
}
export function referencedMedia(root) {
  const ids=new Set(),add=id=>{if(id)ids.add(id)},c=root.content||{posts:{},collections:{}}
  for(const a of Object.values(root.accounts))for(const p of a.profile.photos||[])add(p.id)
  for(const p of Object.values(c.posts))for(const m of p.media||[])add(m.id)
  for(const x of Object.values(c.collections))add(x.coverId)
  for(const x of Object.values(root.personal?.feedback||{}))for(const id of x.mediaIds||[])add(id)
  for(const x of Object.values(root.social?.messages||{}))add(x.mediaId)
  return ids
}

import { reactive,watch } from 'vue'
import { state, bridge, run,notify } from './state.js'
import { newId } from './domain/id.js'
import { AppError } from './domain/errors.js'
import { contentPolicy, defaultVisibility, defaultFeedFilter, feedPosts, discoveryBatch } from './domain/content.js'

export const content = reactive({ ownerId: null, loaded: false, posts: [], comments: [], events: [], collections: [], blockedAuthors:[],hiddenPosts:[], preferences: {guideDone:false,feedFilter:defaultFeedFilter()}, quota: {used:0,limit:null,simulation:true}, policy:contentPolicy, draft:null,detailMediaIndices:{},presentedPosts:{}, guideStep:null, lastPublishedId:null, lastHidden:null, lastBlocked:null, feedScroll:0, feedStartId:null,feedPresentation:null })
export function resetContent() { Object.assign(content,{ownerId:null,loaded:false,posts:[],comments:[],events:[],collections:[],blockedAuthors:[],hiddenPosts:[],draft:null,detailMediaIndices:{},presentedPosts:{},guideStep:null,lastPublishedId:null,lastHidden:null,lastBlocked:null,feedScroll:0,feedStartId:null,feedPresentation:null,preferences:{guideDone:false,feedFilter:defaultFeedFilter()},quota:{used:0,limit:null,simulation:true}}) }
export async function applyContent(result,signal) {
  if(signal?.aborted)throw new AppError('CANCELLED')
  if(result.ownerId!==state.user?.id)return
  for(const post of result.posts)for(const media of post.media){
    if(media.asset){media.url='./'+media.asset;continue}
    try{media.url=(await bridge.call('media','resolve',{id:media.id},{signal})).url}catch{if(signal?.aborted)throw new AppError('CANCELLED');media.url=null;media.missing=true}
  }
  for(const collection of result.collections)if(collection.coverId)try{collection.coverUrl=(await bridge.call('media','resolve',{id:collection.coverId},{signal})).url}catch{if(signal?.aborted)throw new AppError('CANCELLED');collection.coverUrl=null}
  if(signal?.aborted)throw new AppError('CANCELLED')
  if(result.ownerId!==state.user?.id)return
  const previousFilter=content.preferences.feedFilter||defaultFeedFilter(),nextFilter=result.preferences.feedFilter||defaultFeedFilter()
  Object.assign(content,result,{loaded:true})
  if(previousFilter.media!==nextFilter.media||previousFilter.topic!==nextFilter.topic){content.feedStartId=null;content.feedPresentation=null;content.feedScroll=0}
}
// Reads only hydrate business data. Home owns when its first-use guide can
// appear, after the real batch and its presentation have settled.
export async function loadContent({reuse=false}={}) {
  const owner=state.user?.id
  // A return visit uses the same account's live snapshot, including a completed
  // empty result. Explicit reads and refreshes still reach the repository.
  if(reuse&&owner&&content.loaded&&content.ownerId===owner)return true
  if(state.ui.busy)await new Promise(resolve=>{const stop=watch(()=>state.ui.busy,value=>{if(!value){stop();resolve()}})})
  if(!owner||state.user?.id!==owner)return false
  if(content.ownerId && content.ownerId!==state.user?.id)resetContent()
  return run('content-load',async signal=>{const result=await bridge.call('content','snapshot',{}, {signal});await applyContent(result,signal)})
}
// Discovery excludes the viewer; the full readable snapshot still owns My Posts,
// profiles, details and collections. Never expose another account's cached feed.
export const hasDiscoverablePosts = () => !!state.user?.id && content.ownerId===state.user.id && feedPosts(content.posts,defaultFeedFilter(),{viewerId:state.user.id}).length>0
export const discovered = () => !state.user?.id || content.ownerId!==state.user.id ? [] : discoveryBatch(content.posts,content.preferences.feedFilter||defaultFeedFilter(),{viewerId:state.user.id,startId:content.feedStartId})
export async function refreshContent() {
  const owner=state.user?.id
  if(!owner||state.ui.busy)return false
  const afterId=discovered().at(-1)?.id||null
  return run('content-refresh',async signal=>{
    const result=await bridge.call('content','snapshot',{}, {signal})
    await applyContent(result,signal)
    if(signal.aborted||state.user?.id!==owner||result.ownerId!==owner)throw new AppError('CANCELLED')
    content.feedStartId=discoveryBatch(content.posts,content.preferences.feedFilter||defaultFeedFilter(),{viewerId:owner,afterId})[0]?.id||null
    content.feedScroll=0
  })
}
export async function mutateContent(method,params,{critical=true,notice=''}={}) {
  return run('content-'+method,async(signal,done)=>{const result=await bridge.call('content',method,params,{signal});await applyContent(result,signal);if(method==='hide'&&!params.hidden){if(content.lastHidden===params.postId)content.lastHidden=null;notify('p2.restored')}else if(method==='block'&&!params.blocked){if(content.lastBlocked===params.authorId)content.lastBlocked=null;notify('p2.unblocked')}else if(notice)notify(notice);done()}, {critical})
}
export function newPostDraft(returnPath='/home') {
  if(content.draft?.ownerId===state.user?.id)return content.draft
  content.draft={ownerId:state.user.id,id:newId(),commitId:newId(),body:'',media:[],visibility:defaultVisibility(),audienceFilter:'any',tagIds:[],collectionId:null,returnPath,ready:false}
  return content.draft
}
export async function ensurePostDraft(returnPath) {
  const draft=newPostDraft(returnPath)
  if(draft.ready)return true
  return run('content-draft',async signal=>{await bridge.call('content','beginDraft',{draftId:draft.id},{signal});draft.ready=true})
}
export function dirtyPost() { const d=content.draft;return !!d && !!(d.body.trim()||d.media.length||d.collectionId||d.tagIds.length||d.visibility.private||d.visibility.audience!=='everyone'||!d.visibility.discover||!d.visibility.profile) }
export async function discardPost() {
  if(!content.draft)return true
  return run('content-discard',async(signal,done)=>{if(content.draft.ready)await bridge.call('content','discardDraft',{draftId:content.draft.id},{signal});content.draft=null;done()},{critical:true})
}

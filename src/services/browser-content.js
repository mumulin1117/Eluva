import { invariant } from '../domain/errors.js'
import { contentState, contentPolicy, canReadPost, defaultFeedFilter, validatePost, characterCount,setAuthorBlock } from '../domain/content.js'
import { consumePublicPost, commerceSnapshot, quotaDay } from '../domain/commerce.js'
import { ageOn } from '../domain/validation.js'
import { choices } from '../data/choices.js'

const own = (root) => { const id = root.session?.userId; invariant(id && root.accounts[id], 'AUTH_REQUIRED'); return id }
const stable = value => JSON.stringify(value, (_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
const uuid = value => invariant(typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value), 'INVALID_ARGUMENT')
const available = (root, id, viewer) => { const post = contentState(root).posts[id]; invariant(canReadPost(root, post, viewer), 'POST_UNAVAILABLE'); return post }
const safeAuthor = (root, post) => {
  const profile = root.accounts[post.authorId]?.profile||root.social?.profiles?.[post.authorId]
  return profile ? { id: post.authorId, displayName: profile.displayName, age: profile.birthday?ageOn(profile.birthday):profile.age, about: profile.about || '', interestIds: profile.interestIds || [] } : { id: post.authorId, displayName: post.demoName || 'Eluva', about: '', interestIds: [] }
}
export function contentSnapshot(root, policy = contentPolicy) {
  const viewer = own(root), c = contentState(root), posts = Object.values(c.posts).filter(p => canReadPost(root, p, viewer))
  const blocked=id=>!!c.blocks[viewer+':'+id]||!!c.blocks[id+':'+viewer],comments=Object.values(c.comments).filter(x=>!blocked(x.authorId))
  return { ownerId: viewer, posts: posts.map(p => ({ ...p, author: safeAuthor(root, p), lit: !!c.echoes[viewer + ':' + p.id], litAt:c.echoes[viewer+':'+p.id]?.createdAt||null, echoCount: Object.values(c.echoes).filter(e => e.postId === p.id).length, commentCount: comments.filter(e => e.postId === p.id).length })),
    comments: comments.filter(x => posts.some(p => p.id === x.postId)).map(x => ({ ...x, authorName: root.accounts[x.authorId]?.profile.displayName || 'Eluva' })),
    events: Object.values(c.events).filter(x => x.recipientId === viewer && !blocked(x.senderId) && posts.some(p => p.id === x.postId)),
    blockedAuthors:Object.keys(c.blocks).filter(key=>key.startsWith(viewer+':')).map(key=>{const id=key.slice(viewer.length+1);return{id,name:root.accounts[id]?.profile.displayName||root.social?.profiles?.[id]?.displayName||Object.values(c.posts).find(p=>p.authorId===id)?.demoName||'Eluva'}}),
    hiddenPosts:Object.values(c.posts).filter(p=>c.hidden[viewer+':'+p.id]&&canReadPost(root,p,viewer,{ignoreHidden:true})).map(p=>({id:p.id,authorId:p.authorId,body:p.body,demoKey:p.demoKey})),
    collections: Object.values(c.collections).filter(x => x.ownerId === viewer).map(x => ({ ...x, postIds: x.postIds.filter(id => posts.some(p => p.id === id)) })), preferences: c.preferences[viewer] || { guideDone: false, feedFilter: defaultFeedFilter() },
    quota: { ...commerceSnapshot(root,viewer).quota, limit: policy.dailyPublicPosts, simulation: true }, policy: policy }
}
export async function browserContent(repo, method, params, signal) {
  const root = await repo.read(), viewer = own(root), policy=repo.contentPolicy||contentPolicy
  repo.contentDrafts ||= new Map()
  if(method==='simulateFailure'){invariant(root.accounts[viewer].isTest===true && ['publish','comment','snapshot'].includes(params.operation),'INVALID_ARGUMENT');repo.contentFailure=params.operation;return {armed:true}}
  if(method==='snapshot'&&repo.contentFailure==='snapshot'){repo.contentFailure=null;invariant(false,'STORAGE_FAILED')}
  if (method === 'snapshot') return contentSnapshot(root,policy)
  if (method === 'post') { available(root, params.id, viewer); return contentSnapshot(root,policy) }
  if (method === 'beginDraft') { uuid(params.draftId); const prior = repo.contentDrafts.get(params.draftId); invariant(!prior || prior === viewer, 'DRAFT_EXPIRED'); repo.contentDrafts.set(params.draftId, viewer); return { draftId: params.draftId } }
  if (method === 'discardDraft') {
    invariant(repo.contentDrafts.get(params.draftId) === viewer, 'DRAFT_EXPIRED')
    const ids = await repo.write(async (s, media) => { invariant(own(s) === viewer, 'AUTH_REQUIRED'); const files = await new Promise((ok,no) => { const q=media.getAll();q.onsuccess=()=>ok(q.result);q.onerror=no }), removed=[]; for (const f of files) if (f.draftId===params.draftId && f.userId===viewer && !f.committed) { media.delete(f.id); removed.push(f.id) }; return { state:s, result:removed } }, signal)
    repo.contentDrafts.delete(params.draftId); for (const id of ids) { URL.revokeObjectURL(repo.urls.get(id)); repo.urls.delete(id) }; return { discarded: true }
  }
  if(['publish','comment','createCollection','report'].includes(method)){
    const prior=contentState(root).operations[viewer+':'+params.commitId]
    if(prior){invariant(prior.method===method&&prior.target===(params.postId||params.draftId||'')&&prior.payload===stable(params),'COMMIT_CONFLICT');return {...contentSnapshot(root,policy),resultId:prior.resultId}}
  }
  const response=await repo.write(async (s, media) => {
    invariant(own(s) === viewer, 'AUTH_REQUIRED'); const c=contentState(s)
    const idempotent = ['publish','comment','createCollection','report'].includes(method)
    const opKey = viewer + ':' + params.commitId
    if (idempotent) { uuid(params.commitId); const prior=c.operations[opKey]; if (prior) { invariant(prior.method===method && prior.target===(params.postId||params.draftId||'') && prior.payload===stable(params), 'COMMIT_CONFLICT'); return {state:s,result:{...contentSnapshot(s,policy),resultId:prior.resultId}} } }
    const readMedia = id => new Promise((ok,no)=>{const q=media.get(id);q.onsuccess=()=>ok(q.result);q.onerror=no})
    let resultId
    if (method==='publish') {
      invariant(repo.contentDrafts.get(params.draftId)===viewer,'DRAFT_EXPIRED')
      const post=validatePost(params,policy), validTags=new Set(choices.interests.map(x=>x.id)); invariant(post.tagIds.every(id=>validTags.has(id)),'INVALID_FILTER')
      for(const m of post.media){const file=await readMedia(m.id);invariant(file?.userId===viewer && file.draftId===params.draftId && file.kind===m.kind,'MEDIA_MISSING');file.committed=true;media.put(file)}
      if(params.collectionId)invariant(c.collections[params.collectionId]?.ownerId===viewer,'COLLECTION_UNAVAILABLE')
      resultId=crypto.randomUUID()
      consumePublicPost(s,viewer,{commitId:params.commitId,postId:resultId,private:post.visibility.private,limit:policy.dailyPublicPosts})
      const dayKey=viewer+':'+quotaDay();if(!post.visibility.private)c.quota[dayKey]=(c.quota[dayKey]||0)+1
      c.posts[resultId]={...post,id:resultId,authorId:viewer,createdAt:new Date().toISOString()}
      if(params.collectionId)c.collections[params.collectionId].postIds.push(resultId)
    }else if(method==='echo'){
      const post=available(s,params.postId,viewer);invariant(typeof params.lit==='boolean','INVALID_ARGUMENT');const key=viewer+':'+post.id
      if(params.lit){c.echoes[key] ||= {id:key,postId:post.id,userId:viewer,createdAt:new Date().toISOString()};if(post.authorId!==viewer)c.events[key]={id:key,kind:'echo',postId:post.id,senderId:viewer,recipientId:post.authorId,createdAt:c.echoes[key].createdAt}}
      else{delete c.echoes[key];delete c.events[key]}
    }else if(method==='comment'){
      const post=available(s,params.postId,viewer),body=String(params.body||'').trim();invariant(body && characterCount(body)<=policy.commentLimit,'INVALID_COMMENT');invariant(post.authorId===viewer||c.echoes[viewer+':'+post.id],'ECHO_REQUIRED')
      resultId=crypto.randomUUID();c.comments[resultId]={id:resultId,postId:post.id,authorId:viewer,body,createdAt:new Date().toISOString()}
    }else if(method==='createCollection'){
      const name=String(params.name||'').trim(),description=String(params.description||'').trim();invariant(name && characterCount(name)<=60 && characterCount(description)<=300,'INVALID_COLLECTION')
      let coverId=null;if(params.coverId){const f=await readMedia(params.coverId);invariant(f?.userId===viewer&&f.kind==='image'&&f.draftId===params.draftId&&repo.contentDrafts.get(params.draftId)===viewer&&!f.messagePeerId,'MEDIA_MISSING');f.committed=true;media.put(f);coverId=f.id}
      resultId=crypto.randomUUID();c.collections[resultId]={id:resultId,ownerId:viewer,name,description,coverId,postIds:[],createdAt:new Date().toISOString()}
    }else if(method==='preferences'){
      const prefs=c.preferences[viewer]||{guideDone:false,feedFilter:defaultFeedFilter()}
      if(params.guideDone!==undefined){invariant(typeof params.guideDone==='boolean','INVALID_ARGUMENT');prefs.guideDone=params.guideDone}
      if(params.feedFilter){const f=params.feedFilter;invariant(['all','image','video','text'].includes(f.media)&&(f.topic==='all'||choices.interests.some(x=>x.id===f.topic)),'INVALID_FILTER');prefs.feedFilter={media:f.media,topic:f.topic}}
      c.preferences[viewer]=prefs
    }else if(method==='hide'){
      const post=c.posts[params.postId];invariant(canReadPost(s,post,viewer,{ignoreHidden:true}),'POST_UNAVAILABLE');invariant(typeof params.hidden==='boolean','INVALID_ARGUMENT');if(params.hidden&&post.authorId!==viewer)setAuthorBlock(s,c,viewer,post.authorId,true);else if(params.hidden)c.hidden[viewer+':'+post.id]=true;else delete c.hidden[viewer+':'+post.id]
    }else if(method==='report'){
      available(s,params.postId,viewer);invariant(['harassment','hate','sexual','violence','spam','impersonation','misinformation'].includes(params.reason)&&characterCount(params.details||'')<=500,'INVALID_REPORT');resultId=crypto.randomUUID();c.reports[resultId]={id:resultId,ownerId:viewer,postId:params.postId,reason:params.reason,details:params.details||'',simulation:true,createdAt:new Date().toISOString()}
    }else if(method==='block'){
      invariant(params.authorId!==viewer&&typeof params.blocked==='boolean','INVALID_ARGUMENT');invariant(s.accounts[params.authorId]||Object.values(c.posts).some(p=>p.authorId===params.authorId),'ACCOUNT_NOT_FOUND');setAuthorBlock(s,c,viewer,params.authorId,params.blocked)
    }else invariant(false,'METHOD_NOT_FOUND')
    if(repo.contentFailure===method){repo.contentFailure=null;invariant(false,'STORAGE_FAILED')}
    if(idempotent)c.operations[opKey]={method,target:params.postId||params.draftId||'',payload:stable(params),resultId}
    return {state:s,result:{...contentSnapshot(s,policy),...(resultId?{resultId}:{})}}
  },signal)
  if(method==='publish')repo.contentDrafts.delete(params.draftId)
  return response
}

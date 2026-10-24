import { invariant } from '../domain/errors.js'
import { characterCount, contentState, canReadPost,setAuthorBlock } from '../domain/content.js'
import { socialState,pairId,isBlocked,profileFor,relationship,requirePeer,requireThread,activities,compareSocialMessages } from '../domain/social.js'
import { stickerIds } from '../data/social-demo.js'
import { validateMessageParts } from '../domain/message-parts.js'

const own=root=>{const id=root.session?.userId;invariant(id&&root.accounts[id],'AUTH_REQUIRED');return id}
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)
const uuid=x=>invariant(typeof x==='string'&&/^[0-9a-f-]{36}$/i.test(x),'INVALID_ARGUMENT')
export function socialSnapshot(root){
  const viewer=own(root),s=socialState(root),c=contentState(root),profiles=[]
  for(const id of new Set([...Object.keys(root.accounts),...Object.keys(s.profiles),...Object.values(c.posts).map(p=>p.authorId)]))try{const p=profileFor(root,id,viewer);const r=id===viewer?null:relationship(root,viewer,id);profiles.push({...p,relationship:r,counts:{following:Object.values(s.follows).filter(x=>x.senderId===id).length,followers:Object.values(s.follows).filter(x=>x.recipientId===id).length,friends:Object.values(s.follows).filter(x=>x.senderId===id&&s.follows[x.recipientId+':'+id]&&!isBlocked(root,id,x.recipientId)).length}})}catch{/* scoped demo or unavailable author */}
  const threads=Object.values(s.threads).filter(t=>t.users.includes(viewer)).map(t=>{const peer=t.users.find(x=>x!==viewer),blocked=isBlocked(root,viewer,peer)||(!root.accounts[peer]&&!s.profiles[peer]),messages=blocked?[]:Object.values(s.messages).filter(m=>m.threadId===t.id).sort(compareSocialMessages);return {...t,peerId:peer,blocked,messages,unread:messages.filter(m=>m.recipientId===viewer&&!m.readAt).length}})
  const visibleThreads=threads.filter(t=>!t.blocked)
  const events=activities(root,viewer),requests=Object.values(s.requests).filter(r=>[r.senderId,r.recipientId].includes(viewer)&&!isBlocked(root,r.senderId,r.recipientId)).map(r=>({...r,direction:r.senderId===viewer?'sent':'received',blocked:false}))
  return {ownerId:viewer,profiles,threads:visibleThreads,requests,events,unreadCount:visibleThreads.reduce((n,t)=>n+t.unread,0)+events.filter(x=>x.lightOnly&&!x.read).length+requests.filter(x=>x.direction==='received'&&x.status==='pending').length,preferences:s.preferences[viewer]||{filter:'all',unreadOnly:false},feedback:Object.values(s.feedback).filter(x=>x.ownerId===viewer),profilePosts:Object.values(c.posts).filter(p=>canReadPost(root,p,viewer)&&p.visibility.profile),collections:Object.values(c.collections).filter(x=>profiles.some(p=>p.id===x.ownerId)&&!isBlocked(root,viewer,x.ownerId)).map(x=>({...x,coverId:x.ownerId===viewer?x.coverId:null,postIds:x.postIds.filter(id=>{const p=c.posts[id];return p&&canReadPost(root,p,viewer)&&p.visibility.profile})})).filter(x=>x.postIds.length)}
}
export async function browserSocial(repo,method,p,signal){
  const root=await repo.read(),viewer=own(root);socialState(root);repo.socialDrafts||=new Map()
  if(method==='simulateFailure'){invariant(root.accounts[viewer].isTest&&['send','request','accept','ignore','snapshot','follow','help','replyPost','declineConnection'].includes(p.operation),'INVALID_ARGUMENT');repo.socialFailure=p.operation;return {armed:true}}
  if(method==='snapshot'&&repo.socialFailure===method){repo.socialFailure=null;invariant(false,'STORAGE_FAILED')}
  const grant=peer=>{repo.profileMediaGrants||=new Map();const ids=repo.profileMediaGrants.get(viewer)||new Set();if(!isBlocked(root,viewer,peer))for(const photo of profileFor(root,peer,viewer).photos)ids.add(photo.id);repo.profileMediaGrants.set(viewer,ids)}
  if(method==='profile'){profileFor(root,p.peerId,viewer);grant(p.peerId);return socialSnapshot(root)}
  if(method==='thread'){requireThread(root,viewer,p.peerId);grant(p.peerId);return socialSnapshot(root)}
  if(method==='requireFriend'){requirePeer(root,viewer,p.peerId,{friend:true});return {allowed:true}}
  if(method==='beginDraft'){uuid(p.draftId);requirePeer(root,viewer,p.peerId,{friend:true});const old=repo.socialDrafts.get(p.draftId);invariant(!old||(old.ownerId===viewer&&old.peerId===p.peerId),'DRAFT_EXPIRED');repo.socialDrafts.set(p.draftId,{ownerId:viewer,peerId:p.peerId});return {draftId:p.draftId}}
  if(method==='discardDraft'){
    invariant(repo.socialDrafts.get(p.draftId)?.ownerId===viewer,'DRAFT_EXPIRED')
    const ids=await repo.write(async(s,media)=>{invariant(own(s)===viewer,'AUTH_REQUIRED');const all=await new Promise((ok,no)=>{const q=media.getAll();q.onsuccess=()=>ok(q.result);q.onerror=no}),removed=[];for(const f of all)if(f.draftId===p.draftId&&f.userId===viewer&&!f.committed){media.delete(f.id);removed.push(f.id)}return {state:s,result:removed}},signal)
    repo.socialDrafts.delete(p.draftId);for(const id of ids){URL.revokeObjectURL(repo.urls.get(id));repo.urls.delete(id)}return {discarded:true}
  }
  const idempotent=['request','accept','ignore','send','help','report','replyPost','declineConnection','clearLightEvents','restoreLightEvents'].includes(method)
  if(idempotent){uuid(p.commitId);const prior=socialState(root).operations[viewer+':'+p.commitId];if(prior){invariant(prior.method===method&&prior.payload===stable(p),'COMMIT_CONFLICT');return {...socialSnapshot(root),resultId:prior.resultId}}}
  return repo.write(async(s,media)=>{
    invariant(own(s)===viewer,'AUTH_REQUIRED');const d=socialState(s),now=new Date().toISOString(),op=viewer+':'+p.commitId;let resultId
    if(idempotent&&d.operations[op]){const prior=d.operations[op];invariant(prior.method===method&&prior.payload===stable(p),'COMMIT_CONFLICT');return {state:s,result:{...socialSnapshot(s),resultId:prior.resultId}}}
    const threadFor=peer=>{const pair=pairId(viewer,peer);let t=Object.values(d.threads).find(t=>t.pair===pair);if(!t){t={id:'thread:'+pair,pair,users:[viewer,peer],createdAt:now};d.threads[t.id]=t}return t}
    switch(method){
      case 'snapshot':break // Persist the additive migration before returning it.
      case 'follow':requirePeer(s,viewer,p.peerId);invariant(typeof p.following==='boolean','INVALID_ARGUMENT');if(p.following)d.follows[viewer+':'+p.peerId]={senderId:viewer,recipientId:p.peerId,createdAt:now};else delete d.follows[viewer+':'+p.peerId];break
      case 'request':{
        requirePeer(s,viewer,p.peerId);const relation=relationship(s,viewer,p.peerId);invariant(!relation.friends,'ALREADY_FRIENDS');invariant(!relation.request,relation.request?.status==='ignored'?'REQUEST_IGNORED':'REQUEST_PENDING');const body=String(p.body||'').trim();invariant(body&&characterCount(body)<=500,'INVALID_INTRO');resultId=crypto.randomUUID();d.requests[resultId]={id:resultId,pair:pairId(viewer,p.peerId),senderId:viewer,recipientId:p.peerId,body,status:'pending',createdAt:now};break}
      case 'accept':case 'ignore':{
        const r=d.requests[p.requestId];invariant(r&&r.recipientId===viewer,'REQUEST_UNAVAILABLE');requirePeer(s,viewer,r.senderId);invariant(r.status==='pending','REQUEST_RESOLVED');r.status=method==='accept'?'accepted':'ignored';r.resolvedAt=now;if(method==='accept'){d.friendships[r.pair]||={id:r.pair,users:[r.senderId,viewer],createdAt:now};for(const [a,b] of [[viewer,r.senderId],[r.senderId,viewer]])d.follows[a+':'+b]||={senderId:a,recipientId:b,createdAt:now};threadFor(r.senderId)}resultId=r.id;break}
      case 'replyPost':{
        const c=contentState(s),post=c.posts[p.postId];invariant(post&&canReadPost(s,post,viewer),'POST_UNAVAILABLE');const peer=post.authorId;requirePeer(s,viewer,peer);invariant(c.echoes[viewer+':'+post.id],'ECHO_REQUIRED');const r=relationship(s,viewer,peer);invariant(!r.canMessage,'CONNECTION_ESTABLISHED');invariant(!r.connection,r.connection?.status==='declined'?'CONNECTION_DECLINED':'CONNECTION_PENDING');const body=String(p.body||'').trim();invariant(body&&characterCount(body)<=500,'INVALID_INTRO');const t=threadFor(peer);resultId=crypto.randomUUID();d.messages[resultId]={id:resultId,threadId:t.id,senderId:viewer,recipientId:peer,kind:'text',body,postId:post.id,connectionIntro:true,createdAt:now,readAt:null};const pair=pairId(viewer,peer);d.connections[pair]={id:pair,pair,senderId:viewer,recipientId:peer,postId:post.id,introMessageId:resultId,status:'pending',createdAt:now};break}
      case 'declineConnection':{
        requirePeer(s,viewer,p.peerId);const x=d.connections[pairId(viewer,p.peerId)];invariant(x&&x.recipientId===viewer,'CONNECTION_UNAVAILABLE');invariant(x.status==='pending','CONNECTION_RESOLVED');invariant(!relationship(s,viewer,p.peerId).canMessage,'CONNECTION_ESTABLISHED');x.status='declined';x.resolvedAt=now;resultId=x.id;break}
      case 'send':{
        requirePeer(s,viewer,p.peerId);const relation=relationship(s,viewer,p.peerId),responding=relation.connection?.status==='pending'&&relation.connection.recipientId===viewer;invariant(relation.canMessage||responding,'FRIENDSHIP_REQUIRED');if(responding&&!relation.canMessage)invariant(p.kind==='text','CONNECTION_REPLY_REQUIRED');invariant(['text','image','sticker','voice'].includes(p.kind),'INVALID_MESSAGE');let voiceDuration;const body=String(p.body||'').trim();invariant(characterCount(body)<=2000,'INVALID_MESSAGE');let parts;if(p.parts!==undefined){invariant(p.kind==='text'&&typeof p.body==='string'&&p.body===body,'INVALID_MESSAGE');parts=validateMessageParts(p.parts,body);if(responding&&!relation.canMessage)invariant(!parts.some(x=>x.type==='sticker'),'CONNECTION_REPLY_REQUIRED')}else if(p.kind==='text')invariant(body,'INVALID_MESSAGE');if(p.kind==='sticker')invariant(stickerIds.includes(p.stickerId),'INVALID_MESSAGE')
        if(['image','voice'].includes(p.kind)){const draft=repo.socialDrafts.get(p.draftId);invariant(draft?.ownerId===viewer&&draft.peerId===p.peerId,'DRAFT_EXPIRED');const f=await new Promise((ok,no)=>{const q=media.get(p.mediaId);q.onsuccess=()=>ok(q.result);q.onerror=no});invariant(f?.userId===viewer&&f.draftId===p.draftId&&f.kind===p.kind&&!f.committed,'MEDIA_MISSING');if(p.kind==='voice')voiceDuration=f.duration;f.committed=true;f.messagePeerId=p.peerId;media.put(f)}
        const t=threadFor(p.peerId);resultId=crypto.randomUUID();d.messages[resultId]={id:resultId,threadId:t.id,senderId:viewer,recipientId:p.peerId,kind:p.kind,body,...(parts?{parts}:{}),...(p.kind==='text'?{body}:['image','voice'].includes(p.kind)?{mediaId:p.mediaId}:{stickerId:p.stickerId}),...(p.kind==='voice'?{duration:voiceDuration}:{}),createdAt:now,readAt:null};if(responding){const x=d.connections[pairId(viewer,p.peerId)];x.status='connected';x.resolvedAt=now;x.replyMessageId=resultId}break}
      case 'read':{
        requireThread(s,viewer,p.peerId);const t=Object.values(d.threads).find(x=>x.pair===pairId(viewer,p.peerId));if(t)for(const m of Object.values(d.messages))if(m.threadId===t.id&&m.recipientId===viewer&&!m.readAt)m.readAt=now;break}
      case 'readEvents':{invariant(Array.isArray(p.eventIds),'INVALID_ARGUMENT');const allowed=new Set(activities(s,viewer).map(x=>x.id));invariant(p.eventIds.every(x=>allowed.has(x)),'INVALID_ARGUMENT');for(const id of p.eventIds)d.eventReads[viewer+':'+id]=now;break}
      case 'clearLightEvents':case 'restoreLightEvents':{invariant(Array.isArray(p.eventIds)&&p.eventIds.every(x=>typeof x==='string'),'INVALID_ARGUMENT');const allowed=new Set(activities(s,viewer).filter(x=>x.lightOnly).map(x=>x.id));invariant(p.eventIds.every(id=>allowed.has(id)||d.dismissedEvents[viewer+':'+id]),'INVALID_ARGUMENT');for(const id of p.eventIds){if(method==='clearLightEvents')d.dismissedEvents[viewer+':'+id]=now;else delete d.dismissedEvents[viewer+':'+id]}break}
      case 'lightHelpSeen':{invariant(p.seen===true,'INVALID_ARGUMENT');d.preferences[viewer]={filter:'all',unreadOnly:false,...d.preferences[viewer],lightHelpSeen:true};break}
      case 'preferences':{invariant(['all','following','lights'].includes(p.filter)&&typeof p.unreadOnly==='boolean','INVALID_ARGUMENT');d.preferences[viewer]={...d.preferences[viewer],filter:p.filter,unreadOnly:p.unreadOnly};break}
      case 'block':{profileFor(s,p.peerId,viewer);invariant(p.peerId!==viewer&&typeof p.blocked==='boolean','INVALID_ARGUMENT');setAuthorBlock(s,contentState(s),viewer,p.peerId,p.blocked);break}
      case 'report':{requirePeer(s,viewer,p.peerId);invariant(['harassment','hate','sexual','violence','spam','impersonation','misinformation'].includes(p.reason)&&characterCount(p.details||'')<=500,'INVALID_REPORT');resultId=crypto.randomUUID();d.reports[resultId]={id:resultId,ownerId:viewer,targetType:'user',targetId:p.peerId,reason:p.reason,details:p.details||'',simulation:true,createdAt:now};break}
      case 'help':{const body=String(p.body||'').trim();invariant(body&&characterCount(body)<=2000,'INVALID_MESSAGE');invariant(['how','posting','privacy','feedback'].includes(p.topic),'INVALID_ARGUMENT');resultId=crypto.randomUUID();d.feedback[resultId]={id:resultId,ownerId:viewer,body,topic:p.topic,createdAt:now,simulation:true};break}
      default:invariant(false,'METHOD_NOT_FOUND')
    }
    if(repo.socialFailure===method){repo.socialFailure=null;invariant(false,'STORAGE_FAILED')}
    if(idempotent)d.operations[op]={method,payload:stable(p),resultId};return {state:s,result:{...socialSnapshot(s),...(resultId?{resultId}:{})}}
  },signal)
}

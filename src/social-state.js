import { actionNotice } from './domain/notice.js'
import { reactive,watch } from 'vue'
import { state,bridge,run,notify } from './state.js'
import { content,loadContent } from './content-state.js'
import { newId } from './domain/id.js'
import { AppError,asAppError } from './domain/errors.js'

const empty=()=>({ownerId:null,loaded:false,loadError:'',chatsVisited:false,presentedProfiles:{},presentedThreads:{},profiles:[],threads:[],requests:[],events:[],unreadCount:0,preferences:{filter:'all',unreadOnly:false},feedback:[],profilePosts:[],collections:[],drafts:{},intros:{},reportDrafts:{},helpDraft:{body:'',topic:'feedback',commitId:newId()}})
export const social=reactive(empty())
let loading,loadController,loadOwner,blockProjectionEpoch=0,publishingSocialBlocks=false
function cancelRead(){loadController?.abort();loadController=null;loading=null;loadOwner=null}
export function resetSocial(){cancelRead();Object.assign(social,empty())}
export const person=id=>social.profiles.find(x=>x.id===id)
export const conversation=id=>social.threads.find(x=>x.peerId===id)
export function messageDraft(peer){
 const draft=social.drafts[peer]||=( {peerId:peer,draftId:newId(),commitId:newId(),body:'',media:null,stickerId:null,ready:false} )
 // Upgrade only the current in-memory composer, preserving old unsent text and
 // its selected expression; stored historical sticker messages stay untouched.
 if(!draft.parts){draft.parts=[...(draft.body?[{type:'text',text:draft.body}]:[]),...(draft.stickerId?[{type:'sticker',stickerId:draft.stickerId}]:[])];draft.stickerId=null}
 return draft
}
export function introDraft(peer){return social.intros[peer]||={body:'',commitId:newId()}}
export const reportDraftKey=(type,id)=>state.user?.id+':'+type+':'+id
export function reportDraft(type,id){return social.reportDrafts[reportDraftKey(type,id)]||={reason:'harassment',details:'',commitId:newId()}}
function excludeBlocked(view,blocked,removed){
 view.threads=(view.threads||[]).filter(t=>!t.blocked&&!blocked.has(t.peerId))
 view.requests=(view.requests||[]).filter(r=>!r.blocked&&!blocked.has(r.senderId)&&!blocked.has(r.recipientId))
 view.events=(view.events||[]).filter(e=>![e.peerId,e.senderId,e.recipientId,e.authorId].some(id=>blocked.has(id))&&!removed.has(e.postId))
 view.profilePosts=(view.profilePosts||[]).filter(p=>!blocked.has(p.authorId)&&!removed.has(p.id))
 view.collections=(view.collections||[]).filter(c=>!blocked.has(c.ownerId)).map(c=>({...c,postIds:c.postIds.filter(id=>!removed.has(id))})).filter(c=>c.postIds.length)
 view.unreadCount=view.threads.reduce((n,t)=>n+(t.unread||0),0)+view.events.filter(e=>e.lightOnly&&!e.read).length+view.requests.filter(r=>r.direction==='received'&&r.status==='pending').length
}
function projectSocialBlocks(profiles,blocked,removed,owner){
 if(social.ownerId!==owner)return
 const byId=new Map(profiles.map(p=>[p.id,p])),known=new Set(social.profiles.map(p=>p.id))
 social.profiles=social.profiles.map(p=>byId.has(p.id)?{...p,relationship:{...p.relationship,...byId.get(p.id).relationship},photos:[]}:p)
 social.profiles.push(...profiles.filter(p=>!known.has(p.id)))
 excludeBlocked(social,blocked,removed)
}
function projectCommittedBlocks(result,owner){
 const profiles=result.profiles.filter(p=>p.relationship?.blocked),blocked=new Set(profiles.map(p=>p.id))
 const ownedSocial=social.ownerId===owner,ownedContent=content.ownerId===owner
 const posts=[...(result.profilePosts||[]),...(ownedSocial?social.profilePosts:[]),...(ownedContent?[...content.posts,...content.hiddenPosts]:[])]
 const removed=new Set(posts.filter(p=>blocked.has(p.authorId)).map(p=>p.id))
 for(const p of profiles)p.photos=[]
 // The snapshot confirms a committed block. Apply only its safety projection
 // before resolving unrelated media; a slow photo must not keep a blocked
 // profile, conversation or post visible in an already-loaded view.
 if(ownedSocial)projectSocialBlocks(profiles,blocked,removed,owner)
 excludeBlocked(result,blocked,removed)
 if(ownedContent){
  content.posts=content.posts.filter(p=>!blocked.has(p.authorId))
  content.hiddenPosts=content.hiddenPosts.filter(p=>!removed.has(p.id))
  content.comments=content.comments.filter(c=>!blocked.has(c.authorId)&&!removed.has(c.postId))
  if(removed.has(content.lastHidden))content.lastHidden=null
  content.events=content.events.filter(e=>![e.peerId,e.senderId,e.recipientId,e.authorId].some(id=>blocked.has(id))&&!removed.has(e.postId))
  content.collections=content.collections.filter(c=>!blocked.has(c.ownerId)).map(c=>({...c,postIds:c.postIds.filter(id=>!removed.has(id))}))
  const known=new Set(result.profiles.map(p=>p.id))
  const wasPublishing=publishingSocialBlocks;publishingSocialBlocks=true
  try{content.blockedAuthors=[...content.blockedAuthors.filter(p=>!known.has(p.id)),...profiles.filter(p=>p.relationship?.blockedByMe).map(p=>({id:p.id,name:p.displayName}))]}
  finally{publishingSocialBlocks=wasPublishing}
 }
}
export async function applySocial(result,signal){
 if(signal?.aborted)throw new AppError('CANCELLED')
 const owner=state.user?.id;if(!owner||result.ownerId!==owner)return
 projectCommittedBlocks(result,owner)
 const safetyEpoch=blockProjectionEpoch
 for(const p of result.profiles){if(p.relationship?.blocked){p.photos=[];continue}for(const photo of p.photos){if(photo.asset&&p.demo){photo.url='./'+photo.asset;continue}try{photo.url=(await bridge.call('media','resolve',{id:photo.id},{signal})).url}catch{photo.url=null}}}
 for(const thread of result.threads)for(const m of thread.messages)if(m.mediaId)try{m.url=(await bridge.call('media','resolve',{id:m.mediaId},{signal})).url}catch{m.missing=true}
 if(signal?.aborted)throw new AppError('CANCELLED');if(state.user?.id!==owner)return
 if(safetyEpoch!==blockProjectionEpoch)throw new AppError('CANCELLED')
 Object.assign(social,result,{loaded:true,loadError:''})
}
// Read-only snapshots must finish independently of the global mutation lock.
// TabBar and Chats share one request, including an empty successful snapshot.
export function loadSocial({quiet=false,reuse=false}={}){
 const owner=state.user?.id
 if(!owner)return Promise.resolve(false)
 if(reuse&&social.loaded&&social.ownerId===owner)return Promise.resolve(true)
 if(!quiet&&!state.ui.busy)state.ui.error=null
 if(loading&&loadOwner===owner)return loading
 cancelRead();const controller=new AbortController();loadController=controller;loadOwner=owner;social.loadError=''
 const task=(async()=>{
  try{
   const result=await bridge.call('social','snapshot',{}, {signal:controller.signal})
   if(controller.signal.aborted||state.user?.id!==owner)return false
   if(result.ownerId!==owner)throw new AppError('AUTH_REQUIRED')
   await applySocial(result,controller.signal)
   return !controller.signal.aborted&&state.user?.id===owner&&social.loaded
  }catch(error){
   const normalized=asAppError(error)
   if(!controller.signal.aborted&&state.user?.id===owner&&normalized.code!=='CANCELLED'){
    social.loadError=normalized.code
    if(!quiet&&!state.ui.busy)state.ui.error=normalized.code
   }
   return false
  }finally{if(loadController===controller){loadController=null;loading=null;loadOwner=null}}
 })()
 loading=task;return task
}
export async function socialAction(method,params,{notice=actionNotice('social',method,params),critical=true}={}){
 cancelRead()
 const ok=await run('social-'+method,async(signal,done)=>{await applySocial(await bridge.call('social',method,params,{signal}),signal);if(notice)notify(notice);done()},{critical})
 if(ok&&['block','accept','follow'].includes(method))await loadContent({quiet:true})
 return ok
}
export async function ensureMessageDraft(peer){const d=messageDraft(peer);if(d.ready)return true;return run('social-draft',async signal=>{await bridge.call('social','beginDraft',{peerId:peer,draftId:d.draftId},{signal});d.ready=true})}
// content.hide may commit the author's block before a social snapshot is read.
// Project new blocks synchronously; a missing row never implies an unblock.
watch(()=>[content.ownerId,content.blockedAuthors.map(x=>x.id).sort().join('|')],([owner,ids],[previousOwner,previousIds])=>{
 if(!owner||state.user?.id!==owner)return
 const previous=new Set(previousOwner===owner?previousIds.split('|'):[]),added=content.blockedAuthors.filter(p=>!previous.has(p.id))
 if(!added.length)return
 blockProjectionEpoch++
 // Discard a snapshot read before content.hide committed this block. Its late
 // media resolution must not restore the old profile or conversation cache.
 // A social snapshot publishing its own block is already authoritative.
 if(!publishingSocialBlocks)cancelRead()
 if(social.ownerId!==owner)return
 const blocked=new Set(added.map(p=>p.id)),removed=new Set([...social.profilePosts,...content.posts,...content.hiddenPosts].filter(p=>blocked.has(p.authorId)).map(p=>p.id))
 const profiles=added.map(p=>({id:p.id,displayName:person(p.id)?.displayName||p.name,photos:[],relationship:{...person(p.id)?.relationship,blocked:true,blockedByMe:true,canMessage:false}}))
 projectSocialBlocks(profiles,blocked,removed,owner)
},{flush:'sync'})
watch(()=>[content.blockedAuthors.map(x=>x.id).sort().join('|'),content.posts.map(x=>x.id+':'+x.lit+':'+x.commentCount).sort().join('|'),content.events.map(x=>x.id).sort().join('|')].join(';'),()=>{if(state.user)loadSocial({quiet:true})})


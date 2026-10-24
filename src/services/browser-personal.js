import { conversationVersion } from '../data/auth-conversation.js'
import { invariant } from '../domain/errors.js'
import { validateProfile, normalizeEmail, textLength } from '../domain/validation.js'
import { choices } from '../data/choices.js'
import { contentState, canReadPost } from '../domain/content.js'
import { personalState, ownerId, themeIds, feedbackTopics, personalPolicy, stablePayload, visibleCollection, removeAccountData, referencedMedia } from '../domain/personal.js'
import { contentSnapshot } from './browser-content.js'
import { socialSnapshot } from './browser-social.js'
const uuid=id=>invariant(typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id),'INVALID_ARGUMENT')
const req=q=>new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})
const user=(root,id)=>{const a=root.accounts[id];return {id:a.id,email:a.email,isTest:!!a.isTest,registrationVersion:a.onboarding?.version||null,profile:a.profile}}
function snapshot(root){const id=ownerId(root),p=personalState(root);return {ownerId:id,user:user(root,id),fixtures:root.fixtures[id]||{friends:[],requests:[],threads:[]},preferences:p.preferences[id]||{theme:'purple'},connections:{following:Object.values(root.social?.follows||{}).filter(x=>x.senderId===id).map(x=>x.recipientId),followers:Object.values(root.social?.follows||{}).filter(x=>x.recipientId===id).map(x=>x.senderId)},feedback:Object.values(p.feedback).filter(x=>x.ownerId===id),content:contentSnapshot(root),social:socialSnapshot(root)}}
export async function browserPersonal(repo,method,p,signal){
  // Match the native JSON envelope: submitted values must not retain Vue proxies or live form references.
  p=JSON.parse(JSON.stringify(p))
  const root=await repo.read(),personal=personalState(root)
  if(method==='deleteAccount'&&personal.deletedReceipts[p.commitId]&&!root.session)return {deleted:true}
  const viewer=ownerId(root)
  if(method==='simulateFailure'){invariant(root.accounts[viewer].isTest&&['snapshot','saveProfile','savePreferences','saveCollection','collectionPosts','deleteCollection','deletePost','submitFeedback','deleteAccount'].includes(p.operation),'INVALID_ARGUMENT');repo.personalFailure={ownerId:viewer,method:p.operation};return {armed:true}}
  if(method==='snapshot'){if(repo.personalFailure?.ownerId===viewer&&repo.personalFailure.method===method){repo.personalFailure=null;invariant(false,'STORAGE_FAILED')}return snapshot(root)}
  if(method==='collection')return {...snapshot(root),collection:visibleCollection(root,p.id,viewer)}
  uuid(p.commitId);const op=viewer+':'+p.commitId,payload=stablePayload(p),prior=personal.operations[op]
  if(prior){invariant(prior.method===method&&prior.payload===payload,'COMMIT_CONFLICT');return {...snapshot(root),resultId:prior.resultId}}
  const removedFiles=[]
  const result=await repo.write(async(s,media)=>{
    invariant(ownerId(s)===viewer,'AUTH_REQUIRED');const d=personalState(s),c=contentState(s),old=d.operations[op]
    if(old){invariant(old.method===method&&old.payload===payload,'COMMIT_CONFLICT');return {state:s,result:{...snapshot(s),resultId:old.resultId}}}
    let resultId;const garbage=[]
    const staged=async id=>{const f=await req(media.get(id));invariant(repo.contentDrafts?.get(p.draftId)===viewer&&f?.userId===viewer&&f.draftId===p.draftId&&f.kind==='image'&&!f.messagePeerId&&!f.committed,'MEDIA_MISSING');f.committed=true;await req(media.put(f));return f}
    switch(method){
      case 'saveProfile':{
        const previous=s.accounts[viewer].profile,raw={...p.profile,photos:(p.profile?.photos||[]).map(x=>({id:x.id}))},base={...previous,photos:previous.photos.map(x=>({id:x.id}))}
        const profile=validateProfile(raw,choices,new Date(),base,s.accounts[viewer].onboarding?.version===conversationVersion)
        for(const photo of profile.photos)if(!base.photos.some(x=>x.id===photo.id))await staged(photo.id)
        garbage.push(...base.photos.filter(x=>!profile.photos.some(p=>p.id===x.id)).map(x=>x.id))
        s.accounts[viewer].profile={...profile,photos:profile.photos.map(x=>({id:x.id})),communityVersion:previous.communityVersion}
        break
      }
      case 'savePreferences':invariant(themeIds.includes(p.theme),'INVALID_ARGUMENT');d.preferences[viewer]={...d.preferences[viewer],theme:p.theme};break
      case 'saveCollection':{
        const x=c.collections[p.id];invariant(x?.ownerId===viewer,'COLLECTION_UNAVAILABLE');const name=String(p.name||'').trim(),description=String(p.description||'').trim();invariant(name&&textLength(name)<=60&&textLength(description)<=300,'INVALID_COLLECTION')
        let coverId=p.coverId||null;if(coverId&&coverId!==x.coverId)await staged(coverId)
        if(x.coverId&&x.coverId!==coverId)garbage.push(x.coverId)
        Object.assign(x,{name,description,coverId,updatedAt:new Date().toISOString()});resultId=x.id;break
      }
      case 'collectionPosts':{
        const x=c.collections[p.id];invariant(x?.ownerId===viewer,'COLLECTION_UNAVAILABLE');invariant(Array.isArray(p.postIds)&&new Set(p.postIds).size===p.postIds.length,'INVALID_COLLECTION')
        invariant(p.postIds.every(id=>c.posts[id]?.authorId===viewer&&canReadPost(s,c.posts[id],viewer)),'POST_UNAVAILABLE');x.postIds=[...p.postIds];resultId=x.id;break
      }
      case 'deleteCollection':invariant(c.collections[p.id]?.ownerId===viewer,'COLLECTION_UNAVAILABLE');if(c.collections[p.id].coverId)garbage.push(c.collections[p.id].coverId);delete c.collections[p.id];break
      case 'deletePost':{
        invariant(c.posts[p.id]?.authorId===viewer,'POST_UNAVAILABLE');garbage.push(...c.posts[p.id].media.map(x=>x.id));delete c.posts[p.id]
        const removedComments=new Set();for(const[id,x]of Object.entries(c.comments))if(x.postId===p.id){removedComments.add(id);delete c.comments[id]}
        for(const[id,x]of Object.entries(c.operations))if(x.resultId===p.id||x.target===p.id)delete c.operations[id]
        for(const k of ['echoes','events'])for(const[id,x]of Object.entries(c[k]))if(x.postId===p.id)delete c[k][id]
        for(const x of Object.values(c.collections))x.postIds=x.postIds.filter(id=>id!==p.id)
        for(const[id,x]of Object.entries(s.realtime?.language||{}))if(x.entityId===p.id||removedComments.has(x.entityId))delete s.realtime.language[id]
        break
      }
      case 'submitFeedback':{
        const body=String(p.body||'').trim();invariant(body&&textLength(body)<=personalPolicy.feedbackLimit&&feedbackTopics.includes(p.topic),'INVALID_FEEDBACK');invariant(Array.isArray(p.mediaIds)&&p.mediaIds.length<=personalPolicy.feedbackImages&&new Set(p.mediaIds).size===p.mediaIds.length,'INVALID_MEDIA')
        for(const id of p.mediaIds)await staged(id);resultId=crypto.randomUUID();d.feedback[resultId]={id:resultId,ownerId:viewer,body,topic:p.topic,mediaIds:[...p.mediaIds],createdAt:new Date().toISOString(),localOnly:true};break
      }
      case 'deleteAccount':{
        invariant(!s.accounts[viewer].isTest,'TEST_ACCOUNT_READ_ONLY');invariant(p.confirmed===true&&normalizeEmail(p.confirmEmail)===s.accounts[viewer].email,'DELETE_CONFIRMATION_REQUIRED')
        for(const f of await req(media.getAll()))if(f.userId===viewer)await req(media.delete(f.id))
        removeAccountData(s,viewer);personalState(s).deletedReceipts[p.commitId]={userId:viewer}
        if(repo.personalFailure?.ownerId===viewer&&repo.personalFailure.method===method){repo.personalFailure=null;invariant(false,'STORAGE_FAILED')}
        return {state:s,result:{deleted:true}}
      }
      default:invariant(false,'METHOD_NOT_FOUND')
    }
    const used=referencedMedia(s);for(const id of garbage)if(!used.has(id)){const f=await req(media.get(id));if(f?.userId===viewer){await req(media.delete(id));removedFiles.push(id)}}
    if(repo.personalFailure?.ownerId===viewer&&repo.personalFailure.method===method){repo.personalFailure=null;invariant(false,'STORAGE_FAILED')}
    d.operations[op]={method,payload,resultId};return {state:s,result:{...snapshot(s),...(resultId?{resultId}:{})}}
  },signal)
  for(const id of removedFiles){if(repo.urls.has(id))URL.revokeObjectURL(repo.urls.get(id));repo.urls.delete(id)}
  if(method==='deleteAccount'){repo.playback?.audio.pause();repo.playback=null;repo.callLeases?.clear();repo.flows.clear();repo.contentDrafts?.clear();repo.socialDrafts?.clear();repo.profileMediaGrants?.clear();for(const url of repo.urls.values())URL.revokeObjectURL(url);repo.urls.clear()}
  return result
}

import { invariant } from './errors.js'
import { TEST_USER_ID, ageOn } from './validation.js'
import { contentState, canReadPost } from './content.js'
import { socialDemo } from '../data/social-demo.js'
import { demoRequestText } from '../data/demo-fixtures.js'
import { upgradeDemoSocial,demoPhotoAsset } from './demo-upgrade.js'
import { publicProAppearance } from './personal.js'

export const pairId = (a,b) => [a,b].sort().join('|')
export function compareSocialMessages(a,b){
 const time=value=>{const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:0}
 return time(a.createdAt)-time(b.createdAt)||String(a.id||'').localeCompare(String(b.id||''))
}
const stamp = '2026-10-17T08:00:00.000Z'
export function socialState(root) {
  if(root.social===undefined){
    const s={version:1,profiles:{},follows:{},requests:{},friendships:{},threads:{},messages:{},eventReads:{},preferences:{},operations:{},feedback:{},reports:{}}
    for(const p of socialDemo)s.profiles[p.id]={...p,demo:true}
    for(const [owner,fixture] of Object.entries(root.fixtures||{})){
      for(const peer of fixture.friends||[]){const pair=pairId(owner,peer);s.friendships[pair]={id:pair,users:[owner,peer],createdAt:stamp}}
      for(const thread of fixture.threads||[]){const peer=thread.participantId,pair=pairId(owner,peer);s.threads[thread.id]={id:thread.id,pair,users:[owner,peer],createdAt:stamp}
        for(const [index,m] of (thread.messages||[]).entries())s.messages[owner+':'+m.id]={id:owner+':'+m.id,threadId:thread.id,senderId:m.sentByMe?owner:peer,recipientId:m.sentByMe?peer:owner,kind:m.kind,body:typeof m.body==='object'?m.body.en:m.body||'',...(typeof m.body==='object'?{translations:m.body}:{}),...(m.asset?{asset:m.asset}:{}),createdAt:new Date(Date.parse(stamp)+index*60000).toISOString(),readAt:null,demo:true}
      }
      if(owner===TEST_USER_ID){
        s.requests['demo-request-in']={id:'demo-request-in',pair:pairId(owner,'demo-requester'),senderId:'demo-requester',recipientId:owner,body:demoRequestText['demo-request-in'],status:'pending',createdAt:stamp,demo:true}
        s.requests['demo-request-out']={id:'demo-request-out',pair:pairId(owner,'demo-recipient'),senderId:owner,recipientId:'demo-recipient',body:demoRequestText['demo-request-out'],status:'pending',createdAt:stamp,demo:true}
      }
    }
    root.social=s
  }
  const s=root.social
  invariant(s&&s.version===1&&['profiles','follows','requests','friendships','threads','messages','eventReads','preferences','operations','feedback','reports'].every(k=>s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])),'STORAGE_CORRUPT')
  upgradeDemoSocial(s,root)
  if(s.dismissedEvents===undefined)s.dismissedEvents={}
  invariant(s.dismissedEvents&&typeof s.dismissedEvents==='object'&&!Array.isArray(s.dismissedEvents),'STORAGE_CORRUPT')
  // Additive policy migration: preserve accepted contacts without keeping a
  // third, hidden message permission based on legacy friendship records.
  if(s.connections===undefined)s.connections={}
  invariant(s.connections&&typeof s.connections==='object'&&!Array.isArray(s.connections),'STORAGE_CORRUPT')
  if(!s.conversationRulesVersion){
    for(const f of Object.values(s.friendships))for(const [a,b] of [f.users,[...f.users].reverse()])s.follows[a+':'+b]||={senderId:a,recipientId:b,createdAt:f.createdAt}
    s.conversationRulesVersion=1
  }
  return s
}
export function isBlocked(root,a,b){const blocks=contentState(root).blocks;return !!(blocks[a+':'+b]||blocks[b+':'+a])}
export function profileFor(root,id,viewer){
  const a=root.accounts[id],p=a?.profile||socialState(root).profiles[id]
  invariant(p&&(!p.scope||p.scope===viewer),'PROFILE_UNAVAILABLE')
  return {id,displayName:p.displayName||'Eluva',about:p.about||'',...(p.aboutTranslations?{aboutTranslations:p.aboutTranslations}:{}),age:a?ageOn(p.birthday):p.age,photos:(p.photos||[]).map(x=>({id:x.id,...(!a&&p.demo&&demoPhotoAsset(id,x.id)?{asset:demoPhotoAsset(id,x.id)}:{})})),interestIds:p.interestIds||[],university:p.university||'',major:p.major||'',demo:!!p.demo||!!a?.isTest,...publicProAppearance(root,id)}
}
export function relationship(root,viewer,peer){
  const s=socialState(root),pair=pairId(viewer,peer),request=Object.values(s.requests).find(x=>x.pair===pair)
  const following=!!s.follows[viewer+':'+peer],followedBy=!!s.follows[peer+':'+viewer],mutual=following&&followedBy,connection=s.connections[pair]
  return {blocked:isBlocked(root,viewer,peer),blockedByMe:!!contentState(root).blocks[viewer+':'+peer],following,followedBy,friends:mutual,mutual,canMessage:mutual||connection?.status==='connected',connection:connection?{...connection,direction:connection.senderId===viewer?'sent':'received'}:null,request:request?{...request,direction:request.senderId===viewer?'sent':'received'}:null}
}
export function requirePeer(root,viewer,peer,{friend=false}={}){
  invariant(viewer!==peer,'SELF_ACTION');profileFor(root,peer,viewer);invariant(!isBlocked(root,viewer,peer),'USER_BLOCKED')
  if(friend)invariant(relationship(root,viewer,peer).canMessage,'FRIENDSHIP_REQUIRED')
}
export function requireThread(root,viewer,peer){
  requirePeer(root,viewer,peer)
  const r=relationship(root,viewer,peer)
  invariant(r.canMessage||r.connection,'FRIENDSHIP_REQUIRED')
}
export function activities(root,viewer){
  const c=contentState(root),s=socialState(root),rows=[]
  const messaged=new Set(Object.values(s.messages).filter(m=>[m.senderId,m.recipientId].includes(viewer)).map(m=>m.senderId===viewer?m.recipientId:m.senderId))
  for(const echo of Object.values(c.echoes)){if(echo.userId!==viewer)continue;const post=c.posts[echo.postId];if(post&&post.authorId!==viewer&&canReadPost(root,post,viewer))rows.push({id:'sent:'+echo.id,peerId:post.authorId,postId:post.id,direction:'sent',createdAt:echo.createdAt,body:post.body})}
  for(const e of Object.values(c.events)){const post=c.posts[e.postId];if(e.recipientId===viewer&&post&&canReadPost(root,post,viewer))rows.push({id:'received:'+e.id,peerId:e.senderId,postId:post.id,direction:'received',createdAt:e.createdAt,body:post.body})}
  return rows.filter(x=>!isBlocked(root,viewer,x.peerId)&&!s.dismissedEvents[viewer+':'+x.id]).map(x=>({...x,lightOnly:!messaged.has(x.peerId),read:!!s.eventReads[viewer+':'+x.id]})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
}
export function socialMediaReadable(root,file,viewer){
  if(!viewer||!root.social)return false
  return Object.values(socialState(root).messages).some(m=>m.mediaId===file.id&&[m.senderId,m.recipientId].includes(viewer)&&!isBlocked(root,m.senderId,m.recipientId))
}

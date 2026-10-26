import { invariant,AppError } from '../domain/errors.js'
import { realtimeState,viewerOf,readableMessage,languageSource,callReasons,wavDuration } from '../domain/realtime.js'
import { requirePeer } from '../domain/social.js'

const uuid=id=>invariant(typeof id==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id),'INVALID_ARGUMENT')
const get=q=>new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(new AppError('STORAGE_FAILED'))})
export async function browserRealtime(repo,method,p,signal){
 const root=await repo.read(),viewer=viewerOf(root),r=realtimeState(root);repo.callLeases||=new Set()
 if(method==='permissions')return {microphone:'unsupported',camera:'unsupported',speech:'unsupported',translation:false,environment:'browser'}
 if(method==='prepareCall'){const c=r.calls[p.callId];invariant(c?.ownerId===viewer,'CALL_UNAVAILABLE');requirePeer(root,viewer,c.peerId,{friend:true});invariant(c.state!=='ended'&&repo.callLeases.has(c.id),'CALL_ENDED');throw new AppError('DEVICE_UNSUPPORTED')}
 if(['requestPermission','recordStart','recordStatus','recordStop','transcribe','translate','startCamera','cameraControl'].includes(method))throw new AppError(['transcribe','translate'].includes(method)?'LANGUAGE_UNAVAILABLE':'DEVICE_UNSUPPORTED')
 if(method==='cancel'){
  if(p.recordingId)return {cancelled:true}
  const m=repo.playback&&root.social?.messages[repo.playback.messageId]
  if(!p.callId&&(!p.peerId||[m?.senderId,m?.recipientId].includes(p.peerId))){repo.playback?.audio.pause();repo.playback=null}
  const ids=[...repo.callLeases].filter(id=>{const c=r.calls[id];return c?.ownerId===viewer&&(!p.callId||p.callId===id)&&(!p.peerId||p.peerId===c.peerId)})
  ids.forEach(id=>repo.callLeases.delete(id));if(!ids.length)return {cancelled:true}
  return repo.write(s=>{const rt=realtimeState(s);invariant(viewerOf(s)===viewer,'AUTH_REQUIRED');for(const id of ids){const c=rt.calls[id];if(c&&c.ownerId===viewer&&c.state!=='ended'){c.state='ended';c.reason=callReasons.includes(p.reason)?p.reason:'left';c.endedAt=new Date().toISOString()}}return {state:s,result:{cancelled:true}}},signal)
 }
 if(method==='playVoice'){
  const m=readableMessage(root,p.messageId,viewer);invariant(m.kind==='voice','INVALID_ARGUMENT');invariant(typeof Audio==='function','DEVICE_UNSUPPORTED')
  const url=m.mediaId?(await repo.execute('media','resolve',{id:m.mediaId},{signal})).url:'./demo/local-voice.wav'
  invariant(!signal?.aborted,'CANCELLED');repo.playback?.audio.pause();const audio=new Audio(url),id=crypto.randomUUID();const player={id,audio,owner:viewer,messageId:m.id};repo.playback=player
  const abort=()=>{audio.pause();if(repo.playback===player)repo.playback=null};signal?.addEventListener('abort',abort,{once:true});
  try{await audio.play();invariant(!signal?.aborted&&repo.playback===player,'CANCELLED')}catch(e){audio.pause();if(repo.playback===player)repo.playback=null;throw e instanceof AppError?e:new AppError('PLAYBACK_FAILED')}finally{signal?.removeEventListener('abort',abort)}
  return {id,duration:Number.isFinite(audio.duration)?audio.duration:0,playing:true,time:0}
 }
 if(method==='playbackStatus'||method==='playbackControl'){
  const b=repo.playback;if(!b||b.id!==p.id)return {playing:false,ended:true,time:0,duration:0}
  invariant(b.owner===viewer,'AUTH_REQUIRED');readableMessage(root,b.messageId,viewer)
  if(method==='playbackControl'){invariant(['pause','resume','seek','stop'].includes(p.action),'INVALID_ARGUMENT');if(p.action==='stop'){b.audio.pause();repo.playback=null;return {playing:false,ended:true}}if(p.action==='pause')b.audio.pause();if(p.action==='resume')try{await b.audio.play()}catch{throw new AppError('PLAYBACK_FAILED')}if(p.action==='seek'){invariant(Number.isFinite(p.time)&&p.time>=0&&p.time<=b.audio.duration,'INVALID_ARGUMENT');b.audio.currentTime=p.time}}
  return {id:b.id,playing:!b.audio.paused,ended:b.audio.ended,time:b.audio.currentTime,duration:Number.isFinite(b.audio.duration)?b.audio.duration:0}
 }
 if(method==='languageSnapshot'){
  const source=languageSource(root,p.type,p.id,viewer,{transcript:p.voice===true,source:p.source||'en'})
  const transcript=p.voice&&Object.values(r.language).find(x=>x.ownerId===viewer&&x.type===p.type&&x.entityId===p.id&&x.kind==='transcript'&&x.source===(p.source||'en')&&x.fingerprint===source.fingerprint)
  return {rows:Object.values(r.language).filter(x=>x.ownerId===viewer&&x.type===p.type&&x.entityId===p.id&&(x.kind==='transcript'?x.source===(p.source||'en')&&x.fingerprint===source.fingerprint:x.fingerprint===(p.voice?transcript?.text:source.fingerprint)))}
 }
 if(method==='importVoice'){
  const draft=repo.socialDrafts?.get(p.draftId);invariant(draft?.ownerId===viewer,'DRAFT_EXPIRED');requirePeer(root,viewer,draft.peerId,{friend:true})
  invariant(typeof p.base64==='string'&&p.base64.length<=14000000,'MEDIA_TOO_LARGE');let data;try{data=Uint8Array.from(atob(p.base64),c=>c.charCodeAt(0))}catch{throw new AppError('MEDIA_UNSUPPORTED')}
  const duration=wavDuration(data),id=crypto.randomUUID(),blob=new Blob([data],{type:'audio/wav'})
  await repo.write(async(s,media)=>{invariant(viewerOf(s)===viewer,'AUTH_REQUIRED');requirePeer(s,viewer,draft.peerId,{friend:true});await get(media.put({id,userId:viewer,draftId:p.draftId,messagePeerId:draft.peerId,kind:'voice',duration,blob}));return {state:s,result:{}}},signal)
  const url=URL.createObjectURL(blob);repo.urls.set(id,url);return {id,url,kind:'voice',duration}
 }
 if(method==='call'){const c=r.calls[p.callId];invariant(c?.ownerId===viewer&&(!p.peerId||c.peerId===p.peerId),'CALL_UNAVAILABLE');if(c.state!=='ended'&&!repo.callLeases.has(c.id))return repo.write(s=>{invariant(viewerOf(s)===viewer,'AUTH_REQUIRED');const item=realtimeState(s).calls[c.id];item.state='ended';item.reason='interrupted';item.endedAt=new Date().toISOString();return {state:s,result:{call:item}}},signal);return {call:c}}
 return repo.write(s=>{
  invariant(viewerOf(s)===viewer,'AUTH_REQUIRED');const rt=realtimeState(s),now=new Date().toISOString();let result
  if(method==='createCall'){
   uuid(p.callId);requirePeer(s,viewer,p.peerId,{friend:true});invariant(p.direction==='outgoing','INVALID_ARGUMENT')
   const prior=rt.calls[p.callId];if(prior){invariant(prior.ownerId===viewer&&prior.peerId===p.peerId&&prior.direction===p.direction,'COMMIT_CONFLICT');return {state:s,result:{call:prior}}}
   for(const c of Object.values(rt.calls))if(c.ownerId===viewer&&c.state!=='ended'){if(repo.callLeases.has(c.id))throw new AppError('CALL_BUSY');c.state='ended';c.reason='interrupted';c.endedAt=now}
   const call={id:p.callId,ownerId:viewer,peerId:p.peerId,direction:p.direction,state:'ready',localOnly:true,createdAt:now};rt.calls[p.callId]=call;result={call}
  }else if(method==='endCall'){
   const c=rt.calls[p.callId];invariant(c?.ownerId===viewer,'CALL_UNAVAILABLE')
   invariant(callReasons.includes(p.reason),'INVALID_ARGUMENT');if(c.state!=='ended'){c.state='ended';c.reason=p.reason;c.endedAt=now}
   result={call:c}
  }else throw new AppError('METHOD_NOT_FOUND')
  return {state:s,result}
 },signal).then(result=>{if(method==='createCall'&&result.call.state!=='ended')repo.callLeases.add(result.call.id);if(method==='endCall')repo.callLeases.delete(result.call.id);return result})
}

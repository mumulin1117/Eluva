import { invariant } from './errors.js'
import { socialState,requirePeer,isBlocked } from './social.js'
import { contentState,canReadPost } from './content.js'

// Reversible local-preview bounds, not confirmed product limits. Native reads the same JSON.
export const realtimePolicy={voiceMinSeconds:1,voiceMaxSeconds:60,voiceMaxBytes:10*1024*1024,incomingInviteSeconds:30}
export const callReasons=['hangup','declined','cancelled','background','blocked','interrupted','failed','left','logout','timeout']
export function realtimeState(root){
 if(root.realtime===undefined)root.realtime={version:1,calls:{},language:{}}
 const r=root.realtime
 invariant(r&&r.version===1&&['calls','language'].every(k=>r[k]&&typeof r[k]==='object'&&!Array.isArray(r[k])),'STORAGE_CORRUPT')
 return r
}
export function viewerOf(root){const id=root.session?.userId;invariant(id&&root.accounts[id],'AUTH_REQUIRED');return id}
export function readableMessage(root,id,viewer){
 const m=socialState(root).messages[id];invariant(m&&[m.senderId,m.recipientId].includes(viewer),'MESSAGE_UNAVAILABLE')
 requirePeer(root,viewer,m.senderId===viewer?m.recipientId:m.senderId,{friend:true});return m
}
export function languageSource(root,type,id,viewer,{transcript=false,source='en'}={}){
 if(type==='message'){
  const m=readableMessage(root,id,viewer)
  if(transcript){invariant(m.kind==='voice','INVALID_ARGUMENT');return {message:m,original:'',fingerprint:m.mediaId||m.asset}}
  if(m.kind==='voice'){
   const row=realtimeState(root).language[languageKey(viewer,type,id,'transcript',source)]
   invariant(row&&row.fingerprint===(m.mediaId||m.asset),'TRANSCRIPT_REQUIRED');return {original:row.text,fingerprint:row.text}
  }
  invariant(!!m.body?.trim(),'NO_TEXT');return {original:m.body,fingerprint:m.body}
 }
 const c=contentState(root),item=(type==='post'?c.posts:type==='comment'?c.comments:{})[id]
 const post=type==='post'?item:c.posts[item?.postId]
 invariant(item&&post&&canReadPost(root,post,viewer)&&!isBlocked(root,viewer,item.authorId),'POST_UNAVAILABLE')
 invariant(!!item.body?.trim(),'NO_TEXT');return {original:item.body,fingerprint:item.body}
}
export const languageKey=(viewer,type,id,kind,lang)=>[viewer,type,id,kind,lang].join(':')
export function validateLanguageResult(row){invariant(['en','fr'].includes(row.source)&&['en','fr'].includes(row.target)&&['translation','transcript'].includes(row.kind)&&typeof row.text==='string'&&row.text.trim()&&row.text.length<=20000,'LANGUAGE_FAILED')}

// Validate real PCM WAV bytes in the browser preview; arbitrary base64 is never treated as voice.
export function wavDuration(bytes){
 invariant(bytes.byteLength<=realtimePolicy.voiceMaxBytes,'MEDIA_TOO_LARGE')
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),v=new DataView(b.buffer,b.byteOffset,b.byteLength)
 const tag=p=>String.fromCharCode(...b.slice(p,p+4))
 invariant(b.length>=44&&tag(0)==='RIFF'&&tag(8)==='WAVE'&&v.getUint32(4,true)+8<=b.length,'MEDIA_UNSUPPORTED')
 let offset=12,rate=0,dataBytes=0
 while(offset+8<=b.length){const size=v.getUint32(offset+4,true),end=offset+8+size;invariant(end<=b.length,'MEDIA_UNSUPPORTED')
  if(tag(offset)==='fmt '){invariant(size>=16&&v.getUint16(offset+8,true)===1,'MEDIA_UNSUPPORTED');const channels=v.getUint16(offset+10,true),sample=v.getUint32(offset+12,true),bits=v.getUint16(offset+22,true);rate=v.getUint32(offset+16,true);invariant(channels>=1&&channels<=2&&[8,16,24,32].includes(bits)&&sample>=8000&&sample<=192000&&rate===sample*channels*bits/8,'MEDIA_UNSUPPORTED')}
  if(tag(offset)==='data')dataBytes+=size
  offset=end+(size%2)
 }
 invariant(rate>0&&dataBytes>0,'MEDIA_UNSUPPORTED');const duration=dataBytes/rate
 invariant(duration>=realtimePolicy.voiceMinSeconds,'RECORDING_TOO_SHORT');invariant(duration<=realtimePolicy.voiceMaxSeconds,'RECORDING_TOO_LONG');return duration
}

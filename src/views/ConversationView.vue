<script setup>
import { computed,onMounted,onBeforeUnmount,ref,watch,nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { allowedReturnPath } from '../domain/navigation.js'
import { router } from '../router.js'
import { state,t,bridge,run } from '../state.js'
import { social,person,conversation,messageDraft,loadSocial,socialAction,ensureMessageDraft,applySocial } from '../social-state.js'
import { readBase64,validateMediaFile } from '../services/media-files.js'
import { newId } from '../domain/id.js'
import { AppError } from '../domain/errors.js'
import { normalizeMessageParts,messagePartText,messagePartCount,hasMessageParts } from '../domain/message-parts.js'
import { stickerIds } from '../data/social-demo.js'
import ContentShell from '../components/ContentShell.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import ConnectionAction from '../components/ConnectionAction.vue'
import SocialSafety from '../components/SocialSafety.vue'
import ActionButton from '../components/ActionButton.vue'
import AppIcon from '../components/AppIcon.vue'
import VoiceMessage from '../components/VoiceMessage.vue'
import VoiceRecorder from '../components/VoiceRecorder.vue'
import InlineMessageEditor from '../components/InlineMessageEditor.vue'
import MessageBody from '../components/MessageBody.vue'
const recordMode=ref(false),route=useRoute(),ready=ref(false),expressions=ref(false),input=ref(null),entry=ref(null),photoPermissionError=ref(''),composing=ref(false)
let alive=true,generation=0,pendingBrowserPhoto=null
const peer=computed(()=>String(route.params.peer)),p=computed(()=>person(peer.value)),d=computed(()=>messageDraft(peer.value)),thread=computed(()=>conversation(peer.value)),allowed=computed(()=>p.value?.relationship?.canMessage&&!p.value.relationship.blocked),connection=computed(()=>p.value?.relationship?.connection),canRespond=computed(()=>!p.value?.relationship?.blocked&&!allowed.value&&connection.value?.status==='pending'&&connection.value.direction==='received'),readable=computed(()=>!p.value?.relationship?.blocked&&(allowed.value||!!connection.value)),mediaMode=computed(()=>route.name==='chatPhoto'),photo=computed(()=>thread.value?.messages.find(m=>m.id===route.params.message&&m.kind==='image'))
const parts=computed({get:()=>d.value.parts,set:value=>{d.value.parts=value;d.value.body=messagePartText(value)}}),count=computed(()=>messagePartCount(parts.value)),canSend=computed(()=>!composing.value&&!state.ui.busy&&(!allowed.value||d.value.ready)&&hasMessageParts(parts.value)&&count.value<=2000)
function context(){return {owner:state.user?.id,peer:peer.value,draft:d.value,generation}}
function current(c){return alive&&c.owner===state.user?.id&&c.peer===peer.value&&c.generation===generation&&d.value===c.draft&&!mediaMode.value}
function requireCurrent(c,signal){if(signal?.aborted||!current(c)||!readable.value)throw new AppError('CANCELLED')}
async function revealLast(c){await nextTick();if(!c||current(c))document.querySelector('.message-line:last-of-type')?.scrollIntoView({block:'end'})}
async function load(){const epoch=++generation,target=peer.value,owner=state.user?.id;delete social.presentedThreads[target];ready.value=false;await loadSocial();if(!alive||epoch!==generation||target!==peer.value||owner!==state.user?.id)return;if(readable.value){if(await socialAction('thread',{peerId:target},{notice:''})){if(!alive||epoch!==generation||owner!==state.user?.id)return;social.presentedThreads[target]=true;if(thread.value?.unread)await socialAction('read',{peerId:target},{notice:''});if(allowed.value)await ensureMessageDraft(target)}}if(alive&&epoch===generation&&owner===state.user?.id)ready.value=true}
function restore(){const owner=state.user?.id;if(!owner||!social.loaded||social.ownerId!==owner||!social.presentedThreads?.[peer.value]||!p.value||!thread.value||!readable.value)return false;generation++;ready.value=true;return true}
restore()
async function enter(){if(!restore())return load();const epoch=generation,target=peer.value,owner=state.user?.id;if(thread.value.unread)await socialAction('read',{peerId:target},{notice:''});if(alive&&epoch===generation&&target===peer.value&&owner===state.user?.id&&allowed.value)await ensureMessageDraft(target)}
onMounted(enter)
function stop(target=peer.value){document.querySelectorAll('audio,video').forEach(x=>x.pause());bridge.call('realtime','cancel',{scope:'peer',peerId:target,reason:document.hidden?'background':'left'}).catch(()=>{})}
watch(peer,(value,previous)=>{stop(previous);expressions.value=false;recordMode.value=false;composing.value=false;pendingBrowserPhoto=null;photoPermissionError.value='';enter()})
watch(allowed,value=>{if(!value){generation++;stop();expressions.value=false;recordMode.value=false}})
watch(()=>state.ui.error,value=>{if(value!==photoPermissionError.value)photoPermissionError.value=''})
onBeforeUnmount(()=>{alive=false;generation++;pendingBrowserPhoto=null;stop()})
function back(){if(mediaMode.value)return router.replace({name:'conversation',params:{peer:peer.value},query:route.query});router.push(allowedReturnPath(route.query.from,{fallback:'/chats',exact:['/chats','/friends','/friend-requests'],prefix:['/profile/','/post/']}))}
const time=x=>new Intl.DateTimeFormat(state.locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(x))
function invalid(){state.ui.error='INVALID_MESSAGE'}
function toggleExpressions(){entry.value?.remember();document.activeElement?.blur?.();expressions.value=!expressions.value}
async function storePhoto(media,c,signal){requireCurrent(c,signal);if(!allowed.value)throw new AppError('CANCELLED');if(c.draft.media)await bridge.call('media','remove',{draftId:c.draft.draftId,id:c.draft.media.id},{signal});requireCurrent(c,signal);c.draft.media=media;c.draft.imageCommitId=newId()}
async function choosePhoto(){
 if(!allowed.value||state.ui.busy)return
 photoPermissionError.value='';expressions.value=false;document.activeElement?.blur?.()
 if(!d.value.ready&&!await ensureMessageDraft(peer.value))return
 if(!bridge.isNative){pendingBrowserPhoto=context();input.value?.click();return}
 const c=context();let selected=false;const picked=await run('chat-media',async signal=>{const r=await bridge.call('media','pick',{source:'library',draftId:c.draft.draftId,imagesOnly:true},{signal,timeout:120000});requireCurrent(c,signal);if(r.photos?.[0]){await storePhoto(r.photos[0],c,signal);selected=true}})
 if(!current(c))return
 if(!picked&&['PERMISSION_DENIED','PERMISSION_RESTRICTED'].includes(state.ui.error))photoPermissionError.value=state.ui.error
 if(picked&&selected&&c.draft.media)await sendPhoto(c)
}
async function files(event){const file=event.target.files[0],c=pendingBrowserPhoto;pendingBrowserPhoto=null;event.target.value='';if(!file||!c||!current(c)||!allowed.value)return;const imported=await run('chat-media',async signal=>{await validateMediaFile(file,signal,{imagesOnly:true});const media=await bridge.call('media','import',{draftId:c.draft.draftId,mime:file.type,base64:await readBase64(file,signal)},{signal,timeout:120000});await storePhoto(media,c,signal)});if(imported&&current(c))await sendPhoto(c)}
async function sendPhoto(c=context()){
 if(!current(c)||!allowed.value||!c.draft.media)return
 const media=c.draft.media;c.draft.imageCommitId||=newId()
 await run('chat-photo-send',async(signal,done)=>{requireCurrent(c,signal);const result=await bridge.call('social','send',{peerId:c.peer,kind:'image',body:'',mediaId:media.id,draftId:c.draft.draftId,commitId:c.draft.imageCommitId},{signal});await applySocial(result,signal);if(current(c)&&c.draft.media?.id===media.id){c.draft.media=null;c.draft.imageCommitId=newId();await revealLast(c)}done()},{critical:true})
}
async function remove(){const c=context(),media=c.draft.media;if(!media)return;await run('chat-remove',async signal=>{await bridge.call('media','remove',{draftId:c.draft.draftId,id:media.id},{signal});if(current(c)){c.draft.media=null;c.draft.imageCommitId=newId()}})}
async function send(){
 if(!canSend.value)return
 const c=context(),message=normalizeMessageParts(c.draft.parts),body=messagePartText(message).trim()
 const ok=await run('chat-send',async(signal,done)=>{requireCurrent(c,signal);const result=await bridge.call('social','send',{peerId:c.peer,kind:'text',body,parts:message,commitId:c.draft.commitId},{signal});await applySocial(result,signal);if(current(c)){c.draft.body='';c.draft.parts=[];c.draft.commitId=newId();expressions.value=false;await revealLast(c)}done()},{critical:true})
 if(ok&&current(c)&&allowed.value&&!c.draft.ready)await ensureMessageDraft(c.peer)
}
async function decline(){const draft=d.value;draft.declineCommitId||=newId();await socialAction('declineConnection',{peerId:peer.value,commitId:draft.declineCommitId},{notice:''})}
async function capability(name){const c=context();if(await run('chat-capability',signal=>bridge.call('social','requireFriend',{peerId:c.peer},{signal}))&&current(c)){if(name==='voice'){entry.value?.remember();document.activeElement?.blur?.();recordMode.value=!recordMode.value;expressions.value=false;photoPermissionError.value=''}else router.push({name:'videoCall',params:{peer:c.peer},query:{from:route.fullPath}})}}
async function receiveVoice(media,{send}){d.value.voice=media;d.value.voiceCommitId||=newId();if(send)await sendVoice()}
async function sendVoice(){const c=context(),draft=c.draft;if(!draft.voice)return;await run('voice-send',async(signal,done)=>{requireCurrent(c,signal);const result=await bridge.call('social','send',{peerId:c.peer,kind:'voice',body:'',mediaId:draft.voice.id,draftId:draft.draftId,commitId:draft.voiceCommitId},{signal});await applySocial(result,signal);if(current(c)){draft.voice=null;draft.voiceCommitId=newId();await revealLast(c)}done()},{critical:true})}
async function discardVoice(){const c=context();await run('voice-remove',async signal=>{await bridge.call('media','remove',{draftId:c.draft.draftId,id:c.draft.voice.id},{signal});if(current(c)){c.draft.voice=null;c.draft.voiceCommitId=newId()}})}
</script>
<template>
 <ContentShell back :show-error="false" class="conversation-shell" :title="mediaMode?t('s.photoViewer'):p?.displayName||t('s.chats')" :ready="ready" @back="back">
  <template #leading><button v-if="p&&!mediaMode" class="chat-avatar-link" :aria-label="t('s.openProfile')" @click="router.push({name:'profile',params:{id:peer},query:{from:route.fullPath}})"><PersonAvatar :person="p" :size="40"/></button></template>
  <template #header><SocialSafety v-if="p&&!mediaMode" :peer-id="peer"/></template>
  <div v-if="!ready" class="content-state"><p>{{ t('s.loading') }}</p></div>
  <div v-else-if="!readable" class="content-state"><h2>{{ t(p?.relationship?.blocked?'s.blocked':p?'s.friendHint':'s.profileUnavailable') }}</h2><ConnectionAction v-if="p&&!p.relationship.blocked" :peer-id="peer" :from="route.fullPath"/><ActionButton :disabled="!!state.ui.busy" @click="load">{{ t('retry') }}</ActionButton></div>
  <template v-else-if="mediaMode"><div class="chat-photo-view"><img v-if="photo?.url" :src="photo.url" :alt="t('s.image')"/><template v-else><p>{{ t('s.photoMissing') }}</p><ActionButton @click="load">{{ t('retry') }}</ActionButton></template></div></template>
  <template v-else>
   <p v-if="connection&&!allowed" class="connection-status" role="status">{{ t(canRespond?'s.replyToConnect':connection.status==='declined'?'s.connectionDeclined':'s.connectionWaiting') }}</p>
   <p v-if="!thread?.messages.length" class="social-empty">{{ t('s.emptyChat') }}</p>
   <article v-for="m in thread?.messages||[]" :key="m.id" class="message-line" :class="{mine:m.senderId===state.user?.id}">
    <PersonAvatar :person="person(m.senderId)" :size="40"/>
    <div class="message-column"><time>{{ time(m.createdAt) }}</time><div class="message-bubble">
     <button v-if="m.kind==='image'&&m.url" class="message-image" :aria-label="t('s.photoViewer')" @click="router.push({name:'chatPhoto',params:{peer,message:m.id},query:route.query})"><img :src="m.url" :alt="t('s.image')"/></button>
     <template v-else-if="m.kind==='image'"><p>{{ t('s.photoMissing') }}</p><button class="text-link" @click="load">{{ t('retry') }}</button></template>
     <img v-if="m.kind==='sticker'" class="message-sticker" :src="'./images/p3/'+m.stickerId+'.png'" :alt="t('s.emoji')"/>
     <template v-if="m.kind==='voice'"><VoiceMessage :message="m"/></template>
     <button v-if="m.connectionIntro&&m.postId" class="connection-post-link text-link" @click="router.push({name:'post',params:{id:m.postId},query:{from:route.fullPath}})">{{ t('s.connectionPost') }}</button>
     <MessageBody v-if="m.parts?.length" :message="m"/><p v-else-if="m.body">{{ m.demo?(m.translations?.[state.locale]||m.body):m.body }}</p>
    </div><small v-if="m.senderId===state.user?.id&&m.readAt">{{ t('s.read') }}</small></div>
   </article>
  </template>
  <template v-if="(allowed||canRespond)&&!mediaMode" #footer>
   <p v-if="state.ui.error&&!photoPermissionError" class="error-banner" role="alert" :data-error-code="state.ui.error">{{ t('errors.'+state.ui.error) }}</p>
   <div v-if="canRespond" class="connection-decision"><p>{{ t('s.replyToConnect') }}</p><ActionButton secondary :disabled="!!state.ui.busy" :busy="state.ui.busy==='social-declineConnection'" @click="decline">{{ t('s.decline') }}</ActionButton></div>
   <ActionButton v-if="allowed&&!d.ready" :disabled="!!state.ui.busy" @click="ensureMessageDraft(peer)">{{ t('retry') }}</ActionButton>
   <section v-if="allowed&&d.voice" class="voice-draft"><strong>{{ t('p4.voicePending') }}</strong><p>{{ t('p4.voiceReview') }}</p><span>{{ Math.round(d.voice.duration) }} s</span><div class="source-actions horizontal"><ActionButton :busy="state.ui.busy==='voice-send'" :disabled="!!state.ui.busy" @click="sendVoice">{{ t('p4.sendVoice') }}</ActionButton><button class="text-link" :disabled="!!state.ui.busy" @click="discardVoice">{{ t('p4.discardVoice') }}</button></div></section>
   <VoiceRecorder v-if="allowed&&recordMode" :key="peer" :peer-id="peer" :draft-id="d.draftId" :disabled="!!state.ui.busy||!d.ready||!!d.voice||!!d.media" @voice="receiveVoice" @close="recordMode=false"/>
   <section v-if="allowed&&d.media" class="photo-send-retry"><img :src="d.media.url" :alt="t('s.image')"/><div><p>{{ t('s.photoSendRetry') }}</p><div class="source-actions horizontal"><button type="button" class="text-link" data-action="retry-photo" :disabled="!!state.ui.busy" @click="sendPhoto()">{{ t('s.sendPhoto') }}</button><button type="button" class="text-link" data-action="discard-photo" :disabled="!!state.ui.busy" @click="remove">{{ t('s.removeImage') }}</button></div></div></section>
   <section v-if="photoPermissionError" class="chat-permission-recovery recovery-card" role="alert" :data-error-code="photoPermissionError"><p>{{ t('s.photoPermissionNeeded') }}</p><button type="button" class="text-link" :disabled="!!state.ui.busy" @click="choosePhoto">{{ t('retry') }}</button><button v-if="bridge.isNative" type="button" class="text-link" :disabled="!!state.ui.busy" @click="run('settings',signal=>bridge.call('system','openSettings',{}, {signal}))">{{ t('openSettings') }}</button></section>
   <form v-if="!recordMode" class="message-input-row" @submit.prevent="send"><InlineMessageEditor :key="peer" ref="entry" id="chat-input" v-model="parts" :placeholder="t('s.sayHi')" :disabled="!!state.ui.busy" @focus="expressions=false" @composition="composing=$event" @submit="send" @invalid="invalid"/><button :aria-label="t('s.send')" :disabled="!canSend"><img src="/images/p3/send.png" alt=""/></button></form>
   <p v-if="count>1800" class="field-hint">{{ count }} / 2000</p>
   <div v-if="allowed&&!expressions&&!recordMode" class="message-toolbar"><button :aria-label="t('s.emoji')" :aria-pressed="expressions" :disabled="!!state.ui.busy" @click="toggleExpressions"><AppIcon name="smile" :size="28"/></button><button :aria-label="t('s.record')" :disabled="!!state.ui.busy||!!d.voice||!!d.media" @click="capability('voice')"><AppIcon name="mic" :size="28"/></button><button :aria-label="t('s.addImage')" :disabled="!!state.ui.busy||!d.ready||!!d.voice" @click="choosePhoto"><AppIcon name="image" :size="28"/></button><button :aria-label="t('s.call')" :disabled="!!state.ui.busy" @click="capability('call')"><AppIcon name="video" :size="28"/></button></div>
   <div v-if="allowed&&expressions" class="expression-panel" :aria-label="t('s.emoji')"><button v-for="(id,i) in stickerIds" :key="id" type="button" :aria-label="t('s.expression',{n:i+1})" :disabled="!!state.ui.busy" @pointerdown.prevent @click="entry.insertSticker(id)"><img :src="'./images/p3/'+id+'.png'" alt=""/></button><button type="button" class="expression-delete" :aria-label="t('s.deleteLast')" @pointerdown.prevent @click="entry.eraseBackward()"><img src="/images/p3/expression-delete.png" alt=""/></button></div>
   <input ref="input" class="file-input" type="file" tabindex="-1" aria-hidden="true" accept="image/jpeg,image/png,image/webp" :aria-label="t('s.addImage')" @change="files" @cancel="pendingBrowserPhoto=null"/>
  </template>
 </ContentShell>
</template>

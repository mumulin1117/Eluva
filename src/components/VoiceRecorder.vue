<script setup>
import { computed,onMounted,onBeforeUnmount,reactive,ref,watch } from 'vue'
import { bridge,t } from '../state.js'
import { VoiceHold } from '../services/voice-hold.js'
import { readBase64 } from '../services/media-files.js'
import ActionButton from './ActionButton.vue'
const props=defineProps({peerId:String,draftId:String,disabled:Boolean})
const emit=defineEmits(['voice','close'])
const info=reactive({phase:'idle',duration:0,level:0,cancelArmed:false})
const permission=ref('loading'),error=ref(''),busy=ref(false),button=ref(null),file=ref(null)
const recording=computed(()=>['starting','recording'].includes(info.phase))
const permissionBlocked=computed(()=>['denied','restricted'].includes(permission.value)||['PERMISSION_DENIED','PERMISSION_RESTRICTED'].includes(error.value))
const clock=computed(()=>`${Math.floor(info.duration/60).toString().padStart(2,'0')}:${Math.floor(info.duration%60).toString().padStart(2,'0')}`)
const waveHeights=[5,9,14,20,12,24,16,10,22,18,24,15,19,11,8,5]
let controller=new AbortController(),permissionController=null,permissionGeneration=0,contextGeneration=0,pointer=null,startY=0,keyboardHeld=false,alive=true
const call=(...args)=>bridge.call(...args)
const hold=new VoiceHold({call,changed:value=>Object.assign(info,value),media:(media,options)=>emit('voice',media,options),error:e=>{if(alive)error.value=e.code||'RECORDING_FAILED'}})
function releaseCapture(){const id=pointer;pointer=null;if(id!==null&&button.value?.hasPointerCapture?.(id))button.value.releasePointerCapture(id)}
async function checkPermission(request=false){
 if(!alive||props.disabled)return
 const generation=++permissionGeneration;permissionController?.abort();const pending=new AbortController();permissionController=pending
 busy.value=true;error.value=''
 try{
  const p=await call('realtime','permissions',{}, {signal:pending.signal})
  if(!alive||generation!==permissionGeneration)return
  permission.value=p.microphone
  if(p.microphone==='authorized'||p.microphone==='unsupported')return
  if(p.microphone==='denied'||p.microphone==='restricted'){error.value=p.microphone==='restricted'?'PERMISSION_RESTRICTED':'PERMISSION_DENIED';return}
  if(request){
   const result=await call('realtime','requestPermission',{kind:'microphone',peerId:props.peerId,draftId:props.draftId},{signal:pending.signal,timeout:120000})
   if(!alive||generation!==permissionGeneration)return
   permission.value=result.status
   if(result.status!=='authorized')error.value=result.status==='restricted'?'PERMISSION_RESTRICTED':'PERMISSION_DENIED'
  }
 }catch(e){
  if(alive&&generation===permissionGeneration&&e.code!=='CANCELLED'){
   error.value=e.code||'RECORDING_FAILED'
   if(e.code==='PERMISSION_DENIED')permission.value='denied'
   else if(e.code==='PERMISSION_RESTRICTED')permission.value='restricted'
   else if(permission.value==='loading')permission.value='notDetermined'
  }
 }finally{if(alive&&generation===permissionGeneration){permissionController=null;busy.value=false}}
}
function allow(){if(!busy.value)checkPermission(true)}
function begin(e){
 if(props.disabled||busy.value||permission.value!=='authorized'||info.phase!=='idle'||e.button!==0||e.isPrimary===false)return
 e.preventDefault();document.activeElement?.blur?.();pointer=e.pointerId;startY=e.clientY
 try{button.value.setPointerCapture(pointer)}catch{pointer=null;return}
 error.value='';hold.start({peerId:props.peerId,draftId:props.draftId})
}
function move(e){if(pointer===e.pointerId){e.preventDefault();hold.arm(startY-e.clientY>72)}}
function release(e){if(pointer!==e.pointerId)return;e.preventDefault();releaseCapture();hold.release()}
function cancelPointer(e){if(e&&pointer!==e.pointerId)return;releaseCapture();keyboardHeld=false;hold.cancel('cancelled')}
function keyboard(e,up){
 if(![' ','Enter'].includes(e.key))return
 e.preventDefault()
 if(up){if(keyboardHeld){keyboardHeld=false;hold.release()}return}
 if(e.repeat||keyboardHeld||props.disabled||busy.value||permission.value!=='authorized'||info.phase!=='idle')return
 keyboardHeld=true;error.value='';hold.start({peerId:props.peerId,draftId:props.draftId})
}
function cancel(reason='cancelled'){releaseCapture();keyboardHeld=false;hold.cancel(reason)}
function suspend(){cancel('background');contextGeneration++;permissionGeneration++;permissionController?.abort();permissionController=null;busy.value=false}
function visibility(){if(document.hidden)suspend();else checkPermission(false)}
function pageHide(){suspend()}
async function openSettings(){try{await call('system','openSettings',{}, {signal:controller.signal})}catch(e){if(alive&&e.code!=='CANCELLED')error.value=e.code}}
async function importVoice(e){
 const chosen=e.target.files[0];e.target.value='';if(!chosen||busy.value||props.disabled)return
 error.value='';busy.value=true;const generation=contextGeneration,draftId=props.draftId
 try{
  const media=await call('realtime','importVoice',{draftId,base64:await readBase64(chosen,controller.signal)},{signal:controller.signal})
  if(alive&&generation===contextGeneration&&!document.hidden)emit('voice',media,{send:false})
  else if(media?.id)call('media','remove',{id:media.id,draftId}).catch(()=>{})
 }catch(e){if(alive&&generation===contextGeneration&&e.code!=='CANCELLED')error.value=e.code}finally{if(alive&&generation===contextGeneration)busy.value=false}
}
watch(()=>props.disabled,(value,previous)=>{if(value){cancel('cancelled');contextGeneration++;permissionGeneration++;permissionController?.abort();permissionController=null;busy.value=false}else if(previous)checkPermission(true)})
watch(()=>[props.peerId,props.draftId],()=>{cancel('left');contextGeneration++;permissionGeneration++;permissionController?.abort();permissionController=null;busy.value=false;checkPermission(true)})
onMounted(()=>{
 // Mounting follows an explicit tap on the chat microphone; permission never
 // starts a recording. The next hold is always a new user gesture.
 checkPermission(true);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pageHide)
})
onBeforeUnmount(()=>{alive=false;cancel('left');permissionGeneration++;permissionController?.abort();controller.abort();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pageHide)})
</script>
<template>
 <section class="voice-recorder" :data-recording-phase="info.phase">
  <div class="voice-mode-header"><span>{{ t('p4.voiceBounds') }}</span><button class="text-link" :disabled="busy||info.phase!=='idle'" @click="emit('close')">{{ t('p4.keyboard') }}</button></div>
  <p v-if="permission==='unsupported'" class="media-explanation">{{ t('p4.browserVoice') }}</p>
  <ActionButton v-else-if="permission!=='authorized'&&!permissionBlocked" secondary :busy="busy" :disabled="disabled||permission==='loading'" @click="allow">{{ t('p4.enableMic') }}</ActionButton>
  <p v-if="permission==='authorized'&&info.phase==='idle'" class="media-explanation">{{ t('p4.holdHint') }}</p>
  <button ref="button" type="button" class="hold-to-talk" :class="{'is-holding':recording}" :aria-label="t('p4.hold')" :disabled="disabled||busy||permission!=='authorized'||['stopping','retry'].includes(info.phase)" @pointerdown="begin" @pointermove="move" @pointerup="release" @pointercancel="cancelPointer" @lostpointercapture="cancelPointer" @keydown="keyboard($event,false)" @keyup="keyboard($event,true)" @blur="keyboardHeld&&cancel()"><img src="/images/p4/record-mic.png" alt=""/><span>{{ t(info.phase==='stopping'?'working':'p4.hold') }}</span></button>
  <div v-if="info.phase==='retry'" class="source-actions horizontal"><ActionButton :disabled="disabled" @click="error='';hold.finish()">{{ t('retry') }}</ActionButton><button class="text-link" @click="hold.cancel('cancelled')">{{ t('p4.discardVoice') }}</button></div>
  <button v-if="!bridge.isNative" class="text-link" :disabled="busy||disabled" @click="file.click()">{{ t('p4.importVoice') }}</button>
  <input ref="file" class="file-input" type="file" accept="audio/wav,.wav" tabindex="-1" aria-hidden="true" @change="importVoice"/>
  <p v-if="error" class="error-banner" role="alert" :data-error-code="error">{{ t(permissionBlocked?'p4.microphonePermissionNeeded':error==='MEDIA_UNSUPPORTED'?'p4.voiceFileInvalid':error==='MEDIA_TOO_LARGE'?'p4.voiceTooLarge':'errors.'+error) }}</p>
  <button v-if="bridge.isNative&&permissionBlocked" class="text-link" :disabled="busy" @click="openSettings">{{ t('openSettings') }}</button>
 </section>
 <Teleport to="body">
  <div v-if="recording" class="recording-overlay" :class="{'cancel-armed':info.cancelArmed}" :data-phase="info.phase">
   <div class="recording-readout">
    <div class="recording-bubble" :style="{backgroundImage:`url('/images/p4/${info.cancelArmed?'record-cancel-bubble':'record-bubble'}.png')`}" aria-hidden="true"><div class="recording-wave"><span v-for="(h,i) in waveHeights" :key="i" class="voice-wave" :style="{height:(h*(.4+info.level*.6))+'px'}"/></div></div>
    <time>{{ clock }}</time>
    <p class="recording-instruction" role="status">{{ t(info.phase==='starting'?'p4.starting':info.cancelArmed?'p4.releaseCancel':'p4.slideCancel') }}</p>
   </div>
   <button class="record-cancel-target" :aria-label="t('p4.discardVoice')" @click="cancel()"><img :src="'/images/p4/'+(info.cancelArmed?'record-cancel-active':'record-cancel-idle')+'.png'" alt=""/></button>
   <div class="record-bottom-art" aria-hidden="true"><img src="/images/p4/record-mic.png" alt=""/></div>
  </div>
 </Teleport>
</template>

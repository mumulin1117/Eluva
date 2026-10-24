<script setup>
import { computed,onMounted,onBeforeUnmount,ref,watch } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { bridge,state,t,notify } from '../state.js'
import { person,loadSocial } from '../social-state.js'
import { newId } from '../domain/id.js'
import ActionButton from '../components/ActionButton.vue'
import '../video-connecting.css'
const route=useRoute(),peer=computed(()=>String(route.params.peer)),p=computed(()=>person(peer.value))
const call=ref(null),busy=ref('loading'),error=ref(''),permission=ref(null)
const callID=ref(typeof route.query.callId==='string'?route.query.callId:newId())
const peerPhoto=computed(()=>p.value?.photos?.[0]?.url||'/images/default-avatar.svg')
const myPhoto=computed(()=>state.user?.profile?.photos?.[0]?.url||'/images/default-avatar.svg')
let alive=true,closing=false,generation=0,timer,appearanceID,work=new AbortController()
function backTarget(){const f=route.query.from;return typeof f==='string'&&(f.startsWith('/conversation/')||f==='/chats'||f==='/friends')?f:'/conversation/'+encodeURIComponent(peer.value)+'?from=/chats'}
function valid(token){return alive&&!closing&&token===generation&&!work.signal.aborted}
function photoFallback(event){if(!event.target.src.endsWith('/images/default-avatar.svg'))event.target.src='/images/default-avatar.svg'}
async function preparePermissions(token=generation){
 if(!call.value||!valid(token)||busy.value==='permissions')return
 busy.value='permissions';error.value=''
 try{
  const result=await bridge.call('realtime','prepareCall',{callId:callID.value},{signal:work.signal,timeout:120000})
  if(!valid(token))return
  permission.value=result
  const statuses=[result.camera,result.microphone]
  if(statuses.includes('restricted'))error.value='PERMISSION_RESTRICTED'
  else if(statuses.includes('denied'))error.value='PERMISSION_DENIED'
  else if(statuses.some(x=>x!=='authorized'))error.value='DEVICE_UNSUPPORTED'
 }catch(e){if(valid(token)&&e.code!=='CANCELLED')error.value=e.code}
 finally{if(valid(token))busy.value=''}
}
async function initialize(){
 if(closing||!alive)return
 const token=++generation;busy.value='loading';error.value='';await loadSocial({quiet:true})
 if(!valid(token))return
 try{
  const result=await bridge.call('realtime',route.query.callId?'call':'createCall',{callId:callID.value,peerId:peer.value,direction:route.query.direction==='incoming'?'incoming':'outgoing'},{signal:work.signal})
  if(!valid(token))return
  call.value=result.call
  if(call.value.state==='ended')return close('left')
  if(bridge.isNative){appearanceID=callID.value;await bridge.call('realtime','setVideoAppearance',{callId:appearanceID,active:true},{signal:work.signal})}
  if(!valid(token))return
  poll(token);await preparePermissions(token)
 }catch(e){if(valid(token)&&e.code!=='CANCELLED')error.value=e.code}
 finally{if(valid(token)&&busy.value==='loading')busy.value=''}
}
async function poll(token){
 if(!valid(token)||!call.value)return
 try{
  const result=await bridge.call('realtime','call',{callId:callID.value},{signal:work.signal})
  if(!valid(token))return
  call.value=result.call
  if(call.value.state==='ended')return close(call.value.reason||'left')
 }catch(e){if(valid(token)&&e.code!=='CANCELLED'){if(['USER_BLOCKED','FRIENDSHIP_REQUIRED','AUTH_REQUIRED','CALL_ENDED'].includes(e.code))return close(e.code==='USER_BLOCKED'?'blocked':'interrupted');error.value=e.code}}
 if(valid(token))timer=setTimeout(()=>poll(token),1000)
}
function showHint(){if(!closing)notify('p4.controlsAfterConnected',{tone:'info',handoffs:0})}
async function openSettings(){try{await bridge.call('system','openSettings')}catch(e){if(alive)error.value=e.code}}
function retry(){if(busy.value||closing)return;return call.value?preparePermissions():initialize()}
async function release(id,reason){
 const owner=state.user?.id
 let failed=false
 try{await bridge.call('realtime','cancel',{callId:id,reason})}catch(e){if(!['CALL_UNAVAILABLE','AUTH_REQUIRED'].includes(e.code))failed=true}
 try{await bridge.call('realtime','endCall',{callId:id,reason})}catch(e){if(!['CALL_UNAVAILABLE','AUTH_REQUIRED'].includes(e.code))failed=true}
 if(failed&&state.user?.id===owner)notify('p4.callClosedSaveFailed')
}
async function close(reason='hangup'){
 if(closing)return
 closing=true;generation++;work.abort();clearTimeout(timer);busy.value='ending'
 // Stop native work immediately; bookkeeping cannot hold the user on this screen.
 const released=release(callID.value,reason)
 await router.replace(backTarget());await released
}
function visibility(){if(document.hidden)close('background')}
onMounted(initialize)
watch(()=>p.value?.relationship?.blocked,blocked=>{if(blocked)close('blocked')})
watch(peer,()=>close('left'))
document.addEventListener('visibilitychange',visibility)
onBeforeUnmount(()=>{
 alive=false;generation++;work.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',visibility)
 if(appearanceID)bridge.call('realtime','setVideoAppearance',{callId:appearanceID,active:false}).catch(()=>{})
 if(!closing){closing=true;release(callID.value,'left')}
})
</script>
<template>
 <div class="video-connecting-shell" :aria-label="t('p4.callTitle')" :aria-busy="!!busy||undefined">
  <img class="video-peer-photo" :src="peerPhoto" alt="" draggable="false" @error="photoFallback"/>
  <div class="video-connecting-shade" aria-hidden="true"/>
  <header class="video-connecting-header">
   <h1>{{ p?.displayName||t('p4.callTitle') }}</h1>
   <p class="video-connecting-status" role="status">{{ t('p4.connecting') }}</p>
  </header>
  <main class="video-connecting-content">
   <section v-if="error" class="video-connecting-error" role="alert" :data-error-code="error">
    <p>{{ t(['PERMISSION_DENIED','PERMISSION_RESTRICTED'].includes(error)?'p4.callPermissionsNeeded':error==='DEVICE_UNSUPPORTED'?'p4.callUnsupported':'errors.'+error) }}</p>
    <div><ActionButton v-if="bridge.isNative&&['PERMISSION_DENIED','PERMISSION_RESTRICTED'].includes(error)" secondary @click="openSettings">{{ t('openSettings') }}</ActionButton><ActionButton :disabled="!!busy" @click="retry">{{ t('retry') }}</ActionButton></div>
   </section>
   <figure class="video-self-preview"><img :src="myPhoto" :alt="t('p4.yourPreview')" draggable="false" @error="photoFallback"/></figure>
  </main>
  <footer class="video-connecting-footer"><div class="video-connecting-controls">
   <button :aria-label="t('p4.micToggle')" @click="showHint"><img src="/images/p4/connecting-mic.svg" alt="" draggable="false"/></button>
   <button :aria-label="t('p4.flipCamera')" @click="showHint"><img src="/images/p4/connecting-flip.svg" alt="" draggable="false"/></button>
   <button :aria-label="t('p4.cameraToggle')" @click="showHint"><img src="/images/p4/connecting-camera.svg" alt="" draggable="false"/></button>
   <button class="video-connecting-hangup" :aria-label="t('p4.hangup')" :disabled="closing" @click="close('hangup')"><img src="/images/p4/connecting-hangup.svg" alt="" draggable="false"/></button>
  </div></footer>
 </div>
</template>

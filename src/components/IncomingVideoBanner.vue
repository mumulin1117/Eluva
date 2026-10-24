<script setup>
import { onMounted,onBeforeUnmount,ref } from 'vue'
import { bridge,state,t,notify } from '../state.js'
import { realtimePolicy } from '../domain/realtime.js'
import { person } from '../social-state.js'
import { router } from '../router.js'
import PersonAvatar from './PersonAvatar.vue'
import AppIcon from './AppIcon.vue'
const props=defineProps({call:Object}),emit=defineEmits(['dismiss'])
const busy=ref(false),error=ref(''),expired=ref(false)
const created=Date.parse(props.call.createdAt),deadline=Number.isFinite(created)?created+realtimePolicy.incomingInviteSeconds*1000:Date.now()
const lifetime=new AbortController();let accepted=false,alive=true,timer
function schedule(){clearTimeout(timer);if(alive&&!accepted)timer=setTimeout(()=>{expired.value=true;decline('timeout')},Math.max(0,deadline-Date.now()))}
onMounted(schedule)
async function decline(reason='declined'){if(busy.value)return;busy.value=true;error.value='';clearTimeout(timer);try{await bridge.call('realtime','endCall',{callId:props.call.id,reason},{signal:lifetime.signal});if(alive){if(reason==='timeout')notify('p4.incomingExpired');emit('dismiss')}}catch(e){if(alive&&e.code!=='CANCELLED')error.value=e.code}finally{if(alive)busy.value=false}}
async function accept(){if(busy.value)return;if(Date.now()>=deadline){expired.value=true;return decline('timeout')}busy.value=true;accepted=true;clearTimeout(timer);try{const failure=await router.push({name:'videoCall',params:{peer:props.call.peerId},query:{callId:props.call.id,from:'/chats'}});if(failure){accepted=false;error.value='CALL_UNAVAILABLE'}}catch{accepted=false;error.value='CALL_UNAVAILABLE'}finally{if(alive){busy.value=false;if(!accepted)schedule()}}}
function visibility(){if(document.hidden)decline('background')}
document.addEventListener('visibilitychange',visibility)
onBeforeUnmount(()=>{alive=false;clearTimeout(timer);lifetime.abort();document.removeEventListener('visibilitychange',visibility);if(!accepted)bridge.call('realtime','endCall',{callId:props.call.id,reason:expired.value?'timeout':'left'}).catch(()=>{})})
</script>
<template><aside class="incoming-video-banner" :data-call-id="call.id" :aria-label="t('p4.incomingTitle')"><div class="incoming-video-person"><PersonAvatar :person="person(call.peerId)" :size="34"/><div><strong>{{ person(call.peerId)?.displayName||'Eluva' }}</strong><p>{{ t('p4.incomingNote') }}</p></div><button class="incoming-close" :aria-label="t('close')" :disabled="busy" @click="decline(expired?'timeout':'declined')"><AppIcon name="close" :size="16"/></button></div><p v-if="expired" role="status">{{ t('p4.incomingExpired') }}</p><button v-if="expired&&error" class="text-link" :disabled="busy" @click="decline('timeout')">{{ t('retry') }}</button><div v-if="!expired" class="incoming-video-actions"><button class="incoming-decline" :aria-label="t('p4.declineDemo')" :disabled="busy" @click="decline(expired?'timeout':'declined')"><AppIcon name="close" :size="24"/><span>{{ t('p4.declineDemo') }}</span></button><button class="incoming-accept purple-gradient" :aria-label="t('p4.acceptDemo')" :disabled="busy" @click="accept"><AppIcon name="video" :size="24"/><span>{{ t('p4.acceptDemo') }}</span></button></div><p v-if="error" role="alert" :data-error-code="error">{{ t('errors.'+error) }}</p></aside></template>

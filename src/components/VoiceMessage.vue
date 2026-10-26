<script setup>
import { onBeforeUnmount,ref,watch } from 'vue'
import { bridge,t } from '../state.js'
import { newId } from '../domain/id.js'
const props=defineProps({message:Object})
const playing=ref(false),elapsed=ref(0),duration=ref(props.message.duration||0),busy=ref(false),error=ref('')
let id=null,generation=0,timer,signal=new AbortController(),alive=true
const time=value=>Math.floor((value||0)/60)+':'+String(Math.floor((value||0)%60)).padStart(2,'0')
function stop(){generation++;clearTimeout(timer);signal.abort();signal=new AbortController();busy.value=false;playing.value=false;if(id)bridge.call('realtime','playbackControl',{id,action:'stop'}).catch(()=>{});id=null}
async function poll(token){try{const r=await bridge.call('realtime','playbackStatus',{id},{signal:signal.signal});if(token!==generation)return;playing.value=r.playing;elapsed.value=r.time||0;duration.value=r.duration||duration.value;if(r.ended){id=null;return}if(r.playing)timer=setTimeout(()=>poll(token),250)}catch(e){if(e.code!=='CANCELLED'&&token===generation){error.value=e.code;stop()}}}
async function toggle(){if(busy.value||!alive||document.hidden)return;busy.value=true;error.value='';const token=++generation;clearTimeout(timer)
 try{const r=id?await bridge.call('realtime','playbackControl',{id,action:playing.value?'pause':'resume'},{signal:signal.signal}):await bridge.call('realtime','playVoice',{messageId:props.message.id,playbackId:newId()},{signal:signal.signal});if(!alive||token!==generation||document.hidden){if(r.id)bridge.call('realtime','playbackControl',{id:r.id,action:'stop'}).catch(()=>{});return}id=r.id||id;playing.value=r.playing;duration.value=r.duration||duration.value;elapsed.value=r.time||0;if(id)poll(token)}catch(e){if(alive&&token===generation){if(e.code!=='CANCELLED')error.value=e.code;playing.value=false}}finally{if(alive&&token===generation)busy.value=false}}
async function seek(e){if(!id||busy.value||!alive||document.hidden)return;const playback=id,position=Number(e.target.value),token=++generation;clearTimeout(timer);busy.value=true;try{await bridge.call('realtime','playbackControl',{id:playback,action:'seek',time:position},{signal:signal.signal});if(alive&&token===generation&&id===playback)elapsed.value=position}catch(e){if(alive&&token===generation&&e.code!=='CANCELLED')error.value=e.code}finally{if(alive&&token===generation){busy.value=false;if(id&&playing.value)timer=setTimeout(()=>poll(token),250)}}}
function visibility(){if(document.hidden)stop()}
document.addEventListener('visibilitychange',visibility)
window.addEventListener('pagehide',stop);window.addEventListener('eluva:cancel-interactions',stop)
watch(()=>props.message.id,stop)
onBeforeUnmount(()=>{alive=false;stop();signal.abort();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',stop);window.removeEventListener('eluva:cancel-interactions',stop)})
</script>
<template><div class="voice-message"><button :disabled="busy" :aria-busy="busy||undefined" :aria-label="t(playing?'pauseVoice':'playVoice')" @click="toggle"><span class="voice-play-symbol" aria-hidden="true">{{ playing?'Ⅱ':'▷' }}</span><span>{{ t(busy?'working':playing?'pauseVoice':error?'retry':'playVoice') }}</span></button><span class="voice-time">{{ time(elapsed) }} / {{ duration>0?time(Math.ceil(duration)):'—' }}</span><input v-if="duration>0" class="voice-seek" type="range" min="0" :max="duration" step=".1" :value="elapsed" :disabled="!id||busy" :aria-label="t('p4.playbackPosition')" @change="seek"/><p v-if="error" class="voice-play-error" role="alert" :data-error-code="error">{{ t(error==='MEDIA_MISSING'?'p4.voiceMissing':'errors.'+error) }}</p></div></template>

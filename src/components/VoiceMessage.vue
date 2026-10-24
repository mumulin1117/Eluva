<script setup>
import { onBeforeUnmount,ref } from 'vue'
import { bridge,t } from '../state.js'
import { newId } from '../domain/id.js'
const props=defineProps({message:Object})
const playing=ref(false),elapsed=ref(0),duration=ref(props.message.duration||0),busy=ref(false),error=ref('')
let id=null,generation=0,timer,signal=new AbortController()
const time=value=>Math.floor((value||0)/60)+':'+String(Math.floor((value||0)%60)).padStart(2,'0')
function stop(){generation++;clearTimeout(timer);playing.value=false;if(id)bridge.call('realtime','playbackControl',{id,action:'stop'}).catch(()=>{});id=null}
async function poll(token){try{const r=await bridge.call('realtime','playbackStatus',{id},{signal:signal.signal});if(token!==generation)return;playing.value=r.playing;elapsed.value=r.time||0;duration.value=r.duration||duration.value;if(r.ended){id=null;return}if(r.playing)timer=setTimeout(()=>poll(token),250)}catch(e){if(e.code!=='CANCELLED'&&token===generation){error.value=e.code;stop()}}}
async function toggle(){if(busy.value)return;busy.value=true;error.value='';const token=++generation;clearTimeout(timer)
 try{const r=id?await bridge.call('realtime','playbackControl',{id,action:playing.value?'pause':'resume'},{signal:signal.signal}):await bridge.call('realtime','playVoice',{messageId:props.message.id,playbackId:newId()},{signal:signal.signal});if(token!==generation)return;id=r.id||id;playing.value=r.playing;duration.value=r.duration||duration.value;elapsed.value=r.time||0;if(id)poll(token)}catch(e){if(e.code!=='CANCELLED')error.value=e.code;playing.value=false}finally{busy.value=false}}
async function seek(e){if(!id)return;try{await bridge.call('realtime','playbackControl',{id,action:'seek',time:Number(e.target.value)},{signal:signal.signal});elapsed.value=Number(e.target.value)}catch(e){error.value=e.code}}
function visibility(){if(document.hidden)stop()}
document.addEventListener('visibilitychange',visibility)
onBeforeUnmount(()=>{stop();signal.abort();document.removeEventListener('visibilitychange',visibility)})
</script>
<template><div class="voice-message"><button :disabled="busy" :aria-label="t(playing?'pauseVoice':'playVoice')" @click="toggle"><span class="voice-play-symbol" aria-hidden="true">{{ playing?'Ⅱ':'▷' }}</span><span>{{ t(busy?'working':playing?'pauseVoice':error?'retry':'playVoice') }}</span></button><span class="voice-time">{{ time(elapsed) }} / {{ duration>0?time(Math.ceil(duration)):'—' }}</span><input v-if="duration>0" class="voice-seek" type="range" min="0" :max="duration" step=".1" :value="elapsed" :disabled="!id||busy" :aria-label="t('p4.playbackPosition')" @change="seek"/><p v-if="error" class="voice-play-error" role="alert" :data-error-code="error">{{ t(error==='MEDIA_MISSING'?'p4.voiceMissing':'errors.'+error) }}</p></div></template>

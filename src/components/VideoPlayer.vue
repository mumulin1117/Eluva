<script setup>
import { ref,onBeforeUnmount,onMounted,watch } from 'vue'
import { t } from '../state.js'
import AppIcon from './AppIcon.vue'
const props=defineProps({src:String,expandable:Boolean})
defineEmits(['expand'])
const video=ref(null),playing=ref(false),time=ref(0),duration=ref(0),error=ref(false),busy=ref(false)
let alive=true,generation=0,requested=false
const stop=()=>{generation++;requested=false;busy.value=false;video.value?.pause();playing.value=false}
async function toggle(){
 if(!alive||document.hidden||busy.value)return
 if(playing.value){stop();return}
 const element=video.value;if(!element)return
 const token=++generation;requested=true;busy.value=true
 try{
  await element.play()
  if(!alive||token!==generation||document.hidden){if(!alive||document.hidden||!requested||element!==video.value)element.pause();return}
  error.value=false
 }catch{if(alive&&token===generation){requested=false;error.value=true;playing.value=false}}
 finally{if(alive&&token===generation)busy.value=false}
}
function played(){if(!alive||document.hidden||!requested){video.value?.pause();return}playing.value=true}
function failed(){stop();error.value=true}
function ended(){requested=false;playing.value=false}
function retry(){if(busy.value)return;stop();error.value=false;video.value?.load()}
function visibility(){if(document.hidden)stop()}
watch(()=>props.src,()=>{stop();time.value=0;duration.value=0;error.value=false})
onMounted(()=>{document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',stop);window.addEventListener('eluva:cancel-interactions',stop)})
onBeforeUnmount(()=>{alive=false;stop();video.value?.removeAttribute('src');video.value?.load();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',stop);window.removeEventListener('eluva:cancel-interactions',stop)})
</script>
<template><div class="video-player"><video ref="video" :src="src" playsinline preload="metadata" @play="played" @pause="playing=false" @ended="ended" @loadedmetadata="duration=$event.currentTarget?.duration||0" @timeupdate="time=$event.currentTarget?.currentTime||0" @error="failed" /><div class="video-toolbar"><button :disabled="busy" :aria-busy="busy||undefined" :aria-label="t(playing?'p2.pauseVideo':'p2.playVideo')" @click="toggle"><AppIcon :name="playing?'pause':'play'" /></button><input type="range" min="0" :max="Number.isFinite(duration)?duration:0" step="0.1" :value="time" :disabled="busy||!duration" :aria-label="t('p2.videoSeek')" @input="video.currentTime=Number($event.target.value)" /><span>{{ Math.floor(time) }} / {{ Math.floor(duration||0) }}s</span><button v-if="expandable" :aria-label="t('p2.mediaViewer')" @click="$emit('expand')"><AppIcon name="expand" :size="20"/></button></div><div v-if="error" class="error-banner" role="alert"><p>{{ t('p2.videoFailed') }}</p><button class="text-link" :disabled="busy" @click="retry">{{ t('retry') }}</button></div></div></template>

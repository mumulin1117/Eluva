<script setup>
import { ref,onBeforeUnmount,onMounted,watch } from 'vue'
import { t } from '../state.js'
import AppIcon from './AppIcon.vue'
const props=defineProps({src:String,expandable:Boolean})
defineEmits(['expand'])
const video=ref(null),playing=ref(false),time=ref(0),duration=ref(0),error=ref(false)
const stop=()=>{video.value?.pause();playing.value=false}
async function toggle(){if(playing.value)stop();else try{await video.value.play();error.value=false}catch{error.value=true}}
function retry(){error.value=false;video.value?.load()}
watch(()=>props.src,()=>{stop();time.value=0;error.value=false})
onMounted(()=>document.addEventListener('visibilitychange',stop))
onBeforeUnmount(()=>{stop();video.value?.removeAttribute('src');video.value?.load();document.removeEventListener('visibilitychange',stop)})
</script>
<template><div class="video-player"><video ref="video" :src="src" playsinline preload="metadata" @play="playing=true" @pause="playing=false" @ended="playing=false" @loadedmetadata="duration=$event.currentTarget?.duration||0" @timeupdate="time=$event.currentTarget?.currentTime||0" @error="error=true" /><div class="video-toolbar"><button :aria-label="t(playing?'p2.pauseVideo':'p2.playVideo')" @click="toggle"><AppIcon :name="playing?'pause':'play'" /></button><input type="range" min="0" :max="Number.isFinite(duration)?duration:0" step="0.1" :value="time" :aria-label="t('p2.videoSeek')" @input="video.currentTime=Number($event.target.value)" /><span>{{ Math.floor(time) }} / {{ Math.floor(duration||0) }}s</span><button v-if="expandable" :aria-label="t('p2.mediaViewer')" @click="$emit('expand')"><AppIcon name="expand" :size="20"/></button></div><div v-if="error" class="error-banner" role="alert"><p>{{ t('p2.videoFailed') }}</p><button class="text-link" @click="retry">{{ t('retry') }}</button></div></div></template>

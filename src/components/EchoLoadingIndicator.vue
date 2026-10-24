<script setup>
import { onBeforeUnmount,onMounted,ref } from 'vue'
import '../echo-loading.css'
const hidden=ref(document.hidden)
const media=window.matchMedia('(prefers-reduced-motion: reduce)'),reduced=ref(media.matches)
function visibility(){hidden.value=document.hidden}
function motion(){reduced.value=media.matches}
onMounted(()=>{document.addEventListener('visibilitychange',visibility);media.addEventListener('change',motion)})
onBeforeUnmount(()=>{document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',motion)})
</script>
<template>
 <svg class="echo-loading-indicator" :data-paused="hidden" :data-reduced-motion="reduced" viewBox="0 0 48 40" aria-hidden="true" focusable="false">
  <circle class="echo-loading-track" cx="24" cy="20" r="15"/>
  <g class="echo-loading-orbit">
   <circle class="echo-loading-arc" cx="24" cy="20" r="15" pathLength="100" stroke-dasharray="72 100"/>
   <circle class="echo-loading-inner" cx="24" cy="20" r="10" pathLength="100" stroke-dasharray="41 100" stroke-dashoffset="-52"/>
   <circle class="echo-loading-satellite" cx="24" cy="5" r="2.2"/>
  </g>
  <circle class="echo-loading-halo" cx="24" cy="20" r="6"/>
  <circle class="echo-loading-core" cx="24" cy="20" r="3"/>
 </svg>
</template>

<script setup>
import { computed } from 'vue'
const props=defineProps({frameId:String,active:Boolean})
const source=computed(()=>props.active&&/^frame-[1-6]$/.test(props.frameId||'')?'/images/p5/avatar-'+props.frameId+'.png':'')
</script>
<template><img v-if="source" class="avatar-frame-art" :src="source" :data-avatar-frame="frameId" alt="" draggable="false" aria-hidden="true"/></template>
<style scoped>
.avatar-frame-art{position:absolute;inset:-13%;width:126%;height:126%;max-width:none;object-fit:contain;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
</style>

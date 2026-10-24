<script setup>
import AppIcon from './AppIcon.vue'
defineProps({person:Object,size:{type:Number,default:60}})
</script>
<template><span class="person-avatar" :style="{width:size+'px',height:size+'px'}"><img v-if="person?.photos?.[0]?.url" :src="person.photos[0].url" alt="" draggable="false"/><AppIcon v-else name="user" :size="Math.round(size*.52)"/></span></template>

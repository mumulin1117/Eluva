<script setup>
import { computed } from 'vue'
import { t } from '../state.js'
import { displayMessageParts } from '../domain/message-parts.js'
const props=defineProps({message:{type:Object,required:true}})
const parts=computed(()=>displayMessageParts(props.message))
</script>
<template><p class="message-rich-body"><template v-for="(part,index) in parts" :key="index"><img v-if="part.type==='sticker'" class="message-inline-sticker" :src="'/images/p3/'+part.stickerId+'.png'" :alt="t('s.emoji')" draggable="false"/><template v-else>{{ part.text }}</template></template></p></template>

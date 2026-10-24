<script setup>
import { computed } from 'vue'
import { state,t } from '../state.js'
import AppIcon from './AppIcon.vue'
import PostImageCarousel from './PostImageCarousel.vue'
const props=defineProps({post:Object,compact:Boolean,carousel:Boolean,echoBusy:Boolean,interactionDisabled:Boolean,initialIndex:{type:Number,default:0}})
const images=computed(()=>props.post.media.filter(x=>x.kind==='image'))
const rotating=computed(()=>props.carousel&&images.value.length>1)
defineEmits(['open','echo','openMedia','retry','imageChange'])
function time(value){const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(state.locale,{hour:'2-digit',minute:'2-digit'}).format(date):'—'}
</script>
<template><article class="post-card" :class="{compact,'demo-card':post.demoScope}"><PostImageCarousel v-if="rotating" :media="images" :initial-index="initialIndex" @change="$emit('imageChange',$event)" @open="index=>$emit('openMedia',index)" @retry="$emit('retry')"/><button class="post-card-open" :disabled="interactionDisabled" @click="$emit('open')"><template v-if="!rotating"><div v-if="compact&&post.media.some(x=>x.kind==='image')" class="post-card-media-strip"><img v-for="m in post.media.slice(0,3)" :key="m.id" :src="m.url||'./images/default-avatar.svg'" alt="" draggable="false" /></div><img v-else-if="post.media[0]?.url && post.media[0].kind==='image'" class="post-card-image" :src="post.media[0].url" alt="" draggable="false" /><div v-else-if="post.media[0]?.kind==='video'" class="post-card-video"><AppIcon name="play" :size="32" /><span>{{ t('p2.video') }}</span></div></template><p class="post-card-body">{{ post.demoKey?t('p2.'+post.demoKey):post.body || t('p2.images') }}</p></button><div v-if="compact" class="post-stats"><span><AppIcon name="light" :size="18" /> {{ post.echoCount }}</span><span>{{ t('p2.'+(post.visibility.private?'private':post.visibility.audience)) }}</span><time :datetime="post.createdAt">{{ time(post.createdAt) }}</time><slot name="actions"/></div><button v-else class="echo-card-button" :disabled="!!state.ui.busy||echoBusy||interactionDisabled" :aria-busy="echoBusy||undefined" :aria-pressed="post.lit" @click="$emit('echo')"><img class="source-light-bulb" src="/images/p2/light-bulb.svg" alt=""/>{{ t('p2.'+(post.lit?'lit':'lightUp')) }}</button></article></template>

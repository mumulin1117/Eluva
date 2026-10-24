<script setup>
import { computed,onBeforeUnmount,onMounted,ref } from 'vue'
import { t } from '../state.js'
import '../loading-skeleton.css'

defineProps({
  variant: { type: String, default: 'chats', validator: value => ['chats', 'home', 'profile', 'detail'].includes(value) },
  label: String,
})
const root=ref(null),hidden=ref(document.hidden),covered=ref(false),visible=ref(true)
const paused=computed(()=>hidden.value||covered.value||!visible.value)
let intersection,modalObserver
function visibility(){hidden.value=document.hidden;covered.value=!!document.getElementById('app')?.hasAttribute('inert')}
onMounted(()=>{
 visibility();document.addEventListener('visibilitychange',visibility)
 if(typeof IntersectionObserver!=='undefined'){intersection=new IntersectionObserver(entries=>{visible.value=!!entries[0]?.isIntersecting});if(root.value)intersection.observe(root.value)}
 const app=document.getElementById('app');if(app){modalObserver=new MutationObserver(visibility);modalObserver.observe(app,{attributes:true,attributeFilter:['inert']})}
})
onBeforeUnmount(()=>{document.removeEventListener('visibilitychange',visibility);intersection?.disconnect();modalObserver?.disconnect()})
</script>

<template>
  <section ref="root" class="loading-skeleton" :class="'skeleton-' + variant" :data-variant="variant" :data-paused="paused" aria-busy="true">
    <span class="sr-only" role="status" aria-live="polite">{{ label || t('working') }}</span>
    <div v-if="variant === 'chats'" class="skeleton-chat-list" aria-hidden="true">
      <div v-for="row in 4" :key="row" class="chats-skeleton-row">
        <span class="skeleton-block skeleton-avatar" />
        <div class="skeleton-chat-copy"><span class="skeleton-block skeleton-line skeleton-name" /><span class="skeleton-block skeleton-line skeleton-message" /><span v-if="row === 2" class="skeleton-block skeleton-line skeleton-message-short" /></div>
        <span class="skeleton-block skeleton-time" />
      </div>
    </div>
    <div v-else-if="variant === 'home'" class="skeleton-home-layout" aria-hidden="true">
      <div class="skeleton-home-map"><span class="skeleton-block skeleton-share-island" /><div class="skeleton-home-resonance"><span class="skeleton-block skeleton-orb" /><span class="skeleton-block skeleton-count" /></div></div>
      <div class="skeleton-feed-panel"><div class="skeleton-feed-track"><div v-for="card in 2" :key="card" class="skeleton-feed-card"><span class="skeleton-block skeleton-feed-image" /><span class="skeleton-block skeleton-line" /><span class="skeleton-block skeleton-line skeleton-line-short" /><span class="skeleton-block skeleton-feed-action" /></div></div></div>
    </div>
    <div v-else-if="variant === 'profile'" class="skeleton-profile-layout" aria-hidden="true">
      <div class="skeleton-block skeleton-profile-photo" />
      <div class="skeleton-profile-card"><span class="skeleton-block skeleton-line skeleton-profile-name" /><span class="skeleton-block skeleton-line" /><span class="skeleton-block skeleton-line skeleton-line-short" /><div class="skeleton-profile-actions"><span class="skeleton-block skeleton-follow" /><span class="skeleton-block skeleton-profile-chat" /></div><div class="skeleton-profile-statistics"><div v-for="stat in 3" :key="stat"><span class="skeleton-block skeleton-stat-value" /><span class="skeleton-block skeleton-stat-label" /></div></div></div>
      <div class="skeleton-profile-collection"><span class="skeleton-block skeleton-collection-icon" /><span class="skeleton-block skeleton-line" /><span class="skeleton-block skeleton-collection-arrow" /></div>
      <div class="skeleton-profile-post"><span class="skeleton-block skeleton-profile-post-image" /><span class="skeleton-block skeleton-line" /><span class="skeleton-block skeleton-line skeleton-line-short" /></div>
    </div>
    <div v-else class="skeleton-detail-layout" aria-hidden="true">
      <span class="skeleton-block skeleton-detail-image" />
      <div class="skeleton-detail-copy"><span class="skeleton-block skeleton-line" /><span class="skeleton-block skeleton-line skeleton-line-short" /></div>
      <div class="skeleton-detail-actions"><span class="skeleton-block skeleton-detail-action" /><span class="skeleton-block skeleton-detail-count" /></div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { t } from '../state.js'
import { ImageCarousel } from '../services/image-carousel.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({ media: { type: Array, required: true }, detail:Boolean, delay:{type:Number,default:4000}, initialIndex:{type:Number,default:0} })
const emit = defineEmits(['open','change','retry'])
const root = ref(null), index = ref(0), paused = ref(false), reduced = ref(false), failed = ref(false), retryKey = ref(0)
const current = computed(() => props.media[index.value])
const carousel = new ImageCarousel({ delay:props.delay, changed: value => { index.value = value;emit('change',value) } })
let visibilityObserver, modalObserver, motion, gesture, suppressClick = false

watch(() => props.media.map(m => m.id).join('|'), () => { carousel.items(props.media.map(m => m.id));carousel.select(props.initialIndex) }, { immediate: true })
watch(() => current.value?.url, url => { failed.value = !url; carousel.hold('loading', !!url);carousel.hold('failed',!url) }, { immediate: true })
function loaded() { failed.value = false; carousel.hold('loading', false); carousel.hold('failed', false) }
function failure() { failed.value = true; carousel.hold('failed', true); carousel.hold('loading', false) }
function retry() { if(!current.value?.url){emit('retry');return}failed.value = false; carousel.hold('loading', true); retryKey.value++ }
function pageVisibility() { carousel.hold('background', document.hidden) }
function pageHide() { carousel.hold('pagehide', true) }
function pageShow() { carousel.hold('pagehide', false); pageVisibility() }
function motionChange() { reduced.value = motion.matches; carousel.hold('reduced-motion', reduced.value) }
function modalChange() { carousel.hold('modal', !!root.value?.closest('[inert]')) }
function toggle() { paused.value = !paused.value; carousel.hold('paused', paused.value) }
function select(value) { carousel.select(value) }
function focusIn(event) { carousel.hold('focus', event.target.matches(':focus-visible')) }
function focusOut(event) { if (!root.value?.contains(event.relatedTarget)) carousel.hold('focus', false) }
function pointerDown(event) {
  if (!event.isPrimary || event.button !== 0) return
  suppressClick = false
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY }
  carousel.hold('touch', true)
  event.currentTarget.setPointerCapture(event.pointerId)
}
function pointerMove(event) {
  if (gesture?.id !== event.pointerId) return
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y
  if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) event.preventDefault()
}
function pointerUp(event) {
  if (gesture?.id !== event.pointerId) return
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y
  if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy)) {
    suppressClick = true; select(index.value + (dx < 0 ? 1 : -1))
  }
  cancelPointer()
}
function cancelPointer() { gesture = null; carousel.hold('touch', false) }
function open() { if (!suppressClick) emit('open', index.value); suppressClick = false }
function keyboard(event) {
  suppressClick = false
  if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault(); carousel.hold('focus', true); select(index.value + (event.key === 'ArrowRight' ? 1 : -1))
  }
}
onMounted(() => {
  pageVisibility(); motion = window.matchMedia('(prefers-reduced-motion: reduce)'); motionChange(); modalChange()
  motion.addEventListener('change', motionChange)
  document.addEventListener('visibilitychange', pageVisibility)
  window.addEventListener('pagehide', pageHide); window.addEventListener('pageshow', pageShow)
  visibilityObserver = new IntersectionObserver(entries => carousel.hold('offscreen', !entries[0]?.isIntersecting || entries[0].intersectionRatio < .25), { threshold: [0, .25] })
  visibilityObserver.observe(root.value)
  modalObserver = new MutationObserver(modalChange)
  modalObserver.observe(document.getElementById('app'), { attributes: true, attributeFilter: ['inert'] })
})
onBeforeUnmount(() => {
  carousel.dispose(); gesture = null
  visibilityObserver?.disconnect(); modalObserver?.disconnect()
  motion?.removeEventListener('change', motionChange)
  document.removeEventListener('visibilitychange', pageVisibility)
  window.removeEventListener('pagehide', pageHide); window.removeEventListener('pageshow', pageShow)
})
</script>
<template>
  <div ref="root" class="post-image-carousel" :class="{'detail-carousel':detail}" :data-image-index="index" @focusin="focusIn" @focusout="focusOut" @keydown="keyboard">
    <button class="post-carousel-frame" :aria-label="t('p2.openPhoto',{n:index+1,total:media.length})" @click="open" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="cancelPointer" @lostpointercapture="cancelPointer">
      <img v-if="current?.url" :key="current.id+':'+retryKey" :src="current.url" :alt="t('photoNumber',{n:index+1})" draggable="false" @load="loaded" @error="failure" />
      <span v-if="failed" class="post-carousel-missing">{{ t('p2.mediaMissing') }}</span>
    </button>
    <div v-if="media.length>1" class="post-carousel-controls">
      <div class="post-carousel-dots" :aria-label="t('p2.images')">
        <button v-for="(image,i) in media" :key="image.id" :aria-label="t('photoNumber',{n:i+1})" :aria-pressed="index===i" @click="select(i)"><span/></button>
      </div>
      <span v-if="!detail" class="post-carousel-count" aria-live="off">{{ index+1 }} / {{ media.length }}</span>
      <button v-if="!reduced" class="post-carousel-toggle" :class="{'sr-only':detail}" :aria-label="t(paused?'p2.resumePhotos':'p2.pausePhotos')" :aria-pressed="paused" @click="toggle"><AppIcon :name="paused?'play':'pause'" :size="18"/></button>
    </div>
    <button v-if="failed" class="text-link" @click="retry">{{ t('p2.retryMedia') }}</button>
  </div>
</template>

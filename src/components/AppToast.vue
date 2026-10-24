<script setup>
import { computed, nextTick, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { state, t, dismissNotice, advanceNoticeRoute } from '../state.js'
import { noticeDuration, noticePresentation } from '../domain/notice.js'
import AppIcon from './AppIcon.vue'
import '../toast.css'

const route = useRoute()
const meta = computed(() => state.ui.noticeMeta || noticePresentation(state.ui.notice))
const text = computed(() => t(state.ui.notice, meta.value.values))
const icon = computed(() => ({success: 'check', attention: 'warning', info: 'info'})[meta.value.tone] || 'info')
let timer, started = 0, remaining = 0, previousFocus
function stop() { clearTimeout(timer); timer = null }
function resume() {
  if (!state.ui.notice || timer || document.hidden) return
  const id = meta.value.id
  started = Date.now(); timer = setTimeout(() => dismissNotice(id), remaining)
}
function pause() { if (timer) remaining = Math.max(0, remaining - (Date.now() - started)); stop() }
function focus(event) { if (!event.currentTarget.contains(event.relatedTarget)) previousFocus = event.relatedTarget; pause() }
async function close() {
  const restore = document.activeElement?.closest('.app-toast') ? previousFocus : null
  dismissNotice(meta.value.id)
  await nextTick()
  if (restore?.isConnected && !restore.closest('[inert]')) restore.focus({preventScroll: true})
}
watch(() => [state.ui.notice, state.ui.noticeMeta?.id, state.locale], () => {
  stop(); remaining = noticeDuration(text.value); resume()
}, {flush: 'post', immediate: true})
watch(() => route.fullPath, advanceNoticeRoute, {flush: 'sync'})
function visibility() { if (document.hidden) { stop(); dismissNotice() } }
document.addEventListener('visibilitychange', visibility)
onBeforeUnmount(() => { stop(); document.removeEventListener('visibilitychange', visibility) })
</script>

<template>
  <Teleport to="body">
    <div class="app-toast-layer" :class="'toast-position-' + (meta.position || 'top')">
      <Transition name="toast">
        <section v-if="state.ui.notice" :key="meta.id" class="app-toast" :class="'toast-' + meta.tone"
          :data-notice-key="state.ui.notice" @focusin="focus" @focusout="resume" @pointerenter="pause" @pointerleave="resume">
          <span class="toast-symbol" aria-hidden="true"><AppIcon :name="icon" :size="22" /></span>
          <p class="toast-copy" role="status" aria-live="polite" aria-atomic="true">{{ text }}</p>
          <button class="toast-close" :aria-label="t('toast.dismiss')" @pointerdown.prevent @click="close"><AppIcon name="close" :size="17" /></button>
        </section>
      </Transition>
    </div>
  </Teleport>
</template>

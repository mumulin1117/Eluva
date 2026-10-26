<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { state, t, canNavigate } from '../state.js'
import { scrollPositions as positions,scrollKey } from '../domain/navigation.js'
import AppIcon from './AppIcon.vue'
import { isInteractiveTarget } from '../services/touch-policy.js'
defineProps({ title: String, back: Boolean, sourceBack: Boolean, guide: Boolean, step: Number })
defineEmits(['back'])
const route = useRoute(), scroller = ref(null)
const restore = async () => { await nextTick(); if (scroller.value) scroller.value.scrollTop = positions.get(scrollKey(route.fullPath,state.user?.id)) || 0 }
onMounted(restore)
watch(() => route.fullPath, restore)
function dismissKeyboard(event) { if (!isInteractiveTarget(event.target)) document.activeElement?.blur?.() }
</script>
<template><div class="page-shell" :class="{ 'guide-shell': guide }" @click="dismissKeyboard">
  <header class="page-header" :class="{'source-back-header':sourceBack}">
    <button v-if="back" :class="sourceBack?'source-icon':'icon-button'" :aria-label="t('back')" :disabled="!canNavigate()" @click="$emit('back')"><img v-if="sourceBack" src="/images/p2/back-button.png" alt="" draggable="false"/><AppIcon v-else name="back" /></button>
    <div v-else class="guide-mark" aria-hidden="true">e</div>
    <div class="header-copy"><strong>{{ guide ? 'Eluva' : title || 'Eluva' }}</strong><span v-if="guide">{{ t('guide') }}</span></div>
  </header>
  <div v-if="step" class="step-row"><div class="step-track"><span :style="{ width: step / 9 * 100 + '%' }" /></div><span>{{ step }}/9</span></div>
  
  <main ref="scroller" class="page-content" :class="{ 'with-progress': step }" :aria-label="title">
    <div v-if="state.ui.error" class="error-banner" role="alert" :data-error-code="state.ui.error">{{ t('errors.' + state.ui.error) }}</div>
    <slot />
  </main>
  <footer v-if="$slots.footer" class="page-footer"><slot name="footer" /></footer>
</div></template>

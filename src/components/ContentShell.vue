<script setup>
import { ref,nextTick,onMounted,watch } from 'vue'
import { useRoute } from 'vue-router'
import { state,t,canNavigate } from '../state.js'
import { scrollPositions, scrollKey } from '../domain/navigation.js'
import { isInteractiveTarget } from '../services/touch-policy.js'
import AppIcon from './AppIcon.vue'
defineOptions({inheritAttrs:false})
const props=defineProps({title:String,back:Boolean,home:Boolean,showError:{type:Boolean,default:true},errorKey:String,ready:{type:Boolean,default:true}})
defineEmits(['back','help','filters'])
const route=useRoute(),scroller=ref(null)
async function restore(){await nextTick();if(props.ready&&scroller.value)scroller.value.scrollTop=scrollPositions.get(scrollKey(route.fullPath,state.user?.id))||0}
onMounted(restore);watch(()=>route.fullPath,restore)
watch(()=>props.ready,value=>{if(value)restore()})
function blur(event){if(!isInteractiveTarget(event.target))document.activeElement?.blur?.()}
</script>
<template><div v-bind="$attrs" class="page-shell content-shell" :class="{'home-shell':home}" @click="blur"><header class="content-header"><button v-if="back" class="source-icon" :aria-label="t('back')" :disabled="!canNavigate()" @click="$emit('back')"><img src="/images/p2/back-button.png" alt="" /></button><slot name="leading"/><strong v-if="home" class="home-wordmark">Eluva</strong><h1 v-else :class="{'sr-only':!title}">{{ title||t('p2.postDetails') }}</h1><div class="content-header-actions"><template v-if="home"><button class="source-icon" :aria-label="t('p2.help')" :disabled="!ready" @click="$emit('help',$event)"><AppIcon name="help" :size="22" /></button><button class="source-icon filter-button" :disabled="!ready||!canNavigate()" :aria-label="t('p2.feedFilters')" @click="$emit('filters')"><img src="/images/p2/filter-button.png" alt="" /></button></template><slot name="header" /></div></header><main ref="scroller" class="page-content" :aria-label="title||t(home?'p2.home':'p2.postDetails')"><div v-if="showError&&state.ui.error" class="error-banner" role="alert" :data-error-code="state.ui.error">{{ t(errorKey||'errors.'+state.ui.error) }}</div><slot /></main><footer v-if="$slots.footer" class="page-footer"><slot name="footer" /></footer><slot name="tabs" /><slot name="overlay"/></div></template>

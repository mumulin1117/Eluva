<script setup>
import { onBeforeUnmount,ref,watch } from 'vue'
import { useRoute } from 'vue-router'
import { state,t } from '../state.js'
import { LoadingToastPresentation } from '../services/loading-toast.js'
import EchoLoadingIndicator from './EchoLoadingIndicator.vue'
const route=useRoute(),feedback=ref(null),hidden=ref(document.hidden)
const presentation=new LoadingToastPresentation({changed:value=>{feedback.value=value}})
watch(()=>[state.ui.busy,state.user?.id,route.fullPath,state.booting,state.bootError,state.ui.error,state.ui.notice,hidden.value],()=>{
 presentation.update({operation:state.ui.busy,owner:state.user?.id||null,route:route.fullPath,blocked:state.booting||!!state.bootError||!!state.ui.error||!!state.ui.notice||hidden.value})
},{flush:'sync',immediate:true})
function visibility(){hidden.value=document.hidden}
document.addEventListener('visibilitychange',visibility)
onBeforeUnmount(()=>{document.removeEventListener('visibilitychange',visibility);presentation.dispose()})
</script>
<template>
 <Teleport to="body"><div v-if="feedback" class="app-loading-layer" :data-loading-operation="feedback.operation"><section class="app-loading-panel" role="status" aria-live="polite" aria-atomic="true"><EchoLoadingIndicator/><p class="app-loading-copy">{{ t(feedback.key) }}</p></section></div></Teleport>
</template>

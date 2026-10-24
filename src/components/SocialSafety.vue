<script setup>
import { ref,computed,watch } from 'vue'
import { router } from '../router.js'
import { state,t,clearError,canNavigate } from '../state.js'
import { person,socialAction } from '../social-state.js'
import { content } from '../content-state.js'
import { blockedReturnPath } from '../domain/navigation.js'
import '../profile.css'
import AppModal from './AppModal.vue'
import ActionButton from './ActionButton.vue'
const props=defineProps({peerId:String,postId:String})
const sheet=ref(''),p=computed(()=>person(props.peerId))
watch(()=>[props.peerId,props.postId],()=>sheet.value='')
function more(){if(state.ui.busy)return;clearError();state.ui.notice='';if(props.postId)document.querySelectorAll('.detail-hero audio,.detail-hero video').forEach(media=>media.pause());sheet.value='options'}
function report(){if(state.ui.busy||!canNavigate())return;sheet.value='';router.push({name:props.postId?'reportPost':'reportUser',params:{id:props.postId||props.peerId},query:{from:router.currentRoute.value.fullPath}})}
async function block(){
 if(state.ui.busy)return
 const peerId=props.peerId,blocked=true,source=router.currentRoute.value.query.from,origin=router.currentRoute.value.fullPath,owner=state.user?.id
 if(await socialAction('block',{peerId,blocked})){
  sheet.value=''
  if(blocked&&owner===state.user?.id&&router.currentRoute.value.fullPath===origin)await router.replace(blockedReturnPath(source,{blockedPeerIds:[peerId,...content.blockedAuthors.map(x=>x.id)],posts:content.posts}))
 }
}
</script>
<template>
 <button class="source-icon" :aria-label="t('p2.more')" :disabled="!!state.ui.busy" @click="more"><img src="/images/p3/more-button.png" alt=""/></button>
 <AppModal v-if="sheet==='options'" variant="safety" hide-header :closable="!state.ui.busy" :title="t('s.safety')" @close="sheet=''"><div class="safety-action-grid"><button v-if="!p?.relationship?.blocked" class="safety-action" :disabled="!!state.ui.busy" @click="report"><img src="/images/profile/report-action.png" alt=""/><span>{{ t('p2.report') }}</span></button><button class="safety-action" :disabled="!!state.ui.busy" :aria-busy="state.ui.busy==='social-block'" @click="block"><img src="/images/profile/block-action.png" alt=""/><span v-if="state.ui.busy==='social-block'" class="spinner" aria-hidden="true"/><span>{{ t('s.profileSafetyBlock') }}</span></button></div><p v-if="state.ui.error" class="error-banner" role="alert" :data-error-code="state.ui.error">{{ t('errors.'+state.ui.error) }}</p><template #footer><ActionButton secondary :disabled="!!state.ui.busy" @click="sheet=''">{{ t('cancel') }}</ActionButton></template></AppModal>
</template>

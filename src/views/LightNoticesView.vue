<script setup>
import { computed,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { state,t,clearError } from '../state.js'
import { router } from '../router.js'
import { social,person,loadSocial,socialAction } from '../social-state.js'
import { newId } from '../domain/id.js'
import ContentShell from '../components/ContentShell.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import AppModal from '../components/AppModal.vue'
import ActionButton from '../components/ActionButton.vue'
const help=ref(false),helpError=ref(false),cleared=ref([])
const rows=computed(()=>social.events.filter(x=>x.lightOnly))
let alive=true
onBeforeUnmount(()=>{alive=false})
watch(()=>social.loaded,ready=>{if(ready&&!social.preferences.lightHelpSeen)help.value=true})
onMounted(async()=>{const owner=state.user?.id;await loadSocial();if(alive&&state.user?.id===owner&&social.loaded&&!social.preferences.lightHelpSeen)help.value=true})
function showHelp(){if(state.ui.busy)return;clearError();helpError.value=false;help.value=true}
async function understood(){if(state.ui.busy)return;helpError.value=false;if(social.preferences.lightHelpSeen||await socialAction('lightHelpSeen',{seen:true},{notice:''}))help.value=false;else helpError.value=true}
async function clear(){if(state.ui.busy||!rows.value.length)return;const ids=rows.value.map(x=>x.id);if(await socialAction('clearLightEvents',{eventIds:ids,commitId:newId()},{notice:''}))cleared.value=ids}
async function undo(){if(state.ui.busy)return;if(await socialAction('restoreLightEvents',{eventIds:[...cleared.value],commitId:newId()},{notice:''}))cleared.value=[]}
function date(value){return new Intl.DateTimeFormat(state.locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value))}
function profile(id){router.push({name:'profile',params:{id},query:{from:'/chats/lights'}})}
</script>
<template>
 <ContentShell back class="light-notices-shell" :title="t('s.lights')" :ready="social.loaded" @back="router.push('/chats')">
  <template #header><div class="light-notices-tools"><button :disabled="!!state.ui.busy" :aria-label="t('s.lightHelpTitle')" @click="showHelp"><img src="/images/light-notices/help.png" alt=""/></button><button :disabled="!!state.ui.busy||!rows.length" :aria-label="t('s.clearLights')" :aria-busy="state.ui.busy==='social-clearLightEvents'" @click="clear"><span v-if="state.ui.busy==='social-clearLightEvents'" class="spinner"/><img v-else src="/images/light-notices/clear.png" alt=""/></button></div></template>
  <div v-if="!social.loaded" class="content-state"><p>{{ t(state.ui.busy?'s.loading':'s.loadMessagesFailed') }}</p><ActionButton v-if="!state.ui.busy" @click="loadSocial">{{ t('retry') }}</ActionButton></div>
  <template v-else><p v-if="cleared.length" class="light-notices-cleared" role="status">{{ t('s.lightsCleared') }} <button class="text-link" :disabled="!!state.ui.busy" @click="undo">{{ t('s.undoClear') }}</button></p><p v-if="!rows.length" class="social-empty">{{ t('s.noLights') }}</p>
   <article v-for="event in rows" :key="event.id" class="light-notice-card"><div class="light-notice-person"><PersonAvatar :person="person(event.peerId)" :size="44"/><div><strong>{{ person(event.peerId)?.displayName||'Eluva' }}</strong><time>{{ date(event.createdAt) }}</time></div><button class="light-notice-profile" :aria-label="t('s.profile')+' · '+(person(event.peerId)?.displayName||'Eluva')" @click="profile(event.peerId)"><img v-if="state.locale==='en'" src="/images/light-notices/profile-button.png" alt=""/><span v-else>{{ t('s.profile') }} ›</span></button></div><p>{{ t(event.direction==='sent'?'s.lightNoticeSent':'s.lightNoticeReceived',{name:person(event.peerId)?.displayName||'Eluva',body:event.body}) }}</p></article>
  </template>
 </ContentShell>
 <AppModal v-if="help" variant="light-help" hide-header :title="t('s.lightHelpTitle')" :closable="false" :dismiss-on-backdrop="false"><h2>{{ t('s.lightHelpTitle') }}</h2><p>{{ t('s.lightHelpBody') }}</p><p v-if="helpError" class="error-banner" role="alert">{{ t('errors.'+state.ui.error) }}</p><template #footer><ActionButton :busy="!!state.ui.busy" @click="understood">{{ t('s.gotIt') }}</ActionButton></template></AppModal>
</template>

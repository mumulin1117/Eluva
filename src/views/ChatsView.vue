<script setup>
import { compareSocialMessages } from '../domain/social.js'
import { showDiagnostics } from '../services/presentation.js'
import { computed,nextTick,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { router } from '../router.js'
import { state,t,bridge,run,clearError,notify } from '../state.js'
import { social,loadSocial,socialAction,person } from '../social-state.js'
import ContentShell from '../components/ContentShell.vue'
import AppTabBar from '../components/AppTabBar.vue'
import PullToRefresh from '../components/PullToRefresh.vue'
import ChatsPager from '../components/ChatsPager.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import { scrollPositions,scrollKey } from '../domain/navigation.js'
import { chatsScrollPath } from '../domain/chats-gestures.js'
import PersonAvatar from '../components/PersonAvatar.vue'
import AppModal from '../components/AppModal.vue'
import ActionButton from '../components/ActionButton.vue'
import AppIcon from '../components/AppIcon.vue'
import IncomingVideoBanner from '../components/IncomingVideoBanner.vue'
import { newId } from '../domain/id.js'
import { createLoadingPace,paintLoading,prepareLoadingImages } from '../services/loading-presentation.js'
const incoming=ref(null),viewRoot=ref(null),swiping=ref(false)
const category=computed(()=>social.preferences.filter==='following'?'following':'all')
const scroller=()=>viewRoot.value?.closest('.page-content')
function rememberScroll(value=category.value){const element=scroller();if(element)scrollPositions.set(scrollKey(chatsScrollPath(value),state.user?.id),element.scrollTop)}
async function restoreScroll(value=category.value,owner=state.user?.id){await nextTick();await nextTick();if(!alive||state.user?.id!==owner)return;const element=scroller();if(element)element.scrollTop=scrollPositions.get(scrollKey(chatsScrollPath(value),owner))||0}
const menu=ref(false),confirm=ref(false),tools=ref(false),eventIds=ref([])
const ownedSocial=computed(()=>social.loaded&&social.ownerId===state.user?.id)
const initialLoading=ref(!social.chatsVisited||!ownedSocial.value),refreshing=ref(false),loadError=ref(''),refreshDone=ref(false)
const entryReveal=ref(false)
const ready=computed(()=>ownedSocial.value&&!initialLoading.value)
let alive=true,reading=false,readController=null
function isCurrentRead(controller,owner){return alive&&readController===controller&&!controller.signal.aborted&&state.user?.id===owner}
function loadingImages(){
 const urls=threadsByCategory.value[category.value].slice(0,4).map(thread=>person(thread.peerId)?.photos?.[0]?.url)
 if(category.value==='all'){
  if(!social.preferences.unreadOnly||unreadLights.value)urls.push('/images/p3/echo-avatar.png')
  if(!social.preferences.unreadOnly)urls.push('/images/p3/help-avatar.png')
 }
 return urls.filter(Boolean)
}
async function readChats({pull=false}={}){
 if(reading||refreshing.value||pull&&(initialLoading.value||state.ui.busy))return false
 const owner=state.user?.id;if(!owner)return false
 const controller=new AbortController(),firstRead=initialLoading.value,pace=firstRead?createLoadingPace(controller.signal):null
 readController=controller;reading=true;refreshing.value=pull;loadError.value='';refreshDone.value=false
 try{
  // Share TabBar's in-flight read before a fast local store can finish it.
  // The skeleton still paints before this view is allowed to reveal data.
  const pending=firstRead?loadSocial():null
  if(firstRead)await paintLoading(controller.signal);else await nextTick()
  if(!isCurrentRead(controller,owner))return false
  const ok=await (pending||loadSocial())
  if(!isCurrentRead(controller,owner))return false
  if(ok&&social.preferences.filter==='lights')await socialAction('preferences',{...social.preferences,filter:'all'},{notice:''})
  if(!isCurrentRead(controller,owner))return false
  if(ok&&firstRead){await prepareLoadingImages(loadingImages(),{signal:controller.signal});if(!isCurrentRead(controller,owner))return false;await pace.finish()}
  if(!isCurrentRead(controller,owner))return false
  if(ok){social.chatsVisited=true;refreshDone.value=pull;if(firstRead)entryReveal.value=true}else loadError.value=social.loadError||state.ui.error||'STORAGE_FAILED'
  return ok
 }catch(error){
  if(isCurrentRead(controller,owner)&&error?.code!=='CANCELLED')loadError.value=error?.code||'STORAGE_FAILED'
  return false
 }finally{
  pace?.cancel()
  if(readController===controller){readController=null;reading=false;if(alive&&state.user?.id===owner){initialLoading.value=false;refreshing.value=false;if(!pull)await restoreScroll(category.value,owner)}}
 }
}
function retryRead(){if(state.ui.busy||reading||refreshing.value)return false;initialLoading.value=!ownedSocial.value;return readChats({pull:ownedSocial.value})}
onMounted(()=>readChats())
watch(()=>state.user?.id,owner=>{
 readController?.abort();readController=null;reading=false;refreshing.value=false;refreshDone.value=false;loadError.value='';entryReveal.value=false
 initialLoading.value=!social.chatsVisited||!ownedSocial.value
 if(owner&&alive)readChats()
})
onBeforeUnmount(()=>{rememberScroll();alive=false;readController?.abort()})
const threadsByCategory=computed(()=>{const all=social.threads.filter(x=>!x.blocked&&(!social.preferences.unreadOnly||x.unread>0)).sort((a,b)=>compareSocialMessages({...b,createdAt:b.messages.at(-1)?.createdAt||b.createdAt},{...a,createdAt:a.messages.at(-1)?.createdAt||a.createdAt}));return {all,following:all.filter(x=>person(x.peerId)?.relationship?.following)}})
const notices=computed(()=>social.events.filter(x=>x.lightOnly&&(!social.preferences.unreadOnly||!x.read))),unreadLights=computed(()=>social.events.filter(x=>x.lightOnly&&!x.read).length)
function preview(thread){const c=person(thread.peerId)?.relationship?.connection;if(!person(thread.peerId)?.relationship?.canMessage&&c)return t(c.status==='declined'?'s.connectionRejected':c.direction==='received'?'s.connectionIncoming':'s.connectionPending');const m=thread.messages.at(-1);return !m?t('s.emptyChat'):m.kind==='image'?t('s.image'):m.kind==='voice'?t(m.demo?'s.voice':'s.voiceMessage'):m.kind==='sticker'?t('s.emoji'):m.parts?.length?m.parts.map(x=>x.type==='sticker'?'['+t('s.emoji')+']':x.text).join(''):m.demo?(m.translations?.[state.locale]||m.body):m.body}
const time=x=>new Intl.DateTimeFormat(state.locale,{hour:'2-digit',minute:'2-digit'}).format(new Date(x))
async function selectCategory(value){if(value===category.value)return true;if(state.ui.busy||!ready.value||refreshing.value)return false;const owner=state.user?.id;rememberScroll();refreshDone.value=false;const ok=await socialAction('preferences',{...social.preferences,filter:value},{notice:''});if(alive&&state.user?.id===owner&&ok)await restoreScroll(value);return ok}
async function filter(value){if(state.ui.busy||refreshing.value)return false;refreshDone.value=false;const ok=await socialAction('preferences',{...social.preferences,...value},{notice:''});if(ok){menu.value=false;scroller()?.scrollTo({top:0})}return ok}
function categoryKey(event){const next=event.key==='ArrowRight'||event.key==='End'?'following':event.key==='ArrowLeft'||event.key==='Home'?'all':null;if(next){event.preventDefault();selectCategory(next).then(ok=>{if(ok)viewRoot.value?.querySelector('#chats-tab-'+next)?.focus()})}}
function mark(){if(state.ui.busy||refreshing.value||initialLoading.value)return;clearError();eventIds.value=notices.value.filter(x=>!x.read).map(x=>x.id);menu.value=false;confirm.value=true}
async function markRead(){if(state.ui.busy||refreshing.value||initialLoading.value)return;if(await socialAction('readEvents',{eventIds:[...eventIds.value]})){confirm.value=false;eventIds.value=[]}}
async function incomingDemo(){tools.value=false;await run('incoming-demo',async signal=>{const result=await bridge.call('realtime','createCall',{callId:newId(),peerId:'demo-friend-echo',direction:'incoming'},{signal});incoming.value=result.call})}
async function arm(operation){if(await run('social-demo',signal=>bridge.call('social','simulateFailure',{operation},{signal}))){tools.value=false;notify('s.failureArmed')}}
</script>
<template><IncomingVideoBanner v-if="incoming" :call="incoming" @dismiss="incoming=null"/><ContentShell class="chats-shell" :title="t('s.chats')" :ready="ready" :show-error="!loadError"><template #header><button class="source-icon" :aria-label="t('s.friends')" :disabled="!!state.ui.busy" @click="router.push('/friends')"><img src="/images/p3/friends-button.png" alt=""/></button><button id="chats-more" class="source-icon" :disabled="!!state.ui.busy||refreshing||initialLoading" :aria-label="t('p2.more')" @click="menu=true"><img src="/images/p3/more-button.png" alt=""/></button></template>
 <div ref="viewRoot" class="chats-interactions">
 <PullToRefresh :refreshing="refreshing" :completed="refreshDone" :disabled="!!state.ui.busy||initialLoading||!ownedSocial||swiping" @refresh="readChats({pull:true})" @pull="refreshDone=false">
  <nav class="social-filters chats-category-tabs" role="tablist" :aria-label="t('s.chats')" :aria-busy="state.ui.busy==='social-preferences'" :style="{'--chats-tab-index':category==='following'?1:0}" @keydown="categoryKey">
   <span class="chats-filter-indicator" aria-hidden="true"/>
   <button v-for="key in ['all','following']" :id="'chats-tab-'+key" :key="key" role="tab" :data-category="key" :aria-controls="'chats-panel-'+key" :aria-selected="category===key" :aria-pressed="category===key" :tabindex="category===key?0:-1" :disabled="!!state.ui.busy||!ready||refreshing" @click="selectCategory(key)">{{ t(key==='following'?'s.followFilter':'s.'+key) }}</button>
  </nav>
  <p v-if="social.preferences.unreadOnly" class="filter-tag">{{ t('s.unread') }}</p>
  <p v-if="loadError&&ownedSocial" class="chats-refresh-error" role="alert" :data-error-code="loadError">{{ t('s.refreshMessagesFailed') }} <button class="text-link" :disabled="!!state.ui.busy" @click="retryRead">{{ t('retry') }}</button></p>
  <div v-if="initialLoading" class="chats-initial-loading"><LoadingSkeleton variant="chats" :label="t('s.loading')"/></div>
  <div v-else-if="!ownedSocial" class="content-state chats-load-failure"><p>{{ t('s.loadMessagesFailed') }}</p><p v-if="loadError" class="sr-only" :data-error-code="loadError">{{ t('errors.'+loadError) }}</p><ActionButton :disabled="!!state.ui.busy" @click="retryRead">{{ t('retry') }}</ActionButton></div>
  <template v-else>
   <ChatsPager :class="{'loading-content-reveal':entryReveal}" :model-value="category" :disabled="!!state.ui.busy||refreshing||menu||confirm||tools" :select="selectCategory" @gesture="swiping=$event">
    <template #default="{category:panelCategory,active}">
     <button v-if="panelCategory==='all'&&(!social.preferences.unreadOnly||unreadLights)" class="social-row" :tabindex="active?undefined:-1" @click="router.push('/chats/lights')"><img class="row-art" src="/images/p3/echo-avatar.png" alt=""/><span class="row-main"><strong>{{ t('s.lights') }}</strong><small>{{ t(notices.length?'s.litSent':'s.noLights') }} · {{ notices.length }}</small></span><span v-if="unreadLights" class="unread-badge">{{ unreadLights }}</span></button>
     <button v-if="panelCategory==='all'&&!social.preferences.unreadOnly" class="social-row" :tabindex="active?undefined:-1" @click="router.push('/help')"><img class="row-art" src="/images/p3/help-avatar.png" alt=""/><span class="row-main"><strong>{{ t('s.help') }}</strong><small>{{ t('s.helpPreview') }}</small></span></button>
     <button v-for="thread in threadsByCategory[panelCategory]" :key="thread.id" class="social-row" :tabindex="active?undefined:-1" @click="router.push({name:'conversation',params:{peer:thread.peerId},query:{from:'/chats'}})"><PersonAvatar :person="person(thread.peerId)"/><span class="row-main"><strong>{{ person(thread.peerId)?.displayName||'Eluva' }}</strong><small>{{ preview(thread) }}</small></span><span class="row-meta"><time>{{ time(thread.messages.at(-1)?.createdAt||thread.createdAt) }}</time><span v-if="thread.unread" class="unread-badge">{{ thread.unread }}</span></span></button>
     <div v-if="!threadsByCategory[panelCategory].length" class="social-empty chats-empty" role="status"><p>{{ t(social.preferences.unreadOnly?'s.noUnread':panelCategory==='following'?'s.noFollowing':'s.noMessages') }}</p><p v-if="!social.preferences.unreadOnly&&panelCategory==='all'" class="chats-empty-hint">{{ t('s.noMessagesHint') }}</p></div>
    </template>
   </ChatsPager>
   <div v-if="showDiagnostics&&state.user?.isTest" class="social-local-note"><button class="text-link" @click="tools=true">{{ t('s.demoTools') }}</button></div>
  </template>
 </PullToRefresh></div><template #tabs><AppTabBar/></template></ContentShell><AppModal v-if="menu" :title="t('p2.more')" anchor="#chats-more" @close="menu=false"><div class="source-actions"><button class="menu-item" @click="filter({unreadOnly:!social.preferences.unreadOnly})"><AppIcon name="mail"/>{{ t(social.preferences.unreadOnly?'s.allMessages':'s.unread') }}</button><button class="menu-item" :disabled="!unreadLights" @click="mark"><AppIcon name="light"/>{{ t('s.markLights') }}</button></div></AppModal><AppModal v-if="confirm" centered variant="mark-read" :title="t('s.markTitle')" :closable="!state.ui.busy" @close="confirm=false"><p>{{ t('s.markHint') }}</p><p v-if="state.ui.error" class="error-banner" role="alert" :data-error-code="state.ui.error">{{ t('errors.'+state.ui.error) }}</p><template #footer><ActionButton secondary :disabled="!!state.ui.busy" @click="confirm=false">{{ t('cancel') }}</ActionButton><ActionButton :busy="state.ui.busy==='social-readEvents'" :disabled="!!state.ui.busy" @click="markRead">{{ t('s.markRead') }}</ActionButton></template></AppModal><AppModal v-if="showDiagnostics&&tools" :title="t('s.demoTools')" @close="tools=false"><p>{{ t('p2.demoChecksHint') }}</p><div class="source-actions"><ActionButton v-for="[operation,key] in [['send','failSend'],['request','failRequest'],['accept','failAccept'],['ignore','failIgnore'],['snapshot','failRefresh']]" :key="operation" secondary @click="arm(operation)">{{ t('s.'+key) }}</ActionButton><ActionButton secondary @click="incomingDemo">{{ t('p4.incomingDemoTool') }}</ActionButton><p>{{ t('s.choosePerson') }}</p><button v-for="p in social.profiles.filter(p=>p.demo&&p.id!==state.user?.id)" :key="p.id" class="option-row" @click="tools=false;router.push({name:'profile',params:{id:p.id},query:{from:'/chats'}})">{{ p.displayName }}</button></div></AppModal></template>

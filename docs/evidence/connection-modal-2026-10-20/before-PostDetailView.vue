<script setup>
import { computed,onMounted,ref,watch } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t,bridge,run,canNavigate } from '../state.js'
import { content,applyContent,mutateContent } from '../content-state.js'
import { characterCount } from '../domain/content.js'
import { newId } from '../domain/id.js'
import { person,introDraft,applySocial,socialAction } from '../social-state.js'
import ContentShell from '../components/ContentShell.vue'
import AppModal from '../components/AppModal.vue'
import ActionButton from '../components/ActionButton.vue'
import AppIcon from '../components/AppIcon.vue'
import VideoPlayer from '../components/VideoPlayer.vue'
import DeletePostDialog from '../components/DeletePostDialog.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import PostImageCarousel from '../components/PostImageCarousel.vue'
import '../post-detail.css'
const route=useRoute(),ready=ref(false),authorReady=ref(false),sheet=ref(''),reason=ref('harassment'),details=ref(''),reportCommit=ref(newId()),navigating=ref(false)
const post=computed(()=>content.posts.find(x=>x.id===route.params.id)),isMine=computed(()=>post.value?.authorId===state.user?.id),revealed=computed(()=>post.value?.lit||isMine.value)
const author=computed(()=>person(post.value?.authorId)),relation=computed(()=>author.value?.relationship),draft=computed(()=>introDraft(post.value?.authorId)),connection=computed(()=>relation.value?.connection)
content.detailMediaIndices||={}
const cacheKey=computed(()=>state.user?.id+':'+route.params.id),mediaIndex=computed({get:()=>content.detailMediaIndices[cacheKey.value]||0,set:value=>{content.detailMediaIndices[cacheKey.value]=value}})
const mediaMode=computed(()=>route.name==='postMedia'),viewerIndex=computed(()=>{const n=Number(route.params.index);return Number.isInteger(n)&&n>=0&&n<(post.value?.media.length||0)?n:0}),currentMedia=computed(()=>post.value?.media[viewerIndex.value])
const images=computed(()=>post.value?.media.every(x=>x.kind==='image')),replyWaiting=computed(()=>!relation.value?.canMessage&&!!connection.value),about=computed(()=>author.value?.aboutTranslations?.[state.locale]||author.value?.about||post.value?.author.about||t('s.noAbout'))
async function load(){
 ready.value=false;authorReady.value=false
 const ok=await run('post-load',async signal=>{const result=await bridge.call('content','post',{id:route.params.id},{signal});await applyContent(result,signal)})
 if(ok&&post.value)authorReady.value=await run('post-author',async signal=>applySocial(await bridge.call('social','profile',{peerId:post.value.authorId},{signal}),signal))
 ready.value=true
}
onMounted(load)
watch(()=>route.params.id,()=>{sheet.value='';reason.value='harassment';details.value='';reportCommit.value=newId();load()})
watch(viewerIndex,index=>{if(mediaMode.value)mediaIndex.value=index})
watch(()=>relation.value?.blocked,blocked=>{if(blocked){sheet.value='';document.querySelectorAll('audio,video').forEach(x=>x.pause())}})
function back(){if(mediaMode.value)router.replace({name:'post',params:{id:route.params.id},query:route.query});else router.push(typeof route.query.from==='string'&&(['/home','/my-posts','/my-lights','/mine','/chats'].includes(route.query.from)||route.query.from.startsWith('/profile/')||route.query.from.startsWith('/collections/')||route.query.from.startsWith('/conversation/'))?route.query.from:'/home')}
async function light(){if(!post.value.lit)await mutateContent('echo',{postId:post.value.id,lit:true})}
async function chat(){if(navigating.value||state.ui.busy||!canNavigate())return;navigating.value=true;try{await router.push({name:'conversation',params:{peer:post.value.authorId},query:{from:route.fullPath}})}finally{navigating.value=false}}
function reply(){if(state.ui.busy||navigating.value)return;if(relation.value?.blocked){state.ui.error='USER_BLOCKED';return}if(relation.value?.canMessage||connection.value?.direction==='received'&&connection.value.status==='pending')return chat();sheet.value=replyWaiting.value?'waiting':'reply'}
async function send(){if(await socialAction('replyPost',{postId:post.value.id,body:draft.value.body,commitId:draft.value.commitId},{notice:'s.connectionSent'})){draft.value.body='';draft.value.commitId=newId();sheet.value=''}}
async function hide(){const id=post.value.id;if(await mutateContent('hide',{postId:id,hidden:true},{notice:'p2.hidden'})){content.lastHidden=id;sheet.value='';await router.push('/home')}}
async function block(){const id=post.value.authorId;if(await mutateContent('block',{authorId:id,blocked:true},{notice:'p2.blocked'})){content.lastBlocked=id;sheet.value='';await router.push('/home')}}
async function report(){await run('post-report',async signal=>{const result=await bridge.call('content','report',{postId:post.value.id,commitId:reportCommit.value,reason:reason.value,details:details.value},{signal});await applyContent(result,signal);sheet.value='';reportCommit.value=newId();state.ui.notice='p2.reportSaved'},{critical:true})}
function viewMedia(index){if(state.ui.busy||!canNavigate()||navigating.value)return;mediaIndex.value=index;router.push({name:'postMedia',params:{id:post.value.id,index},query:route.query})}
function changeMedia(delta){const n=post.value.media.length,index=(viewerIndex.value+delta+n)%n;router.replace({name:'postMedia',params:{id:post.value.id,index},query:route.query})}
</script>
<template>
<ContentShell back :ready="ready" :title="mediaMode?t('p2.mediaViewer'):''" class="post-detail-shell" :class="{'detail-fullscreen-media':mediaMode,'detail-is-lit':revealed}" @back="back">
 <template #header><button v-if="post&&!mediaMode" class="source-icon" :disabled="!!state.ui.busy" :aria-label="t('p2.more')" @click="sheet='more'"><img src="/images/p2/more-button.png" alt=""/></button></template>
 <div v-if="!ready" class="content-state"><p>{{ t('p2.loading') }}</p></div>
 <div v-else-if="!post||relation?.blocked||!authorReady" class="content-state"><h2>{{ t(relation?.blocked?'s.blocked':post&&!authorReady?'s.profileUnavailable':'p2.unavailable') }}</h2><ActionButton @click="load">{{ t('retry') }}</ActionButton><ActionButton secondary @click="back">{{ t('back') }}</ActionButton></div>
 <section v-else-if="mediaMode" class="media-view"><VideoPlayer v-if="currentMedia?.kind==='video'&&currentMedia.url" :key="currentMedia.id" :src="currentMedia.url"/><img v-else-if="currentMedia?.url" :src="currentMedia.url" :alt="t('photoNumber',{n:viewerIndex+1})" draggable="false"/><div v-else class="content-state"><p>{{ t('p2.mediaMissing') }}</p><button class="text-link" @click="load">{{ t('retry') }}</button></div><div v-if="post.media.length>1" class="media-pagination"><button class="icon-button" :aria-label="t('p2.previous')" @click="changeMedia(-1)"><AppIcon name="back"/></button><span>{{ viewerIndex+1 }} / {{ post.media.length }}</span><button class="icon-button" :aria-label="t('p2.next')" @click="changeMedia(1)"><AppIcon name="arrow"/></button></div></section>
 <article v-else class="detail-layout">
  <div v-if="post.media.length" class="detail-hero" :class="{revealed}">
   <PostImageCarousel v-if="images" :key="post.id" :media="post.media" detail :delay="2000" :initial-index="mediaIndex" @change="mediaIndex=$event" @open="viewMedia" @retry="load"/>
   <VideoPlayer v-else-if="post.media[0]?.url" :src="post.media[0].url" expandable @expand="viewMedia(0)"/>
   <div v-else class="content-state"><p>{{ t('p2.mediaMissing') }}</p><button class="text-link" @click="load">{{ t('retry') }}</button></div>
   <span class="detail-hero-shade" aria-hidden="true"/>
  </div>
  <div class="detail-copy" :class="{'text-only':!post.media.length}"><p class="detail-body">{{ post.demoKey?t('p2.'+post.demoKey):post.body }}</p></div>
  <div class="detail-action-area">
   <div v-if="!revealed" class="light-action"><ActionButton class="purple-gradient" :busy="state.ui.busy==='content-echo'" :disabled="!!state.ui.busy" @click="light"><img class="source-light-bulb" src="/images/p2/light-bulb.svg" alt=""/>{{ t('p2.lightUp') }}</ActionButton></div>
   <section v-else class="author-card">
    <div class="author-summary"><PersonAvatar :person="author" :size="44"/><div class="detail-author-text"><strong>{{ post.author.displayName }}</strong><p>{{ about }}</p></div><span v-if="isMine" class="detail-own-label">{{ t('p2.ownPost') }}</span><img v-else-if="state.locale==='en'" class="detail-lit-badge" src="/images/post-detail/lit-up-badge.png" :alt="t('p2.lit')"/><span v-else class="detail-lit-badge localized"><img src="/images/post-detail/lit-bulb.svg" alt=""/>{{ t('p2.lit') }}</span></div>
    <div class="author-actions"><ActionButton class="detail-profile-button" :disabled="!!state.ui.busy" @click="router.push({name:'profile',params:{id:post.authorId},query:{from:route.fullPath}})"><img src="/images/post-detail/profile-icon.svg" alt=""/>{{ t('p2.viewProfile') }}</ActionButton><ActionButton v-if="!isMine" class="purple-gradient detail-reply-button" :class="{'reply-waiting':replyWaiting}" :disabled="!!state.ui.busy||navigating" :aria-describedby="replyWaiting?'reply-status':undefined" @click="reply"><img class="detail-reply-icon" src="/images/post-detail/reply-icon.svg" alt=""/>{{ t('p2.reply') }}</ActionButton></div>
    <span v-if="replyWaiting" id="reply-status" class="sr-only">{{ t(connection.status==='declined'?'s.connectionDeclined':'s.connectionWaiting') }}</span>
   </section>
   <span v-if="post.media.length" class="detail-page-count" aria-live="off">{{ mediaIndex+1 }}/{{ post.media.length }}</span>
  </div>
 </article>
</ContentShell>
<AppModal v-if="sheet==='reply'&&post" sheet blur-on-blank :title="t('p2.reply')" :closable="!state.ui.busy" :dismiss-on-backdrop="false" @close="sheet=''"><label class="sr-only" for="reply-input">{{ t('s.connectionPlaceholder') }}</label><textarea id="reply-input" class="connection-reply-input" v-model="draft.body" :disabled="!!state.ui.busy" :placeholder="t('s.connectionPlaceholder')"/><p class="character-counter">{{ characterCount(draft.body) }} / 500</p><p class="field-hint">{{ t('s.connectionIntroHint') }}</p><p v-if="state.ui.error" class="error-banner" role="alert" :data-error-code="state.ui.error">{{ t('errors.'+state.ui.error) }}</p><template #headerAction><ActionButton class="purple-gradient sheet-save" :busy="!!state.ui.busy" :disabled="!draft.body.trim()||characterCount(draft.body)>500||!!state.ui.busy" @click="send">{{ t('s.send') }}</ActionButton></template></AppModal>
<AppModal v-if="sheet==='waiting'" :title="t('p2.reply')" @close="sheet=''"><p>{{ t(connection?.status==='declined'?'s.connectionDeclined':'s.connectionWaiting') }}</p><template #footer><ActionButton @click="sheet=''">{{ t('done') }}</ActionButton></template></AppModal>
<AppModal v-if="sheet==='more'&&post" :title="t('p2.safety')" @close="sheet=''"><div class="source-actions"><ActionButton v-if="isMine" secondary @click="sheet='delete'">{{ t('p5.deletePost') }}</ActionButton><ActionButton secondary @click="hide">{{ t('p2.hide') }}</ActionButton><template v-if="!isMine"><ActionButton secondary @click="sheet='report'">{{ t('p2.report') }}</ActionButton><ActionButton secondary @click="sheet='block'">{{ t('p2.block') }}</ActionButton></template></div></AppModal>
<DeletePostDialog v-if="sheet==='delete'&&post" :post-id="post.id" @close="sheet=''" @deleted="sheet='';back()"/>
<AppModal v-if="sheet==='block'&&post" :title="t('p2.blockTitle')" :closable="!state.ui.busy" @close="sheet=''"><p>{{ t('p2.blockHint') }}</p><template #footer><ActionButton secondary :disabled="!!state.ui.busy" @click="sheet=''">{{ t('cancel') }}</ActionButton><ActionButton :busy="!!state.ui.busy" @click="block">{{ t('p2.block') }}</ActionButton></template></AppModal>
<AppModal v-if="sheet==='report'&&post" :title="t('p2.report')" :closable="!state.ui.busy" @close="sheet=''"><p class="simulation-note">{{ t('p2.reportLocal') }}</p><fieldset><legend>{{ t('p2.reportReason') }}</legend><div class="chips"><button v-for="id in ['harassment','hate','sexual','violence','spam','impersonation','misinformation']" :key="id" class="chip" :class="{selected:reason===id}" :aria-pressed="reason===id" @click="reason=id">{{ t('p2.'+id) }}</button></div></fieldset><label class="sheet-input-label">{{ t('p2.reportDetails') }}<textarea v-model="details" :placeholder="t('p2.reportPlaceholder')"/></label><p v-if="state.ui.error" class="error-banner" role="alert">{{ t('errors.'+state.ui.error) }}</p><template #footer><ActionButton secondary :disabled="!!state.ui.busy" @click="sheet=''">{{ t('cancel') }}</ActionButton><ActionButton class="purple-gradient" :disabled="characterCount(details)>500||!!state.ui.busy" :busy="!!state.ui.busy" @click="report">{{ t('p2.submitReport') }}</ActionButton></template></AppModal>

</template>

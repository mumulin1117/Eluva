<script setup>
import { computed,onBeforeUnmount,onMounted,ref,watch,nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t,bridge,run,canNavigate } from '../state.js'
import { content,applyContent,mutateContent } from '../content-state.js'
import { characterCount } from '../domain/content.js'
import { newId } from '../domain/id.js'
import { asAppError } from '../domain/errors.js'
import { createLoadingPace,paintLoading,prepareLoadingImages } from '../services/loading-presentation.js'
import { social,person,introDraft,applySocial,socialAction } from '../social-state.js'
import ContentShell from '../components/ContentShell.vue'
import AppModal from '../components/AppModal.vue'
import ActionButton from '../components/ActionButton.vue'
import AppIcon from '../components/AppIcon.vue'
import VideoPlayer from '../components/VideoPlayer.vue'
import DeletePostDialog from '../components/DeletePostDialog.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import PostImageCarousel from '../components/PostImageCarousel.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import SocialSafety from '../components/SocialSafety.vue'
import '../post-detail.css'
const route=useRoute(),ready=ref(false),authorReady=ref(false),sheet=ref(''),navigating=ref(false)
const post=computed(()=>content.posts.find(x=>x.id===route.params.id)),isMine=computed(()=>post.value?.authorId===state.user?.id),revealed=computed(()=>post.value?.lit||isMine.value)
const author=computed(()=>person(post.value?.authorId)),relation=computed(()=>author.value?.relationship),draft=computed(()=>introDraft(post.value?.authorId)),connection=computed(()=>relation.value?.connection)
content.detailMediaIndices||={}
const cacheKey=computed(()=>state.user?.id+':'+route.params.id),mediaIndex=computed({get:()=>content.detailMediaIndices[cacheKey.value]||0,set:value=>{content.detailMediaIndices[cacheKey.value]=value}})
const mediaMode=computed(()=>route.name==='postMedia'),viewerIndex=computed(()=>{const n=Number(route.params.index);return Number.isInteger(n)&&n>=0&&n<(post.value?.media.length||0)?n:0}),currentMedia=computed(()=>post.value?.media[viewerIndex.value])
const images=computed(()=>post.value?.media.every(x=>x.kind==='image')),replyWaiting=computed(()=>!relation.value?.canMessage&&!!connection.value),about=computed(()=>author.value?.aboutTranslations?.[state.locale]||author.value?.about||post.value?.author.about||t('s.noAbout'))
let generation=0,releaseWait,loadingController
onBeforeUnmount(()=>{generation++;loadingController?.abort();releaseWait?.()})
async function load(){
 loadingController?.abort()
 releaseWait?.()
 const controller=new AbortController(),pace=mediaMode.value?null:createLoadingPace(controller.signal);loadingController=controller
 const version=++generation,id=String(route.params.id),owner=state.user?.id
 const current=()=>!controller.signal.aborted&&generation===version&&state.user?.id===owner&&String(route.params.id)===id
 ready.value=false;authorReady.value=false
 try{
 await paintLoading(controller.signal);if(!current())return
 // A route may replace a cancelled read before its finalizer releases the
 // existing lock. Wait for that read rather than rendering a false empty state.
 if(state.ui.busy)await new Promise(resolve=>{
  const finish=()=>{stop();if(releaseWait===finish)releaseWait=null;resolve()}
  const stop=watch(()=>state.ui.busy,value=>{if(!value)finish()})
  releaseWait=finish
 })
 if(!current())return
 const ok=await run('post-load',async signal=>{const result=await bridge.call('content','post',{id},{signal});if(current())await applyContent(result,signal)})
 if(!current())return
 if(ok&&post.value){const peerId=post.value.authorId,authorOk=await run('post-author',async signal=>{const result=await bridge.call('social','profile',{peerId},{signal});if(current())await applySocial(result,signal)});if(!current())return;authorReady.value=authorOk}
 if(!current())return
 if(ok&&authorReady.value&&post.value?.id===id&&!relation.value?.blocked&&content.ownerId===owner&&social.ownerId===owner){
  const index=mediaMode.value?viewerIndex.value:Math.min(Math.max(0,mediaIndex.value),Math.max(0,post.value.media.length-1))
  const firstMedia=post.value.media[index]
  await prepareLoadingImages([firstMedia?.kind==='image'?firstMedia.url:null,revealed.value?author.value?.photos?.[0]?.url:null],{signal:controller.signal})
  if(!current())return
  await pace?.finish()
 }
 }catch(error){
  if(!current()||asAppError(error).code==='CANCELLED')return
  authorReady.value=false;state.ui.error=asAppError(error).code
 }finally{pace?.cancel();if(current())ready.value=true}
}
onMounted(load)
watch(()=>route.params.id,()=>{sheet.value='';load()})
watch(viewerIndex,index=>{if(mediaMode.value)mediaIndex.value=index})
watch(()=>relation.value?.blocked,blocked=>{if(blocked){sheet.value='';document.querySelectorAll('audio,video').forEach(x=>x.pause())}})
function back(){if(mediaMode.value)router.replace({name:'post',params:{id:route.params.id},query:route.query});else router.push(typeof route.query.from==='string'&&(['/home','/my-posts','/my-lights','/mine','/chats'].includes(route.query.from)||route.query.from.startsWith('/profile/')||route.query.from.startsWith('/collections/')||route.query.from.startsWith('/conversation/'))?route.query.from:'/home')}
async function light(){if(!post.value.lit)await mutateContent('echo',{postId:post.value.id,lit:true})}
async function chat(){if(navigating.value||state.ui.busy||!canNavigate())return;navigating.value=true;try{await router.push({name:'conversation',params:{peer:post.value.authorId},query:{from:route.fullPath}})}finally{navigating.value=false}}
function reply(){if(state.ui.busy||navigating.value)return;if(relation.value?.blocked){state.ui.error='USER_BLOCKED';return}if(relation.value?.canMessage||connection.value?.direction==='received'&&connection.value.status==='pending')return chat();sheet.value=replyWaiting.value?'waiting':'reply'}
async function send(){if(await socialAction('replyPost',{postId:post.value.id,body:draft.value.body,commitId:draft.value.commitId},{notice:''})){state.ui.notice='';draft.value.body='';draft.value.commitId=newId();sheet.value='sent'}}
function closeReplyNotice(){sheet.value='';nextTick(()=>document.querySelector('.detail-reply-button')?.focus({preventScroll:true}))}
function viewMedia(index){if(state.ui.busy||!canNavigate()||navigating.value)return;mediaIndex.value=index;router.push({name:'postMedia',params:{id:post.value.id,index},query:route.query})}
function changeMedia(delta){const n=post.value.media.length,index=(viewerIndex.value+delta+n)%n;router.replace({name:'postMedia',params:{id:post.value.id,index},query:route.query})}
</script>
<template>
<ContentShell back :ready="ready" :title="mediaMode?t('p2.mediaViewer'):''" class="post-detail-shell" :class="{'detail-fullscreen-media':mediaMode,'detail-is-lit':revealed}" @back="back">
 <template #header><template v-if="ready&&authorReady&&post&&!mediaMode"><SocialSafety v-if="!isMine" :key="post.id" :peer-id="post.authorId" :post-id="post.id"/><button v-else class="source-icon" :disabled="!!state.ui.busy" :aria-label="t('p2.more')" @click="sheet='more'"><img src="/images/p2/more-button.png" alt=""/></button></template></template>
 <LoadingSkeleton v-if="!ready" variant="detail" :label="t('p2.loading')"/>
 <div v-else-if="!post||relation?.blocked||!authorReady" class="content-state"><h2>{{ t(relation?.blocked?'s.blocked':post&&!authorReady?'s.profileUnavailable':'p2.unavailable') }}</h2><ActionButton @click="load">{{ t('retry') }}</ActionButton><ActionButton secondary @click="back">{{ t('back') }}</ActionButton></div>
 <section v-else-if="mediaMode" class="media-view"><VideoPlayer v-if="currentMedia?.kind==='video'&&currentMedia.url" :key="currentMedia.id" :src="currentMedia.url"/><img v-else-if="currentMedia?.url" :src="currentMedia.url" :alt="t('photoNumber',{n:viewerIndex+1})" draggable="false"/><div v-else class="content-state"><p>{{ t('p2.mediaMissing') }}</p><button class="text-link" @click="load">{{ t('retry') }}</button></div><div v-if="post.media.length>1" class="media-pagination"><button class="icon-button" :aria-label="t('p2.previous')" @click="changeMedia(-1)"><AppIcon name="back"/></button><span>{{ viewerIndex+1 }} / {{ post.media.length }}</span><button class="icon-button" :aria-label="t('p2.next')" @click="changeMedia(1)"><AppIcon name="arrow"/></button></div></section>
 <article v-else class="detail-layout loading-content-reveal">
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
<AppModal v-if="sheet==='waiting'||sheet==='sent'" centered variant="connection" :title="t(sheet==='sent'?'s.connectionSent':'p2.reply')" @close="closeReplyNotice"><p>{{ t(connection?.status==='declined'?'s.connectionDeclined':'s.connectionWaiting') }}</p><template #footer><ActionButton @click="closeReplyNotice">{{ t('done') }}</ActionButton></template></AppModal>
<AppModal v-if="sheet==='more'&&post&&isMine" :title="t('p2.safety')" @close="sheet=''"><div class="source-actions"><ActionButton secondary @click="sheet='delete'">{{ t('p5.deletePost') }}</ActionButton></div></AppModal>
<DeletePostDialog v-if="sheet==='delete'&&post" :post-id="post.id" @close="sheet=''" @deleted="sheet='';back()"/>

</template>

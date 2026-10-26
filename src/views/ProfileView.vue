<script setup>
import { computed,nextTick,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t } from '../state.js'
import { social,person,loadSocial,socialAction } from '../social-state.js'
import { content,loadContent } from '../content-state.js'
import { allowedReturnPath } from '../domain/navigation.js'
import { asAppError } from '../domain/errors.js'
import { createLoadingPace,paintLoading,prepareLoadingImages } from '../services/loading-presentation.js'
import ContentShell from '../components/ContentShell.vue'
import ConnectionAction from '../components/ConnectionAction.vue'
import SocialSafety from '../components/SocialSafety.vue'
import PostCard from '../components/PostCard.vue'
import ActionButton from '../components/ActionButton.vue'
import AppModal from '../components/AppModal.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import '../profile.css'
const route=useRoute(),ready=ref(false),sheet=ref(''),selected=ref(0),p=computed(()=>person(route.params.id)),mine=computed(()=>route.params.id===state.user?.id),posts=computed(()=>content.posts.filter(x=>social.profilePosts.some(y=>y.id===x.id)&&x.authorId===route.params.id)),collections=computed(()=>social.collections.filter(x=>x.ownerId===route.params.id))
const failed=ref(false),photoFailed=ref(false),entryReveal=ref(false)
let generation=0,loadingController
onBeforeUnmount(()=>{generation++;loadingController?.abort()})
function restoreProfile(){
 const owner=state.user?.id,id=String(route.params.id)
 if(!owner||!social.presentedProfiles?.[id]||!social.loaded||social.ownerId!==owner||!content.loaded||content.ownerId!==owner||p.value?.id!==id||p.value.relationship?.blocked)return false
 generation++;loadingController?.abort()
 ready.value=true;failed.value=false;entryReveal.value=false
 return true
}
restoreProfile()
async function load(){
 loadingController?.abort()
 const controller=new AbortController(),pace=mine.value?null:createLoadingPace(controller.signal);loadingController=controller
 const version=++generation,peerId=String(route.params.id),owner=state.user?.id
 const current=()=>!controller.signal.aborted&&version===generation&&state.user?.id===owner&&String(route.params.id)===peerId
 ready.value=false;failed.value=false;photoFailed.value=false;entryReveal.value=false
 try{
  // Paint first, then retain a readable loading beat alongside the real read.
  await paintLoading(controller.signal);if(!current())return
  let ok=await loadSocial();if(!current())return
  if(ok)ok=await socialAction('profile',{peerId},{notice:'',critical:false});if(!current())return
  if(ok)ok=await loadContent({quiet:true});if(!current())return
  failed.value=!ok
  if(ok&&p.value?.id===peerId&&!p.value.relationship?.blocked&&social.ownerId===owner&&content.ownerId===owner){
   const firstPost=posts.value[0],images=firstPost?.media.filter(x=>x.kind==='image')||[]
   const index=Math.min(Math.max(0,content.detailMediaIndices[imageKey(firstPost?.id)]||0),Math.max(0,images.length-1))
   const firstPostImages=!mine.value&&images.length>1?[images[index]?.url]:images.slice(0,3).map(x=>x.url)
   await prepareLoadingImages([p.value.photos[0]?.url,...firstPostImages],{signal:controller.signal})
   if(!current())return
   await pace?.finish()
   if(!current())return
   social.presentedProfiles[peerId]=true;entryReveal.value=!mine.value
  }
 }catch(error){
  if(!current()||asAppError(error).code==='CANCELLED')return
  failed.value=true;state.ui.error=asAppError(error).code
 }finally{pace?.cancel();if(current())ready.value=true}
}
onMounted(()=>{if(!restoreProfile())load()});watch(()=>route.params.id,()=>{sheet.value='';selected.value=0;photoFailed.value=false;if(!restoreProfile())load()})
function back(){router.push(allowedReturnPath(route.query.from,{fallback:'/home',exact:['/mine','/chats','/chats/lights','/friends','/friend-requests'],prefix:['/post/','/conversation/']}))}
const openPost=id=>router.push({name:'post',params:{id},query:{from:route.fullPath}})
const openMedia=(id,index)=>router.push({name:'postMedia',params:{id,index},query:{from:route.fullPath}})
const imageKey=id=>'profile:'+state.user?.id+':'+id
async function follow(){if(state.ui.busy)return;const main=document.querySelector('.profile-shell>.page-content'),scroll=main?.scrollTop||0;await socialAction('follow',{peerId:p.value.id,following:!p.value.relationship.following},{notice:''});await nextTick();if(main?.isConnected)main.scrollTop=scroll}
</script>
<template>
 <ContentShell back class="profile-shell" :title="t('s.profile')" :ready="ready" :show-error="false" @back="back">
  <template #overlay><p v-if="ready&&state.ui.error&&!failed" class="error-banner profile-operation-error" role="alert" :data-error-code="state.ui.error">{{ t('errors.'+state.ui.error) }}</p></template>
  <template #header><SocialSafety v-if="ready&&p&&!mine&&!p.relationship?.blocked" :peer-id="p.id"/></template>
  <LoadingSkeleton v-if="!ready" variant="profile"/>
  <div v-else-if="failed||!p" class="content-state" :data-error-code="failed?state.ui.error:undefined"><h2>{{ t(failed?'s.profileLoadFailed':'s.profileUnavailable') }}</h2><ActionButton @click="load">{{ t('retry') }}</ActionButton></div>
  <template v-else-if="!p.relationship?.blocked">
   <button class="profile-hero" :class="{'loading-content-reveal':entryReveal}" :aria-label="t('s.photos')" :disabled="!p.photos.length||photoFailed" @click="sheet='photos'"><img v-if="p.photos[0]?.url&&!photoFailed" :src="p.photos[0].url" alt="" @error="photoFailed=true"/><img v-else class="profile-placeholder" src="/images/default-avatar.svg" alt=""/></button>
   <article class="public-profile-card" :class="{'loading-content-reveal':entryReveal}"><div class="profile-name-line"><h2>{{ p.displayName }}</h2><img v-if="p.proActive" class="profile-pro-badge" src="/images/p6/pro-badge.svg" :alt="t('p6.badge')"/></div><p>{{ p.aboutTranslations?.[state.locale]||p.about||t('s.noAbout') }}</p><div v-if="!mine" class="public-actions"><ActionButton :class="p.relationship?.following?'following-button':'dark-gradient'" :disabled="!!state.ui.busy" @click="follow"><img class="profile-follow-image" :src="p.relationship?.following?'/images/profile/following-icon.svg':'/images/profile/follow-icon.svg'" alt=""/>{{ t(p.relationship?.following?'s.following':'s.follow') }}</ActionButton><ConnectionAction :peer-id="p.id" :from="route.fullPath" icon profile-mode/></div><p v-else>{{ t('s.self') }}</p><div class="profile-counts"><div v-for="[key,label] in [['following','following'],['followers','followers'],['friends','friends']]" :key="key"><strong>{{ p.counts[key] }}</strong><span>{{ t('s.'+label) }}</span></div></div></article>
   <button class="profile-collections" :class="{'loading-content-reveal':entryReveal}" @click="router.push({name:'profileCollections',params:{id:p.id},query:{from:route.fullPath}})"><img src="/images/profile/collection-icon.png" alt=""/><span><strong>{{ t('s.collections') }}</strong><small>{{ collections.length }}</small></span><img class="profile-collection-arrow" src="/images/profile/collection-arrow.png" alt=""/></button>
   <p v-if="!posts.length" class="social-empty">{{ t('s.noProfilePosts') }}</p><div v-else class="public-posts" :class="{'loading-content-reveal':entryReveal}"><PostCard v-for="post in posts" :key="post.id" :post="post" compact :carousel="!mine" :initial-index="content.detailMediaIndices[imageKey(post.id)]||0" @image-change="content.detailMediaIndices[imageKey(post.id)]=$event" @open="openPost(post.id)" @open-media="index=>openMedia(post.id,index)" @retry="load"/></div>
  </template>
 </ContentShell>
 <AppModal v-if="sheet==='photos'&&!p?.relationship?.blocked" :title="t('s.photos')" @close="sheet=''"><img v-if="p?.photos[selected]?.url" class="profile-photo-viewer" :src="p.photos[selected].url" :alt="t('photoNumber',{n:selected+1})"/><p v-else>{{ t('s.photoMissing') }}</p><div class="media-pagination"><ActionButton secondary :disabled="selected===0" @click="selected--">{{ t('p2.previous') }}</ActionButton><span>{{ selected+1 }} / {{ p.photos.length }}</span><ActionButton secondary :disabled="selected>=p.photos.length-1" @click="selected++">{{ t('p2.next') }}</ActionButton></div></AppModal>
</template>

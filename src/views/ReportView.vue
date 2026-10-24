<script setup>
import { computed,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t,bridge,run } from '../state.js'
import { social,person,loadSocial,socialAction,reportDraft,reportDraftKey } from '../social-state.js'
import { content,applyContent,mutateContent } from '../content-state.js'
import { allowedReturnPath } from '../domain/navigation.js'
import { characterCount } from '../domain/content.js'
import ContentShell from '../components/ContentShell.vue'
import ActionButton from '../components/ActionButton.vue'
import '../profile.css'
const route=useRoute(),ready=ref(false),failed=ref(false)
const type=computed(()=>route.name==='reportPost'?'post':'user'),id=computed(()=>String(route.params.id))
const post=computed(()=>type.value==='post'?content.posts.find(p=>p.id===id.value):null)
const peer=computed(()=>type.value==='post'?post.value?.authorId:id.value),target=computed(()=>person(peer.value))
const available=computed(()=>!!target.value&&!target.value.relationship?.blocked&&(type.value==='user'||!!post.value&&post.value.authorId!==state.user?.id))
const draft=computed(()=>reportDraft(type.value,id.value)),reasons=['harassment','hate','sexual','violence','spam','impersonation','misinformation']
const reasonGroups=[reasons.slice(0,3),reasons.slice(3,5),reasons.slice(5)]
const valid=computed(()=>reasons.includes(draft.value.reason)&&characterCount(draft.value.details)<=500)
let generation=0,releaseWait
onBeforeUnmount(()=>{generation++;releaseWait?.()})
async function load(){
 releaseWait?.()
 const version=++generation,owner=state.user?.id,targetId=id.value,targetType=type.value
 const current=()=>version===generation&&state.user?.id===owner&&id.value===targetId&&type.value===targetType
 ready.value=false;failed.value=false;state.ui.notice=''
 if(state.ui.busy)await new Promise(resolve=>{
  const finish=()=>{stop();if(releaseWait===finish)releaseWait=null;resolve()}
  const stop=watch(()=>state.ui.busy,value=>{if(!value)finish()})
  releaseWait=finish
 })
 if(!current())return
 let ok=true
 if(targetType==='post')ok=await run('report-target',async signal=>{
  const result=await bridge.call('content','post',{id:targetId},{signal})
  if(current())await applyContent(result,signal)
 })
 if(!current())return
 const peerId=peer.value
 if(ok&&peerId){
  ok=await loadSocial()
  if(!current())return
  if(ok)ok=await socialAction('profile',{peerId},{notice:'',critical:false})
 }else ok=false
 if(!current())return
 failed.value=!ok;ready.value=true
}
onMounted(load);watch(()=>[id.value,type.value],load)
function back(){router.push(allowedReturnPath(route.query.from,{fallback:type.value==='post'?'/post/'+encodeURIComponent(id.value):'/profile/'+encodeURIComponent(peer.value||id.value),prefix:['/profile/','/conversation/','/post/'],exact:['/chats','/chats/lights','/friends']}))}
async function submit(){
 if(state.ui.busy||!valid.value||!available.value)return
 const targetType=type.value,targetId=id.value,key=reportDraftKey(targetType,targetId),d=draft.value
 const payload=d.pendingPayload?{...d.pendingPayload}:{...(targetType==='post'?{postId:targetId}:{peerId:targetId}),reason:d.reason,details:d.details,commitId:d.commitId}
 d.pendingPayload=payload
 const ok=targetType==='post'?await mutateContent('report',payload,{notice:'p2.reportSaved'}):await socialAction('report',payload,{notice:'p2.reportSaved'})
 if(ok){delete social.reportDrafts[key];back()}else if(!['TIMEOUT','NATIVE_FAILED'].includes(state.ui.error)){delete d.pendingPayload}
}
</script>
<template><ContentShell back class="report-shell" :title="t('p2.report')" :ready="ready" :show-error="!failed" @back="back">
 <div v-if="!ready" class="content-state"><p>{{ t('s.loading') }}</p></div>
 <div v-else-if="failed||!available" class="content-state"><p>{{ t(failed?'s.profileLoadFailed':target?.relationship?.blocked?'s.blocked':type==='post'?'p2.unavailable':'s.profileUnavailable') }}</p><ActionButton :disabled="!!state.ui.busy" @click="load">{{ t('retry') }}</ActionButton></div>
 <form v-else :id="type==='post'?'post-report-form':'user-report-form'" class="user-report-form" :aria-label="t('p2.report')+' · '+target.displayName" @submit.prevent="submit">
  <fieldset><legend>{{ t('p2.report') }}</legend><div class="report-options"><button type="button" class="report-option selected" aria-pressed="true">{{ t(type==='post'?'s.profileReportPost':'s.profileReportUser') }}</button></div></fieldset>
  <fieldset><legend>{{ t('p2.reportReason') }}</legend><div v-for="(group,index) in reasonGroups" :key="index" class="report-reason-row"><button v-for="reason in group" :key="reason" type="button" class="report-option" :class="{selected:draft.reason===reason}" :aria-pressed="draft.reason===reason" :disabled="!!state.ui.busy||!!draft.pendingPayload" @click="draft.reason=reason">{{ t('p2.'+reason) }}</button></div></fieldset>
 <label class="report-details-label" :for="type+'-report-details'">{{ t('s.profileReportDetails') }}</label><textarea :id="type+'-report-details'" v-model="draft.details" :disabled="!!state.ui.busy||!!draft.pendingPayload" :aria-invalid="!valid" :placeholder="t('p2.reportPlaceholder')"/><p v-if="!valid" class="error-banner" role="alert">{{ characterCount(draft.details) }} / 500</p>
 </form>
 <template v-if="ready&&!failed&&available" #footer><ActionButton class="purple-gradient" :busy="state.ui.busy===(type==='post'?'content-report':'social-report')" :disabled="!valid||!!state.ui.busy" @click="submit">{{ t('s.profileSubmitReport') }}</ActionButton></template>
</ContentShell></template>

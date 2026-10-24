<script setup>
import { computed,nextTick,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t } from '../state.js'
import { social,loadSocial,socialAction } from '../social-state.js'
import { characterCount } from '../domain/content.js'
import { helpAnswer,helpTopic,helpReplyDue,helpReplyPending } from '../domain/help-buddy.js'
import { newId } from '../domain/id.js'
import ContentShell from '../components/ContentShell.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import ActionButton from '../components/ActionButton.vue'
const route=useRoute(),ready=ref(social.loaded),failed=ref(false),now=ref(Date.now()),lastMessage=ref(null)
const d=computed(()=>social.helpDraft),me=computed(()=>state.user?.profile)
const messages=computed(()=>[...social.feedback].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)))
const pending=item=>helpReplyPending(item,now.value)
const time=value=>new Intl.DateTimeFormat(state.locale,{hour:'2-digit',minute:'2-digit'}).format(new Date(value))
let timer,disposed=false
async function revealLast(){await nextTick();if(!disposed)lastMessage.value?.scrollIntoView({block:'end'})}
function schedule(){
 clearTimeout(timer);now.value=Date.now()
 if(disposed||document.hidden)return
 const due=messages.value.map(helpReplyDue).filter(value=>value>now.value)
 if(due.length)timer=setTimeout(()=>{schedule();revealLast()},Math.max(1,Math.min(...due)-now.value))
}
async function load(){failed.value=false;const ok=await loadSocial();if(disposed)return;failed.value=!ok;ready.value=true;schedule()}
watch(()=>[state.user?.id,social.feedback.map(item=>item.id+':'+item.createdAt).join('|')],schedule)
onMounted(()=>{load();schedule();document.addEventListener('visibilitychange',schedule)})
onBeforeUnmount(()=>{disposed=true;clearTimeout(timer);document.removeEventListener('visibilitychange',schedule)})
function choose(topic){d.value.body=t('s.'+topic);d.value.topic=topic}
async function save(){const draft=d.value,owner=state.user?.id,body=draft.body,topic=helpTopic(body);if(await socialAction('help',{body,topic,commitId:draft.commitId},{notice:''})){if(state.user?.id!==owner)return;draft.body='';draft.commitId=newId();draft.topic='feedback';if(!disposed){failed.value=false;ready.value=true;schedule();await revealLast()}}}
</script>
<template>
 <ContentShell back :show-error="false" :title="t('s.help')" class="conversation-shell help-shell" :ready="ready" @back="router.push(route.query.from==='/mine'?'/mine':'/chats')">
  <template #leading><img class="help-header-avatar" src="/images/p3/help-avatar.png" alt=""/></template>
  <p class="help-intro">{{ t('s.helpIntro') }}</p>
  <p v-if="!ready" class="social-empty" role="status">{{ t('s.loading') }}</p>
  <div v-else-if="failed" class="help-load-error"><p class="error-banner" role="alert" :data-error-code="social.loadError">{{ t('s.helpLoadFailed') }}</p><ActionButton secondary :disabled="!!state.ui.busy" @click="load">{{ t('retry') }}</ActionButton></div>
  <section v-for="item in messages" :key="item.id" class="help-exchange" :data-help-id="item.id">
   <time class="help-time" :datetime="item.createdAt">{{ time(item.createdAt) }}</time>
   <article class="message-line mine"><PersonAvatar :person="me" :size="40"/><div class="message-column"><div class="message-bubble"><p>{{ item.body }}</p></div></div></article>
   <article class="message-line help-answer" :class="{'help-pending':pending(item)}" :aria-busy="pending(item)"><img class="help-message-avatar" src="/images/p3/help-avatar.png" alt=""/><div class="message-bubble" aria-live="polite"><p v-if="pending(item)" class="help-thinking" role="status"><span class="spinner" aria-hidden="true"/>{{ t('s.helpThinking') }}</p><p v-else>{{ t(helpAnswer(item.topic)) }}</p></div></article>
  </section>
  <span ref="lastMessage" class="help-end" aria-hidden="true"/>
  <template #footer>
   <div class="help-questions"><button v-for="key in ['how','posting','privacy']" :key="key" :disabled="!!state.ui.busy||!ready" @click="choose(key)">{{ t('s.'+key) }}</button></div>
   <form class="message-input-row" @submit.prevent="save"><label class="sr-only" for="help-input">{{ t('s.feedbackBody') }}</label><textarea rows="1" id="help-input" v-model="d.body" :disabled="!!state.ui.busy||!ready" :placeholder="t('s.helpPlaceholder')"/><button :aria-label="t('s.helpSend')" :disabled="!!state.ui.busy||!ready||!d.body.trim()||characterCount(d.body)>2000"><img src="/images/p3/send.png" alt=""/></button></form>
   <p v-if="state.ui.error&&!failed" class="error-banner" role="alert" :data-error-code="state.ui.error">{{ t('errors.'+state.ui.error) }}</p>
  </template>
 </ContentShell>
</template>
<style scoped>
.help-shell :deep(.content-header){gap:9px;padding:calc(var(--safe-top) + 12px) 15px 16px}
.help-header-avatar{width:40px;height:40px;object-fit:contain;flex-shrink:0;margin-right:-3px}
.help-shell :deep(.content-header h1){font:700 16px/19px 'Inter',sans-serif;text-align:left}
.help-shell :deep(.page-content){padding:0 15px 24px}
.help-intro{margin:0 5px 24px;min-height:106px;padding:14px 12px 12px;color:rgba(167,35,244,1);font:400 12px/16px 'Poppins',sans-serif}
.help-exchange{margin:0 0 24px;min-width:0}
.help-time{display:block;margin:0 0 16px;text-align:center;color:rgba(190,185,193,1);font:500 12px/15px 'Plus Jakarta Sans',sans-serif}
.help-exchange .message-line{margin:0 0 28px;gap:10px}
.help-answer{padding-inline:5px}
.help-exchange .mine .message-bubble{padding:11.5px 16px;font:500 15px/21px 'Plus Jakarta Sans',sans-serif}
.help-answer .message-bubble{max-width:min(250px,calc(100% - 50px));padding:14px;font:400 15px/22px 'Poppins',sans-serif}
.help-message-avatar{border-radius:50%}
.help-thinking{display:flex;align-items:center;gap:8px;min-width:0;color:#70677c;font-size:13px;line-height:20px}
.help-thinking .spinner{flex-shrink:0}
.help-end{display:block;height:1px}
.help-shell :deep(.page-footer){padding:0 15px calc(10px + var(--safe-bottom));gap:6px}
.help-questions{height:44px;padding:0;gap:8px}
.help-questions button{position:relative;isolation:isolate;min-height:44px;height:44px;border:0;padding:0 10px;background:transparent;font:500 13px/16px 'Inter',sans-serif;overflow-wrap:anywhere}
.help-questions button::before{content:'';position:absolute;inset:6px 0;z-index:-1;background:rgba(250,245,255,1);border:1px solid rgba(153,64,255,1);border-radius:16px}
.help-shell .message-input-row{height:44px;min-height:44px;padding:0 6px 0 18px}
.help-shell .message-input-row textarea{height:44px;min-height:44px;max-height:44px;padding:12px 0;line-height:20px;font-family:'Inter',sans-serif;font-size:16px;overflow-y:auto}
.help-shell .message-input-row>button{width:44px;height:44px;padding:9px;flex-shrink:0}
.help-load-error{margin-bottom:20px}
@media(max-width:350px){.help-intro{margin-inline:0}.help-answer{padding-inline:0}}
@media(prefers-reduced-motion:reduce){.help-thinking .spinner{animation:none}}
</style>

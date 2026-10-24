<script setup>
import { computed,onMounted,onBeforeUnmount,ref } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t } from '../state.js'
import { personal,feedbackDraft,ensurePersonalDraft,personalAction,loadPersonal,releasePersonalDraft } from '../personal-state.js'
import { personalPolicy,feedbackTopics } from '../domain/personal.js'
import { textLength } from '../domain/validation.js'
import ContentShell from '../components/ContentShell.vue'
import DraftImagePicker from '../components/DraftImagePicker.vue'
import ActionButton from '../components/ActionButton.vue'
const route=useRoute(),d=computed(()=>feedbackDraft()),saved=ref(null)
let alive=true
onBeforeUnmount(()=>{alive=false})
onMounted(async()=>{await loadPersonal();if(alive)await ensurePersonalDraft(d.value)})
async function send(){const r=await personalAction('submitFeedback',{draftId:d.value.draftId,commitId:d.value.commitId,body:d.value.body,topic:d.value.topic,mediaIds:d.value.photos.map(x=>x.id)},{notice:'p5.feedbackSaved'});if(r){releasePersonalDraft(d.value);saved.value=personal.feedback.find(x=>x.id===r.resultId);personal.feedbackDraft=null}}
function back(){router.push(['/settings','/settings/about'].includes(route.query.from)?'/settings':'/mine')}
</script>
<template><ContentShell back class="p5-shell feedback-shell" :title="t('p5.feedback')" :ready="personal.loaded" @back="back"><ActionButton v-if="!personal.loaded&&!state.ui.busy" secondary @click="loadPersonal">{{ t('retry') }}</ActionButton><template v-if="saved"><section class="feedback-receipt"><h2>{{ t('p5.feedbackSaved') }}</h2><p>{{ t('p5.feedbackLocal') }}</p><small>{{ saved.id }}</small><p>{{ saved.body }}</p><div class="feedback-attachments"><img v-for="m in saved.photos||[]" :key="m.id" :src="m.url||'/images/default-avatar.svg'" alt=""/></div><ActionButton secondary @click="saved=null;ensurePersonalDraft(d)">{{ t('p5.anotherFeedback') }}</ActionButton></section></template><template v-else><h2 class="p5-section-label">{{ t('p5.questions') }}</h2><label class="sr-only" for="feedback-body">{{ t('p5.questions') }}</label><textarea id="feedback-body" v-model="d.body" class="feedback-body" :placeholder="t('p5.feedbackPlaceholder')" :disabled="!!state.ui.busy"/><p class="character-counter">{{ textLength(d.body) }}/{{ personalPolicy.feedbackLimit }}</p><div class="feedback-topics"><button v-for="id in feedbackTopics" :key="id" :aria-pressed="d.topic===id" :class="{selected:d.topic===id}" :disabled="!!state.ui.busy" @click="d.topic=id">{{ t('p5.topic_'+id) }}</button></div><h2 class="p5-section-label">{{ t('p5.screenshots') }}</h2><DraftImagePicker v-model:photos="d.photos" :draft-id="d.draftId" :ready="d.ready" :max="personalPolicy.feedbackImages" :ordered="false" :label="t('p5.addScreenshot')"/><ActionButton v-if="!d.ready" secondary @click="ensurePersonalDraft(d)">{{ t('retry') }}</ActionButton><p class="field-hint">{{ t('p5.feedbackLocal') }}</p><section v-if="personal.feedback.length" class="feedback-history"><h2>{{ t('p5.savedFeedback') }}</h2><article v-for="x in [...personal.feedback].reverse()" :key="x.id"><strong>{{ t('p5.topic_'+x.topic) }}</strong><p>{{ x.body }}</p><small>{{ new Intl.DateTimeFormat(state.locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(x.createdAt)) }}</small></article></section></template><template v-if="!saved" #footer><ActionButton class="purple-gradient" :disabled="!!state.ui.busy||!d.ready||!d.body.trim()||textLength(d.body)>personalPolicy.feedbackLimit" :busy="state.ui.busy==='personal-submitFeedback'" @click="send">{{ t('p5.submit') }}</ActionButton></template></ContentShell></template>

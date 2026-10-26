<script setup>
import { conversationVersion } from '../data/auth-conversation.js'
import { computed,onMounted,onBeforeUnmount,ref,watch } from 'vue'
import { router } from '../router.js'
import { state,t } from '../state.js'
import { personal,profileDraft,ensurePersonalDraft,personalAction,releasePersonalDraft } from '../personal-state.js'
import { choices } from '../data/choices.js'
import { validateProfile,textLength } from '../domain/validation.js'
import { commerce,commerceAction } from '../commerce-state.js'
import { useMembership } from '../composables-membership.js'
import ContentShell from '../components/ContentShell.vue'
import ActionButton from '../components/ActionButton.vue'
import BirthdayField from '../components/BirthdayField.vue'
import DraftImagePicker from '../components/DraftImagePicker.vue'
import AppModal from '../components/AppModal.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import '../delete-account-prompt.css'
const d=computed(()=>profileDraft()),p=computed(()=>d.value.profile),premium=ref(false),extra=ref(false),picker=ref(null)
const {membership}=useMembership(),frames=Array.from({length:6},(_,i)=>'frame-'+(i+1))
const framesReady=computed(()=>commerce.loaded&&commerce.ownerId===state.user?.id),frameReadFailed=ref(false),frameReading=ref(false)
let frameEpoch=0
async function refreshFrames(){
  if(frameReading.value)return
  const owner=state.user?.id,epoch=++frameEpoch;frameReading.value=true;frameReadFailed.value=false
  const ok=await commerceAction('snapshot',true)
  if(epoch!==frameEpoch||owner!==state.user?.id)return
  frameReadFailed.value=!ok&&!framesReady.value;frameReading.value=false
}
onMounted(async()=>{await ensurePersonalDraft(d.value);await refreshFrames()})
onBeforeUnmount(()=>{frameEpoch++})
watch(()=>state.user?.id,()=>{frameEpoch++;frameReading.value=false;frameReadFailed.value=false;premium.value=false;extra.value=false})
function toggle(field,id){const a=p.value[field];if(a.includes(id))p.value[field]=a.filter(x=>x!==id);else if(field!=='icebreakerIds'||a.length<3)a.push(id)}
function selectFrame(id){if(state.ui.busy||!d.value.ready||!framesReady.value)return;if(!membership.value.active){premium.value=true;return}p.value.avatarFrameId=id}
function removeFrame(){if(!state.ui.busy&&d.value.ready)p.value.avatarFrameId=''}
function closePremium(event){if(event?.detail>1)return;premium.value=false}
async function openMembership(event){if(event?.detail>1||!premium.value)return;premium.value=false;await router.push('/store?from=/edit-profile')}
async function save(){
  if(state.ui.busy||!d.value.ready)return
  const owner=state.user?.id,draft=d.value
  try{
    const base={...state.user.profile,photos:state.user.profile.photos.map(x=>({id:x.id}))}
    const profile={...validateProfile({...draft.profile,photos:draft.profile.photos.map(x=>({id:x.id}))},choices,new Date(),base,state.user.registrationVersion===conversationVersion),avatarFrameId:draft.profile.avatarFrameId||''}
    if(await personalAction('saveProfile',{profile,draftId:draft.draftId,commitId:draft.commitId})){
      if(state.user?.id!==owner||personal.profileDraft!==draft)return
      releasePersonalDraft(draft);personal.profileDraft=null;await router.push('/mine')
    }
  }catch(e){if(state.user?.id===owner)state.ui.error=e.code||'INVALID_PROFILE'}
}
</script>
<template><ContentShell back class="p5-shell profile-edit-shell" :title="t('p5.editProfile')" @back="router.push('/mine')"><div class="edit-avatar"><PersonAvatar :person="p" :size="98" :frame-id="p.avatarFrameId" :frame-active="membership.active"/><button class="edit-photo-link" :disabled="!d.ready||!!state.ui.busy" @click="picker?.changeMain()">{{ t('p5.changePhoto') }}</button></div><label class="p5-field"><span>{{ t('displayName') }}</span><input v-model="p.displayName" autocomplete="nickname" :disabled="!!state.ui.busy"/></label><label class="p5-field"><span>{{ t('aboutTitle') }}</span><textarea v-model="p.about" rows="3" :disabled="!!state.ui.busy"/><small>{{ textLength(p.about) }}/300</small></label><BirthdayField v-model="p.birthday"/><p class="field-hint">{{ t('photoPrivacy') }} {{ t('p5.birthdayPrivate') }}</p><p class="field-hint">{{ t(state.user.registrationVersion===conversationVersion?'ac.sparsePhotos':'photosHint') }}</p><DraftImagePicker ref="picker" v-model:photos="p.photos" :draft-id="d.draftId" :ready="d.ready"/><ActionButton v-if="!d.ready" secondary @click="ensurePersonalDraft(d)">{{ t('retry') }}</ActionButton><fieldset class="p5-choice-field"><legend>{{ t('interestsTitle') }}</legend><div class="chips"><button v-for="x in choices.interests" :key="x.id" class="chip" :class="{selected:p.interestIds.includes(x.id)}" :aria-pressed="p.interestIds.includes(x.id)" :disabled="!!state.ui.busy" @click="toggle('interestIds',x.id)">{{ x[state.locale] }}</button></div></fieldset><button class="option-row" :aria-expanded="extra" :disabled="!!state.ui.busy" @click="extra=!extra">{{ t('p5.moreProfile') }}</button><fieldset v-if="extra" class="p5-extra-profile" :disabled="!!state.ui.busy"><label v-for="[key,label,max] in [['pronouns','pronouns',60],['university','university',120],['otherMajor','otherMajor',120]]" :key="key" class="p5-field"><span>{{ t(label) }}</span><input v-model="p[key]" :maxlength="max"/></label><label v-for="[field,group,label] in [['gender','genders','gender'],['year','years','academicYear'],['major','majors','major']]" :key="field" class="p5-field"><span>{{ t(label) }}</span><select v-model="p[field]"><option value="">{{ t('notProvided') }}</option><option v-for="x in choices[group]" :key="x.id" :value="x.id">{{ x[state.locale] }}</option></select></label><fieldset><legend>{{ t('goalTitle') }}</legend><div class="chips"><button v-for="x in choices.goals" :key="x.id" class="chip" :class="{selected:p.goalIds.includes(x.id)}" :aria-pressed="p.goalIds.includes(x.id)" @click="toggle('goalIds',x.id)">{{ x[state.locale] }}</button></div></fieldset><fieldset><legend>{{ t('iceTitle') }}</legend><div class="option-list"><button v-for="x in choices.icebreakers" :key="x.id" class="option-card" :class="{selected:p.icebreakerIds.includes(x.id)}" :aria-pressed="p.icebreakerIds.includes(x.id)" @click="toggle('icebreakerIds',x.id)">{{ x[state.locale] }}</button></div></fieldset></fieldset><h2 class="p5-section-label">{{ t('p5.avatarFrames') }} <span class="local-pill">PRO</span></h2><div class="avatar-frames" :aria-label="t('p5.avatarFrames')"><button v-for="(id,i) in frames" :key="id" :class="{selected:p.avatarFrameId===id}" :aria-label="t('p5.previewFrame',{n:i+1})" :aria-pressed="p.avatarFrameId===id" :disabled="!!state.ui.busy||!d.ready||!framesReady" @click="selectFrame(id)"><PersonAvatar :person="p" :size="60" :frame-id="id" :frame-active="true" :show-badge="false"/></button></div><button class="avatar-frame-none" :class="{selected:!p.avatarFrameId}" :aria-pressed="!p.avatarFrameId" :disabled="!!state.ui.busy||!d.ready" @click="removeFrame">{{ t('p5.noFrame') }}</button><p v-if="!framesReady" class="field-hint" role="status">{{ t(frameReadFailed?'p5.frameReadFailed':'working') }}</p><button v-if="!framesReady&&frameReadFailed" class="text-link" :disabled="frameReading||!!state.ui.busy" @click="refreshFrames">{{ t('retry') }}</button><p v-else-if="framesReady" class="field-hint" role="status">{{ t(membership.active?'p5.framesSaveHint':p.avatarFrameId?'p5.frameInactiveHint':'p5.framesProHint') }}</p><template #footer><ActionButton class="purple-gradient" :busy="state.ui.busy==='personal-saveProfile'" :disabled="!!state.ui.busy||!d.ready" @click="save">{{ t('save') }}</ActionButton></template></ContentShell><AppModal v-if="premium" centered variant="avatar-premium" :dismiss-on-backdrop="false" :title="t('p5.avatarFrames')" @close="closePremium"><p>{{ t('p5.purchaseUnavailable') }}</p><template #footer><ActionButton @click="openMembership">{{ t('p6.title') }}</ActionButton><ActionButton secondary @click="closePremium">{{ t('cancel') }}</ActionButton></template></AppModal></template>

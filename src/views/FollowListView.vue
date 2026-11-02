<script setup>
import { computed,onMounted,ref } from 'vue'
import { useRoute } from 'vue-router'
import { allowedReturnPath } from '../domain/navigation.js'
import { router } from '../router.js'
import { state,t } from '../state.js'
import { loadSocial,social,socialAction } from '../social-state.js'
import ContentShell from '../components/ContentShell.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import ActionButton from '../components/ActionButton.vue'

const route=useRoute(),pendingId=ref('')
const mode=computed(()=>route.name==='followers'?'followers':'following')
const people=computed(()=>social.profiles.filter(person=>!person.relationship?.blocked&&(mode.value==='following'?person.relationship?.following:person.relationship?.followedBy)))

onMounted(()=>loadSocial({reuse:true}))

function back(){router.push(allowedReturnPath(route.query.from,{fallback:'/mine',exact:['/mine']}))}
function openProfile(person){if(!state.ui.busy)router.push({name:'profile',params:{id:person.id},query:{from:route.fullPath}})}
function actionKey(person){return person.relationship?.following?'unfollow':'followBack'}
async function updateFollow(person){
 if(state.ui.busy||pendingId.value)return
 pendingId.value=person.id
 try{await socialAction('follow',{peerId:person.id,following:!person.relationship?.following},{notice:''})}
 finally{if(pendingId.value===person.id)pendingId.value=''}
}
</script>

<template>
 <ContentShell back class="follow-list-shell" :title="t('s.'+mode)" :ready="social.loaded" :show-error="social.loaded" @back="back">
  <div v-if="!social.loaded" class="content-state">
   <p v-if="social.loadError" class="error-banner" role="alert" :data-error-code="social.loadError">{{ t('s.relationshipLoadFailed') }}</p>
   <p v-else>{{ t('s.loading') }}</p>
   <ActionButton v-if="social.loadError" @click="loadSocial()">{{ t('retry') }}</ActionButton>
  </div>
  <p v-else-if="!people.length" class="social-empty follow-list-empty">{{ t(mode==='following'?'s.noFollowingPeople':'s.noFollowers') }}</p>
  <div v-else class="follow-list">
   <article v-for="person in people" :key="person.id" class="follow-list-row" role="link" tabindex="0" :aria-label="t('s.openPersonProfile',{name:person.displayName})" @click="openProfile(person)" @keydown.enter.self.prevent="openProfile(person)" @keydown.space.self.prevent="openProfile(person)">
    <PersonAvatar :person="person" :size="60"/>
    <span class="follow-list-copy">
     <strong>{{ person.displayName }}</strong>
     <small>{{ person.aboutTranslations?.[state.locale]||person.about||t('s.noAbout') }}</small>
    </span>
    <button class="follow-list-action" :disabled="!!state.ui.busy" :aria-busy="pendingId===person.id||undefined" :aria-label="t('s.'+(person.relationship?.following?'unfollowPerson':'followBackPerson'),{name:person.displayName})" @click.stop="updateFollow(person)">
     <span v-if="pendingId===person.id" class="spinner" aria-hidden="true"/>
     <span v-else>{{ t('s.'+actionKey(person)) }}</span>
    </button>
   </article>
  </div>
 </ContentShell>
</template>

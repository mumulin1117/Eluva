<script setup>
import { computed,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t } from '../state.js'
import { social,person,loadSocial,socialAction } from '../social-state.js'
import { content,loadContent } from '../content-state.js'
import { allowedReturnPath } from '../domain/navigation.js'
import ContentShell from '../components/ContentShell.vue'
import ActionButton from '../components/ActionButton.vue'
import AppModal from '../components/AppModal.vue'
import '../profile.css'
const route=useRoute(),ready=ref(false),failed=ref(false),help=ref(false),peer=computed(()=>String(route.params.id)),p=computed(()=>person(peer.value)),items=computed(()=>social.collections.filter(x=>x.ownerId===peer.value))
let generation=0
onBeforeUnmount(()=>generation++)
async function load(){const version=++generation;ready.value=false;failed.value=false;state.ui.notice='';const ok=await loadSocial()&&await socialAction('profile',{peerId:peer.value},{notice:'',critical:false})&&await loadContent({quiet:true});if(version!==generation)return;failed.value=!ok;ready.value=true}
function restore(){const owner=state.user?.id;if(!owner||!social.presentedProfiles?.[peer.value]||!social.loaded||social.ownerId!==owner||!content.loaded||content.ownerId!==owner||!p.value||p.value.relationship?.blocked)return false;generation++;failed.value=false;ready.value=true;return true}
restore()
onMounted(()=>{if(!restore())load()});watch(peer,()=>{help.value=false;if(!restore())load()})
function back(){router.push(allowedReturnPath(route.query.from,{fallback:'/profile/'+encodeURIComponent(peer.value),prefix:['/profile/']}))}
function cover(item){return content.posts.find(x=>item.postIds.includes(x.id)&&x.media.some(m=>m.kind==='image'&&m.url))?.media.find(m=>m.kind==='image'&&m.url)?.url}
function open(id){if(state.ui.busy)return;router.push({name:'collection',params:{id},query:{from:route.fullPath}})}
</script>
<template><ContentShell back class="profile-collections-shell" :title="t('s.collections')" :ready="ready" :show-error="!failed" @back="back"><template #header><button class="source-icon collection-help" :aria-label="t('p5.collectionHelp')" @click="help=true"><img src="/images/light-notices/help.png" alt=""/></button></template>
 <div v-if="!ready" class="content-state"><p>{{ t('s.loading') }}</p></div>
 <div v-else-if="failed||!p||p.relationship?.blocked" class="content-state"><p>{{ t(failed?'s.profileLoadFailed':p?.relationship?.blocked?'s.blocked':'s.profileUnavailable') }}</p><ActionButton :disabled="!!state.ui.busy" @click="load">{{ t('retry') }}</ActionButton></div>
 <section v-else-if="!items.length" class="profile-collections-empty"><h2>{{ t('s.collections') }}</h2><p>{{ t('s.profileCollectionsEmpty') }}</p><img src="/images/profile/collection-empty.png" alt=""/><p>{{ t('s.profileCollectionsReadOnly') }}</p></section>
 <div v-else class="profile-collection-grid"><button v-for="item in items" :key="item.id" class="profile-collection-tile" @click="open(item.id)"><span class="profile-collection-meta"><small>{{ t(item.postIds.length===1?'p5.postCountOne':'p5.postCount',{n:item.postIds.length}) }}</small><strong>{{ item.name }}</strong></span><img v-if="cover(item)" :src="cover(item)" alt=""/><span v-else class="profile-collection-cover" aria-hidden="true"><img src="/images/profile/collection-icon.png" alt=""/></span></button></div>
</ContentShell><AppModal v-if="help" :title="t('p5.collectionHelp')" @close="help=false"><p>{{ t('s.profileCollectionsHelp') }}</p><template #footer><ActionButton @click="help=false">{{ t('done') }}</ActionButton></template></AppModal></template>

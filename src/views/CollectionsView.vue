<script setup>
import { computed,onMounted,onBeforeUnmount,ref,watch } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t,bridge,run } from '../state.js'
import { content } from '../content-state.js'
import { social,person } from '../social-state.js'
import { personal,loadPersonal,applyPersonal,personalAction,waitPersonalIdle } from '../personal-state.js'
import { newId } from '../domain/id.js'
import ContentShell from '../components/ContentShell.vue'
import CollectionEditor from '../components/CollectionEditor.vue'
import AppIcon from '../components/AppIcon.vue'
import AppModal from '../components/AppModal.vue'
import ActionButton from '../components/ActionButton.vue'
import PostCard from '../components/PostCard.vue'
import '../collections-empty.css'
const route=useRoute(),ready=ref(false),current=ref(null),editor=ref(false),help=ref(false),detail=computed(()=>!!route.params.id),managing=computed(()=>route.name==='collectionPosts'),ownPosts=computed(()=>content.posts.filter(x=>x.authorId===state.user?.id)),selection=computed(()=>personal.collectionSelections[String(route.params.id)]||null)
const posts=computed(()=>content.posts.filter(x=>current.value?.postIds.includes(x.id)))
const otherEntry=computed(()=>String(route.query.from||'').startsWith('/profile/'))
const empty=computed(()=>ready.value&&!detail.value&&!content.collections.length)
let generation=0
onBeforeUnmount(()=>{generation++})
function restore(){
 const owner=state.user?.id,id=String(route.params.id||'')
 if(!owner||!personal.loaded||personal.ownerId!==owner||!content.loaded||content.ownerId!==owner||!social.loaded||social.ownerId!==owner||id&&!personal.presentedCollections?.[id])return false
 generation++;current.value=null
 if(id){
  const collection=content.collections.find(x=>x.id===id)||social.collections.find(x=>x.id===id)
  if(collection){
   const own=collection.ownerId===owner,author=person(collection.ownerId)
   const postIds=collection.postIds.filter(id=>content.posts.some(p=>p.id===id&&(own||p.visibility?.profile)))
   if(own||author&&!author.relationship?.blocked&&postIds.length)current.value={...collection,postIds,editable:own,coverId:own?collection.coverId:null}
  }
  if(managing.value&&current.value?.editable)personal.collectionSelections[id]||={postIds:[...current.value.postIds],commitId:newId()}
 }
 ready.value=true;return true
}
restore()
async function load(){const version=++generation,id=route.params.id,isManaging=managing.value,owner=state.user?.id;ready.value=false;current.value=null;if(id)delete personal.presentedCollections[String(id)];if(!id){await loadPersonal();if(version===generation&&owner===state.user?.id)ready.value=personal.loaded;return}await waitPersonalIdle();if(version!==generation||owner!==state.user?.id)return;await run('collection-load',async signal=>{const r=await bridge.call('personal','collection',{id:String(id)},{signal});await applyPersonal(r,signal);if(signal.aborted||version!==generation||owner!==state.user?.id)return;current.value=r.collection;personal.presentedCollections[String(id)]=true;if(isManaging&&r.collection.editable)personal.collectionSelections[r.collection.id]||={postIds:[...r.collection.postIds],commitId:newId()}});if(version===generation&&owner===state.user?.id)ready.value=true}
onMounted(()=>{if(!restore())load()});watch(()=>route.fullPath,()=>{editor.value=false;if(!restore())load()})
function back(){if(managing.value)return router.push({name:'collection',params:{id:route.params.id},query:route.query});const f=route.query.from;router.push(detail.value?(typeof f==='string'&&(f==='/collections'||f.startsWith('/profile/'))?f:'/collections'):'/mine')}
function cover(x){return x.coverUrl||content.posts.find(p=>x.postIds.includes(p.id)&&p.media[0]?.url)?.media[0]?.url}
function open(id){router.push({name:'collection',params:{id},query:{from:detail.value?'/collections':route.fullPath}})}
async function saved(id){editor.value=false;await loadPersonal();if(detail.value)await load();else open(id)}
function toggle(id){const a=selection.value.postIds;if(a.includes(id))selection.value.postIds=a.filter(x=>x!==id);else a.push(id)}
async function saveRefs(){if(await personalAction('collectionPosts',{id:current.value.id,postIds:[...selection.value.postIds],commitId:selection.value.commitId})){delete personal.collectionSelections[current.value.id];await router.push({name:'collection',params:{id:current.value.id},query:route.query})}}
</script>
<template><ContentShell back class="p5-shell collections-shell" :class="{'collections-empty-shell':empty}" :title="managing?t('p5.selectPosts'):detail?(current?.name||t('s.collections')):t('s.collections')" :ready="ready" :error-key="otherEntry&&state.ui.error!=='COLLECTION_UNAVAILABLE'?'s.profileLoadFailed':undefined" @back="back"><template #header><button v-if="!detail" class="source-icon" :aria-label="t('p5.collectionHelp')" @click="help=true"><AppIcon name="help"/></button><template v-else-if="current?.editable&&!managing"><button class="source-icon" :aria-label="t('p5.editCollection')" @click="editor=true"><img class="collection-action-icon" src="/images/p5/collection-edit.png" alt=""/></button><button class="source-icon" :aria-label="t('p5.managePosts')" @click="router.push({name:'collectionPosts',params:{id:current.id},query:route.query})"><img class="collection-action-icon" src="/images/p5/collection-manage.png" alt=""/></button></template></template><div v-if="!ready" class="content-state"><p>{{ t('working') }}</p><ActionButton v-if="!state.ui.busy" @click="load">{{ t('retry') }}</ActionButton></div><template v-else-if="!detail"><section v-if="empty" class="collections-empty" aria-labelledby="collections-empty-title"><div class="collections-empty-heading"><h2 id="collections-empty-title">{{ t('s.collections') }}<img class="collections-pro-badge" src="/images/p6/pro-badge.svg" alt="PRO" draggable="false"/></h2><p>{{ t('p5.collectionsWaiting') }}</p></div><img class="collections-empty-art" src="/images/p5/collections-empty-cards.png" alt="" draggable="false"/><div class="collections-empty-actions"><ActionButton class="purple-gradient" :disabled="!!state.ui.busy" @click="editor=true">{{ t('p2.createCollection') }}</ActionButton><p>{{ t('p5.collectionsEmptyHint') }}</p></div></section><button v-for="x in content.collections" :key="x.id" class="collection-shelf" @click="open(x.id)"><span><strong>{{ x.name }}</strong><p>{{ x.description }}</p><small>{{ t(x.postIds.length===1?'p5.postCountOne':'p5.postCount',{n:x.postIds.length}) }}</small></span><div v-if="cover(x)" class="collection-stack"><img :src="cover(x)" alt=""/><img :src="cover(x)" alt=""/></div><AppIcon v-else name="image" :size="42"/></button></template><section v-else-if="!current" class="content-state"><h2>{{ t(otherEntry&&state.ui.error!=='COLLECTION_UNAVAILABLE'?'s.profileLoadFailed':'p5.collectionUnavailable') }}</h2><ActionButton @click="load">{{ t('retry') }}</ActionButton></section><template v-else-if="managing"><p v-if="!current.editable" class="error-banner">{{ t('p5.ownerOnly') }}</p><template v-else><p class="collection-rule">{{ t('p5.collectionReferenceRule') }}</p><p v-if="!ownPosts.length" class="social-empty">{{ t('p2.noPosts') }}</p><button v-for="post in ownPosts" :key="post.id" class="collection-select-row" :aria-pressed="selection?.postIds.includes(post.id)" :disabled="!!state.ui.busy" @click="toggle(post.id)"><img v-if="post.media[0]?.url" :src="post.media[0].url" alt=""/><AppIcon v-else name="image" :size="40"/><span>{{ post.body||t('p2.images') }}<small>{{ t('p2.'+(post.visibility.private?'private':post.visibility.audience)) }}</small></span><AppIcon :name="selection?.postIds.includes(post.id)?'check':'plus'" :size="20"/></button><button v-for="id in selection?.postIds.filter(id=>!ownPosts.some(p=>p.id===id))||[]" :key="id" class="option-row" @click="toggle(id)">{{ t('p5.removeUnavailableReference') }}</button></template></template><template v-else><p class="collection-count">{{ t(posts.length===1?'p5.postCountOne':'p5.postCount',{n:posts.length}) }}</p><p v-if="current.description" class="collection-description">{{ current.description }}</p><p v-if="!posts.length" class="social-empty">{{ t('p5.collectionEmpty') }}</p><PostCard v-for="post in posts" :key="post.id" :post="post" compact @open="router.push({name:'post',params:{id:post.id},query:{from:route.fullPath}})"/></template><template v-if="!detail&&!empty||managing&&current?.editable" #footer><ActionButton class="purple-gradient" :busy="state.ui.busy==='personal-collectionPosts'" :disabled="!!state.ui.busy||!ready" @click="managing?saveRefs():editor=true">{{ t(managing?'save':'p2.createCollection') }}</ActionButton><p v-if="!detail" class="field-hint">{{ t('p5.collectionReferenceRule') }}</p></template></ContentShell><CollectionEditor v-if="editor" :id="detail?current?.id:undefined" @close="editor=false" @saved="saved" @deleted="editor=false;router.replace('/collections')"/><AppModal v-if="help" centered variant="connection" :title="t('p5.collectionHelp')" @close="help=false"><p>{{ t('p5.collectionReferenceRule') }}</p><template #footer><ActionButton @click="help=false">{{ t('done') }}</ActionButton></template></AppModal></template>

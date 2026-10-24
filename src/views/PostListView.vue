<script setup>
import { computed,onMounted,ref } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t } from '../state.js'
import { content,loadContent } from '../content-state.js'
import ContentShell from '../components/ContentShell.vue'
import PostCard from '../components/PostCard.vue'
import DeletePostDialog from '../components/DeletePostDialog.vue'
import ActionButton from '../components/ActionButton.vue'
import AppModal from '../components/AppModal.vue'
const deleting=ref(null),menu=ref(null),route=useRoute(),mine=computed(()=>route.name==='myPosts'),posts=computed(()=>content.posts.filter(p=>mine.value?p.authorId===state.user?.id:p.lit).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)))
function time(value){const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(state.locale,{hour:'2-digit',minute:'2-digit'}).format(date):'—'}
onMounted(()=>loadContent({quiet:true}))
</script>
<template><ContentShell back :ready="content.loaded" :title="t(mine?'p2.myPosts':'p2.myLights')" @back="router.push('/mine')"><div v-if="!content.loaded" class="content-state"><p>{{ t('p2.loading') }}</p><ActionButton v-if="!state.ui.busy" @click="loadContent({quiet:true})">{{ t('retry') }}</ActionButton></div><div v-else-if="!posts.length" class="content-state"><p>{{ t(mine?'p2.noPosts':'p2.noLights') }}</p><ActionButton v-if="mine" class="purple-gradient" @click="router.push({name:'compose',query:{from:'/my-posts'}})">{{ t('p2.shareNow') }}</ActionButton></div><div v-else class="my-post-list"><template v-for="post in posts" :key="post.id"><div v-if="mine" class="my-post-entry"><PostCard :post="post" compact @open="router.push({name:'post',params:{id:post.id},query:{from:route.path}})"><template #actions><button class="post-list-more" :data-post-menu="post.id" :aria-label="t('p2.more')" :disabled="!!state.ui.busy" @click="menu=post.id"><img src="/images/p5/post-more.png" alt=""/></button></template></PostCard></div><button v-else class="light-record" @click="router.push({name:'post',params:{id:post.id},query:{from:route.path}})"><strong>{{ post.demoKey?t('p2.'+post.demoKey):post.body||t('p2.images') }}</strong><time :datetime="post.litAt">{{ time(post.litAt) }}</time></button></template></div></ContentShell><AppModal v-if="menu" :title="t('p2.more')" :anchor="'[data-post-menu=&quot;'+menu+'&quot;]'" @close="menu=null"><button class="post-more-delete" @click="deleting=menu;menu=null"><img src="/images/p5/collection-delete.png" alt=""/>{{ t('p5.deletePost') }}</button></AppModal><DeletePostDialog v-if="deleting" :post-id="deleting" @close="deleting=null" @deleted="deleting=null"/></template>

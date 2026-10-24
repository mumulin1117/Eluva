<script setup>
import { social,loadSocial } from '../social-state.js'
import { onMounted } from 'vue'
onMounted(()=>loadSocial({quiet:true}))
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t } from '../state.js'
defineProps({ lights:{type:Number,default:0} })
const route=useRoute()
function tabImage(item){if(['pink','orange','cyan'].includes(state.theme))return './images/p5/tab-'+state.theme+'-'+item+(route.name===item?'-active':'')+'.svg';return './images/p2/tab-'+item+(route.name===item?(item==='home'?'':'-active'):(item==='home'?'-inactive':''))+'.png'}
</script>
<template><nav class="eluva-tabs" :aria-label="state.locale==='fr'?'Navigation principale':'Main navigation'"><button v-for="item in ['chats','home','mine']" :key="item" :class="{active:route.name===item}" :aria-current="route.name===item?'page':undefined" @click="router.replace({name:item})"><img :src="tabImage(item)" alt="" draggable="false" /><span class="sr-only">{{ t(item) }}</span><span v-if="item==='chats'&&(social.loaded?social.unreadCount:lights)>0" class="tab-badge">{{ social.loaded?social.unreadCount:lights }}</span></button></nav></template>

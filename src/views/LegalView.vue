<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { state,t } from '../state.js'
import { legal } from '../data/legal.js'
import { returnLegal } from '../router.js'
import PageShell from '../components/PageShell.vue'
const route=useRoute(), key=computed(()=>route.name==='guidelines'?'community':route.name),title=computed(()=>t(key.value==='eula'?'eulaTitle':key.value))
</script>
<template><PageShell :title="title" back :source-back="key!=='eula'" @back="returnLegal"><h1>{{ title }}</h1><article v-for="section in legal[state.locale][key]" :key="section[0]" class="legal-section"><h2>{{ section[0] }}</h2><p>{{ section[1] }}</p></article></PageShell></template>

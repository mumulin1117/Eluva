<script setup>
import AuthConversation from '../components/AuthConversation.vue'
import { state } from '../state.js'
</script>
<template><AuthConversation :key="state.authEpoch"/></template>

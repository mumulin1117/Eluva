<script setup>
import { computed,ref } from 'vue'
import { state,t } from '../state.js'
import { personalAction } from '../personal-state.js'
import { content } from '../content-state.js'
import { newId } from '../domain/id.js'
import AppModal from './AppModal.vue'
import ActionButton from './ActionButton.vue'
const props=defineProps({postId:String}),emit=defineEmits(['close','deleted']),commitId=ref(newId())
state.ui.error=null
const post=computed(()=>content.posts.find(x=>x.id===props.postId))
async function remove(){if(await personalAction('deletePost',{id:props.postId,commitId:commitId.value},{notice:'p5.postDeleted'}))emit('deleted')}
</script>
<template><AppModal centered variant="personal-confirm" :title="t('p5.deletePostTitle')" :closable="!state.ui.busy" @close="emit('close')"><p>{{ t('p5.deletePostHint') }}</p><blockquote class="delete-target">{{ post?.body||t('p2.images') }}</blockquote><p v-if="state.ui.error" class="error-banner" role="alert" :data-error-code="state.ui.error">{{ t('errors.'+state.ui.error) }}</p><template #footer><ActionButton secondary :disabled="!!state.ui.busy" @click="emit('close')">{{ t('cancel') }}</ActionButton><ActionButton :busy="state.ui.busy==='personal-deletePost'" :disabled="!!state.ui.busy" @click="remove">{{ t('p5.delete') }}</ActionButton></template></AppModal></template>

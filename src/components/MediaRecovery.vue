<script setup>
import { computed } from 'vue'
import { state, bridge, t, run } from '../state.js'
defineEmits(['choose'])
const permissionBlocked = computed(() => ['PERMISSION_DENIED', 'PERMISSION_RESTRICTED'].includes(state.ui.error))
const visible = computed(() => permissionBlocked.value || state.ui.error === 'DEVICE_UNSUPPORTED')
const canOpenSettings = computed(() => bridge.isNative && permissionBlocked.value)
</script>
<template><div v-if="visible" class="recovery-card media-recovery">
  <p>{{ t(canOpenSettings ? 'mediaPermissionHint' : 'mediaAlternateHint') }}</p>
  <button type="button" class="text-link" :disabled="!!state.ui.busy" @click="$emit('choose')">{{ t('chooseAnotherSource') }}</button>
  <button v-if="canOpenSettings" type="button" class="text-link" :disabled="!!state.ui.busy" @click="run('settings', signal => bridge.call('system','openSettings',{}, { signal }))">{{ t('openSettings') }}</button>
</div></template>

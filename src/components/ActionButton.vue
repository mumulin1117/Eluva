<script setup>
defineProps({ busy: Boolean, disabled: Boolean, secondary: Boolean, quiet: Boolean, type: { type: String, default: 'button' } })
</script>
<template><button :type="type" class="action-button" :class="{ secondary, quiet }" :disabled="disabled || busy" :aria-busy="busy || undefined"><span v-if="busy" class="spinner" aria-hidden="true"/><slot /></button></template>

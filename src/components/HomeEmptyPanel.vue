<script setup>
import { t } from '../state.js'
import ActionButton from './ActionButton.vue'
defineProps({ filtered:Boolean, busy:Boolean, entering:Boolean, feedback:String })
defineEmits(['compose','reset'])
</script>
<template>
  <section class="home-empty-panel" :aria-label="t('p2.emptyTitle')">
    <div class="home-empty-heading">
      <p>{{ t(filtered?'p2.filterEmpty':'p2.emptyHint') }}</p>
    </div>
    <button v-if="filtered" class="home-empty-reset text-link" :disabled="busy" @click="$emit('reset')">{{ t('p2.resetFilters') }}</button>
    <div class="home-empty-publish-wrap">
      <ActionButton class="home-empty-publish dark-gradient" :disabled="busy||entering" @click="$emit('compose')"><img src="/images/home-empty/compose-pencil.png" alt="" draggable="false"/><span>{{ t('p2.shareNow') }}</span></ActionButton>
      <img class="home-empty-star" src="/images/home-empty/empty-star.png" alt="" draggable="false"/>
    </div>
    <p v-if="feedback" class="home-empty-feedback" role="status">{{ t(feedback) }}</p>
  </section>
</template>

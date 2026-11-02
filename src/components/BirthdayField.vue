<script setup>
import { computed, ref, watch } from 'vue'
import { state, t } from '../state.js'
import AppModal from './AppModal.vue'
import ActionButton from './ActionButton.vue'
const props = defineProps({ modelValue: String })
const emit = defineEmits(['update:modelValue'])
const opened = ref(false), year = ref(new Date().getFullYear()-18), month = ref(1), day = ref(1)
const years = Array.from({ length: new Date().getFullYear()-1899 }, (_, i) => new Date().getFullYear()-i)
const days = computed(() => Array.from({ length: new Date(year.value, month.value, 0).getDate() }, (_, i) => i+1))
watch(days, value => { day.value = Math.min(day.value, value.length) })
const label = computed(() => {
  if (!props.modelValue) return state.locale === 'fr' ? 'Choisir une date' : 'Choose a date'
  const [y,m,d] = props.modelValue.split('-').map(Number)
  return new Intl.DateTimeFormat(state.locale, { year:'numeric', month:'long', day:'numeric' }).format(new Date(y,m-1,d))
})
function open() { if (props.modelValue) [year.value,month.value,day.value] = props.modelValue.split('-').map(Number); opened.value = true }
function save() { const value = [year.value, String(month.value).padStart(2,'0'), String(Math.min(day.value,days.value.length)).padStart(2,'0')].join('-'); emit('update:modelValue',value); opened.value = false }
</script>
<template><div class="form-field"><label id="birthday-label">{{ t('birthday') }}</label><button type="button" class="date-button" :disabled="!!state.ui.busy" aria-labelledby="birthday-label birthday-value" @click="open"><span id="birthday-value">{{ label }}</span><span aria-hidden="true">⌄</span></button></div>
  <AppModal v-if="opened" :title="t('birthday')" @close="opened=false"><div class="date-selectors">
    <label>{{ state.locale==='fr'?'Année':'Year' }}<select v-model.number="year" :aria-label="state.locale==='fr'?'Année':'Year'"><option v-for="y in years" :key="y" :value="y">{{ y }}</option></select></label>
    <label>{{ state.locale==='fr'?'Mois':'Month' }}<select v-model.number="month" :aria-label="state.locale==='fr'?'Mois':'Month'"><option v-for="m in 12" :key="m" :value="m">{{ new Intl.DateTimeFormat(state.locale,{month:'short'}).format(new Date(2020,m-1,1)) }}</option></select></label>
    <label>{{ state.locale==='fr'?'Jour':'Day' }}<select v-model.number="day" :aria-label="state.locale==='fr'?'Jour':'Day'"><option v-for="d in days" :key="d" :value="d">{{ d }}</option></select></label>
  </div><template #footer><ActionButton secondary @click="opened=false">{{ t('cancel') }}</ActionButton><ActionButton @click="save">{{ t('done') }}</ActionButton></template></AppModal>
</template>

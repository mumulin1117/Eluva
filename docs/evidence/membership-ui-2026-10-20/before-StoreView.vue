<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t } from '../state.js'
import { commerce,commerceAction } from '../commerce-state.js'
import ContentShell from '../components/ContentShell.vue'
import ActionButton from '../components/ActionButton.vue'
import AppModal from '../components/AppModal.vue'
const route=useRoute(),modal=ref(''),mode=computed(()=>route.name),busy=computed(()=>!!state.ui.busy)
const from=computed(()=>['/mine','/compose','/edit-profile','/collections'].includes(route.query.from)?route.query.from:'/mine')
const rows=['refreshCount','filters','badge','postsPerDay','frames','editPosts','history','collections']
const selected=computed(()=>commerce.products.find(p=>p.id===commerce.selectedId))
function path(name){return {name,query:{from:from.value}}}
function back(){router.push(mode.value==='store'?from.value:path('store'))}
let timer,disposed=false
async function load(){await commerceAction('snapshot');if(!disposed)await commerceAction('products')}
function refresh(){if(!document.hidden&&!disposed)commerceAction('snapshot',true)}
onMounted(()=>{load();timer=setInterval(refresh,5000);document.addEventListener('visibilitychange',refresh)})
onBeforeUnmount(()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh)})
</script>
<template><ContentShell back class="store-shell" :title="t(mode==='storeBenefits'?'p6.benefits':mode==='storeWallet'?'p6.wallet':'p6.title')" :ready="commerce.loaded" @back="back">
  <template v-if="mode==='store'">
    <div class="store-hero" aria-hidden="true"></div><h2 class="store-title">{{ t('p6.title') }} <img src="/images/p6/pro-badge.svg" alt="PRO"/></h2>
    <div class="store-benefit-cards"><div v-for="[icon,label] in [['crown','frames'],['spark','badge'],['people','filters']]" :key="icon" class="store-benefit" :style="{backgroundImage:`url(./images/p6/benefit-${icon}.svg)`}"><span>{{ t('p6.'+label) }}</span></div></div>
    <button class="text-link store-all-benefits" :disabled="busy" @click="router.push(path('storeBenefits'))">{{ t('p6.allBenefits') }} <span aria-hidden="true">→</span></button>
    <section v-if="!commerce.products.length" class="store-availability" role="status"><h3>{{ t(commerce.platform==='browser'?'p6.nativeOnly':commerce.productsLoaded?'p6.unconfigured':'working') }}</h3><p>{{ t(commerce.platform==='browser'?'p6.nativeOnlyHint':'p6.unconfiguredHint') }}</p></section>
    <div v-if="commerce.products.length" class="store-products" role="group" :aria-label="t('p6.selectedProduct')"><button v-for="p in commerce.products" :key="p.id" :disabled="busy" :aria-pressed="commerce.selectedId===p.id" @click="commerce.selectedId=p.id"><span><strong>{{ p.displayName }}</strong><small>{{ p.description }}</small><small v-if="p.periodUnit">{{ t('p6.period') }}: {{ p.periodValue }} {{ t('p6.'+(p.periodUnit==='day'?'dayUnit':p.periodUnit)) }}</small></span><strong class="store-price">{{ p.displayPrice }}<small>{{ p.currency }}</small></strong></button></div>
    <p class="store-price-note">{{ t('p6.storeNotice') }}</p>
    <ActionButton class="store-purchase" :busy="state.ui.busy==='store-purchase'" :disabled="busy||!commerce.canPurchase||!selected" @click="commerceAction('purchase')">{{ selected ? t('p6.continuePurchase')+' · '+selected.displayPrice:t('p6.notConfigured') }}</ActionButton>
    <p v-if="commerce.status" class="store-status" role="status">{{ t('p6.'+commerce.status) }}</p><p v-if="state.ui.error==='TIMEOUT'" class="store-status">{{ t('p6.timeoutHint') }}</p>
    <div class="store-recovery"><ActionButton secondary :busy="state.ui.busy==='store-products'" :disabled="busy" @click="commerceAction('products')">{{ t('p6.retryProducts') }}</ActionButton><button class="text-link" :disabled="busy" @click="commerceAction('restore')">{{ t('p6.restore') }}</button><button class="text-link" :disabled="busy" @click="router.push(path('storeWallet'))">{{ t('p6.wallet') }}</button><button class="text-link" :disabled="busy" @click="modal='recovery'">{{ t('p6.recovery') }}</button><button class="text-link" :disabled="busy" @click="modal='terms'">{{ t('p6.purchaseTerms') }}</button></div>
    <p class="store-note">{{ t('p6.restoreHint') }}</p>
  </template>
  <template v-else-if="mode==='storeBenefits'"><h2 class="store-title benefits-title">{{ t('p6.benefitsTitle') }}</h2><p class="store-note">{{ t('p6.benefitsHint') }}</p><div class="store-table" role="table" :aria-label="t('p6.benefits')"><div class="store-table-row" role="row"><span role="columnheader"></span><strong role="columnheader">{{ t('p6.free') }}</strong><strong role="columnheader">{{ t('p6.pro') }}</strong></div><div v-for="key in rows" :key="key" class="store-table-row" role="row"><span role="rowheader">{{ t('p6.'+key) }}</span><span role="cell">{{ t('p6.notConfigured') }}</span><span role="cell">{{ t('p6.notConfigured') }}</span></div></div></template>
  <template v-else><p v-if="!commerce.loaded">{{ t('working') }}</p><template v-else><section class="store-usage"><h2>{{ t('p6.freeUsage') }}</h2><strong>{{ commerce.wallet?.quota?.used||0 }}<template v-if="commerce.wallet?.quota?.limit!==null"> / {{ commerce.wallet?.quota?.limit }}</template></strong><p>{{ commerce.wallet?.quota?.limit===null?t('p6.unlimited'):commerce.wallet?.quota?.day }}</p><p>{{ t('p6.rewards') }}: {{ commerce.wallet?.quota?.rewards||0 }}</p></section><article v-for="wallet in commerce.wallet?.wallets||[]" :key="wallet.environment" class="store-wallet"><span>{{ t('p6.'+wallet.environment) }}</span><strong>{{ wallet.balance }} {{ t('p6.coins') }}</strong><p v-if="wallet.reviewRequired">{{ t('p6.reviewRequired') }}</p></article><p class="store-note">{{ t('p6.notTransferable') }}</p><p v-if="!commerce.wallet?.ledger?.length" class="store-note">{{ t('p6.emptyLedger') }}</p><ol class="store-ledger"><li v-for="row in commerce.wallet?.ledger||[]" :key="row.id"><div><strong>{{ t(row.kind==='purchase'?'p6.purchase':'p6.published') }}</strong><small>{{ t('p6.'+row.environment) }} · {{ row.bucket==='coins'?t('p6.coins'):t('p6.freeUsage') }}</small><time>{{ new Date(row.createdAt).toLocaleString(state.locale) }}</time></div><span>{{ row.amount }}</span></li></ol></template><ActionButton secondary :disabled="busy" @click="commerceAction('snapshot')">{{ t('retry') }}</ActionButton></template>
</ContentShell><AppModal v-if="modal" :title="t(modal==='terms'?'p6.purchaseTerms':'p6.recoveryTitle')" @close="modal=''"><p>{{ t(modal==='terms'?'p6.termsHint':'p6.recoveryHint') }}</p><p>{{ t('p6.restoreHint') }}</p><template #footer><ActionButton @click="modal=''">{{ t('done') }}</ActionButton></template></AppModal></template>

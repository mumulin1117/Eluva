<script setup>
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { router } from '../router.js'
import { state,t } from '../state.js'
import { commerce,commerceAction,selectSubscriptionProduct } from '../commerce-state.js'
import { useMembership } from '../composables-membership.js'
import { displayedSubscriptionPlans } from '../data/subscription-plans.js'
import { subscriptionDisplay } from '../domain/subscription-display.js'
import ContentShell from '../components/ContentShell.vue'
import ActionButton from '../components/ActionButton.vue'
import AppModal from '../components/AppModal.vue'
import '../membership.css'
const route=useRoute(),modal=ref(''),mode=computed(()=>route.name),busy=computed(()=>!!state.ui.busy)
const from=computed(()=>['/mine','/compose','/edit-profile','/collections'].includes(route.query.from)?route.query.from:'/mine')
const rows=['refreshCount','filters','badge','postsPerDay','frames','editPosts','history','collections']
const availableBenefits=new Set(['filters','badge','frames'])
const {membership,expiry,inactiveKey}=useMembership()
const subscription=computed(()=>subscriptionDisplay(membership.value,commerce.ownerId===state.user?.id?commerce.wallet?.pendingProductId:null))
const currentPlan=computed(()=>!!subscription.value.currentId&&subscription.value.currentId===commerce.selectedId)
const scheduledSelection=computed(()=>!!subscription.value.scheduled&&subscription.value.scheduled.productId===commerce.selectedId)
const pendingSelection=computed(()=>!!subscription.value.approval&&subscription.value.approval.productId===commerce.selectedId)
const scheduledDate=computed(()=>subscription.value.scheduled?.effectiveAt?new Intl.DateTimeFormat(state.locale,{year:'numeric',month:'short',day:'2-digit'}).format(new Date(subscription.value.scheduled.effectiveAt*1000)):'')
const purchaseLabel=computed(()=>pendingSelection.value?'awaitingApproval':scheduledSelection.value?'scheduledPlan':currentPlan.value?'currentPlan':membership.value.active?'changePlan':'continuePro')
const noticeStatus=computed(()=>subscription.value.approval&&['pending','pendingCheck'].includes(commerce.status)?'':commerce.status)
const priceNoticeKey=computed(()=>pendingSelection.value?'approvalPlanDetails':scheduledSelection.value?'scheduledPlanDetails':currentPlan.value?'currentPlanDetails':'subscriptionNotice')
const plans=computed(()=>displayedSubscriptionPlans(state.locale))
const selected=computed(()=>plans.value.find(p=>p.id===commerce.selectedId))
const purchaseError=ref(null)
const scrolled=ref(false)
function scrollChanged(event){if(event.target.classList?.contains('page-content'))scrolled.value=event.target.scrollTop>1}
watch(mode,()=>{scrolled.value=false})
watch(()=>mode.value==='store'?state.ui.error:null,async(code,_previous,onCleanup)=>{
  if(!code)return
  let cancelled=false;onCleanup(()=>{cancelled=true})
  await nextTick()
  // Keep checkout feedback near the attempted action and bring it into view
  // without inserting a second illustration spacer above the membership title.
  if(!cancelled&&purchaseError.value?.isConnected)purchaseError.value.scrollIntoView({block:'nearest',behavior:'instant'})
},{flush:'post'})
function path(name){return {name,query:{from:from.value}}}
function back(){router.push(mode.value==='store'?from.value:path('store'))}
onMounted(()=>commerceAction('snapshot'))
</script>
<template><ContentShell back class="store-shell" :class="{'membership-shell':mode==='store','store-content-scrolled':scrolled}" :title="t(mode==='storeBenefits'?'p6.benefits':mode==='storeWallet'?'p6.wallet':'p6.title')" :show-error="mode!=='store'" :ready="commerce.loaded" @back="back" @scroll.capture="scrollChanged">
  <template v-if="mode==='store'" #header><button class="store-restore" :disabled="busy" :aria-busy="state.ui.busy==='store-restore'" @click="commerceAction('restore')"><span v-if="state.ui.busy==='store-restore'" class="spinner" aria-hidden="true"/>{{ t('p6.restore') }}</button></template>
  <template v-if="mode==='store'">
    <div class="store-hero" aria-hidden="true"></div><h2 class="store-title"><span>{{ t('p6.title') }}</span><img src="/images/p6/pro-badge.svg" alt="PRO"/></h2>
    <div v-if="membership.status!=='none'||subscription.approval" class="store-membership-status" role="status">
      <p v-if="membership.active&&subscription.currentPlan" class="store-current-plan">{{ t('p6.currentPlanUntil',{plan:t('p6.plan_'+subscription.currentPlan),date:expiry}) }}</p>
      <p v-else-if="membership.status!=='none'">{{ t('p6.'+(membership.active?'activeUntil':inactiveKey),{date:expiry}) }}</p>
      <p v-if="subscription.scheduled" class="store-scheduled-change">{{ t('p6.'+(!subscription.scheduled.plan?'scheduledUnknown':scheduledDate?'scheduledStarts':'scheduledDateUnknown'),{plan:subscription.scheduled.plan?t('p6.plan_'+subscription.scheduled.plan):'',date:scheduledDate}) }}</p>
      <p v-if="subscription.approval" class="store-approval-pending">{{ t(subscription.approval.plan?'p6.approvalPendingPlan':'p6.approvalPendingUnknown',{plan:subscription.approval.plan?t('p6.plan_'+subscription.approval.plan):''}) }}</p>
      <small v-if="membership.active&&membership.willAutoRenew===false">{{ t('p6.renewalOff') }}</small><small v-if="membership.status==='gracePeriod'">{{ t('p6.gracePeriod') }}</small>
    </div>
    <div class="store-benefit-cards"><div v-for="[icon,label] in [['crown','frames'],['spark','badge'],['people','filters']]" :key="icon" class="store-benefit" :style="{backgroundImage:`url(./images/p6/benefit-${icon}.svg)`}"><span>{{ t('p6.'+label) }}</span></div></div>
    <button class="text-link store-all-benefits" :disabled="busy" @click="router.push(path('storeBenefits'))">{{ t('p6.allBenefits') }} <span aria-hidden="true">→</span></button>
    <div class="store-products" role="group" :aria-label="t('p6.selectedProduct')"><button v-for="p in plans" :key="p.id" :data-product-id="p.id" :disabled="busy||!commerce.loaded" :aria-pressed="commerce.loaded&&commerce.selectedId===p.id" @click="selectSubscriptionProduct(p.id)"><span><strong>{{ t('p6.plan_'+p.plan) }}</strong><span v-if="subscription.currentId===p.id||subscription.scheduled?.productId===p.id||subscription.approval?.productId===p.id" class="store-plan-tags"><span v-if="subscription.currentId===p.id" class="store-plan-tag current">{{ t('p6.currentPlan') }}</span><span v-if="subscription.scheduled?.productId===p.id" class="store-plan-tag scheduled">{{ t('p6.scheduledPlan') }}</span><span v-if="subscription.approval?.productId===p.id" class="store-plan-tag approval">{{ t('p6.awaitingApproval') }}</span></span><small>{{ t('p6.billing_'+p.plan) }}</small></span><strong class="store-price">{{ p.displayPrice }}<small>{{ p.currency }}</small></strong></button></div>
    <ActionButton class="store-purchase" :busy="state.ui.busy==='store-purchase'" :disabled="busy||!commerce.loaded||!selected||currentPlan||scheduledSelection||pendingSelection" @click="commerceAction('purchase')">{{ t('p6.'+purchaseLabel) }}</ActionButton>
    <p v-if="state.ui.error" ref="purchaseError" class="error-banner store-purchase-error" role="alert" :data-error-code="state.ui.error">{{ t('errors.'+state.ui.error) }}</p>
    <p class="store-price-note">{{ selected?t('p6.'+priceNoticeKey,{price:selected.displayPrice,period:t('p6.billing_'+selected.plan)}):t('p6.storeNotice') }} {{ t('p6.catalogPriceNotice') }} <button class="store-terms-link" :disabled="busy" @click="modal='terms'">{{ t('p6.purchaseTerms') }}</button></p>
    <p v-if="noticeStatus" class="store-status" role="status">{{ t('p6.'+noticeStatus) }}</p><p v-if="state.ui.error==='TIMEOUT'" class="store-status">{{ t('p6.timeoutHint') }}</p>
    <div class="store-recovery"><button v-if="membership.active||membership.status==='billingRetry'" class="text-link" :disabled="busy" @click="commerceAction('manage')">{{ t('p6.manage') }}</button><ActionButton secondary :busy="state.ui.busy==='store-snapshot'" :disabled="busy" @click="commerceAction('snapshot')">{{ t('p6.checkSubscription') }}</ActionButton><button class="text-link store-help-link" :disabled="busy" @click="modal='recovery'">{{ t('p6.recovery') }}</button></div>
    <p class="store-note">{{ t('p6.restoreHint') }}</p>
  </template>
  <template v-else-if="mode==='storeBenefits'"><h2 class="store-title benefits-title">{{ t('p6.benefitsTitle') }}</h2><p class="store-note">{{ t('p6.benefitsHint') }}</p><div class="store-table" role="table" :aria-label="t('p6.benefits')"><div class="store-table-row" role="row"><span role="columnheader"></span><strong role="columnheader">{{ t('p6.free') }}</strong><strong role="columnheader">{{ t('p6.pro') }}</strong></div><div v-for="key in rows" :key="key" class="store-table-row" role="row"><span role="rowheader">{{ t('p6.'+key) }}</span><span role="cell">{{ t('p6.notConfigured') }}</span><span role="cell" :class="{'benefit-available':availableBenefits.has(key)}">{{ t(availableBenefits.has(key)?'p6.available':'p6.notConfigured') }}</span></div></div><p class="store-note store-badge-description">{{ t('p6.badgeDescription') }}</p></template>
  <template v-else><p v-if="!commerce.loaded">{{ t('working') }}</p><template v-else><section class="store-usage"><h2>{{ t('p6.freeUsage') }}</h2><strong>{{ commerce.wallet?.quota?.used||0 }}<template v-if="commerce.wallet?.quota?.limit!==null"> / {{ commerce.wallet?.quota?.limit }}</template></strong><p>{{ commerce.wallet?.quota?.limit===null?t('p6.unlimited'):commerce.wallet?.quota?.day }}</p><p>{{ t('p6.rewards') }}: {{ commerce.wallet?.quota?.rewards||0 }}</p></section><article v-for="wallet in commerce.wallet?.wallets||[]" :key="wallet.environment" class="store-wallet"><span>{{ t('p6.coins') }}</span><strong>{{ wallet.balance }} {{ t('p6.coins') }}</strong><p v-if="wallet.reviewRequired">{{ t('p6.reviewRequired') }}</p></article><p class="store-note">{{ t('p6.notTransferable') }}</p><p v-if="!commerce.wallet?.ledger?.length" class="store-note">{{ t('p6.emptyLedger') }}</p><ol class="store-ledger"><li v-for="row in commerce.wallet?.ledger||[]" :key="row.id"><div><strong>{{ t(row.kind==='subscription'?'p6.subscription':row.kind==='purchase'?'p6.purchase':'p6.published') }}</strong><small>{{ t(row.bucket==='subscription'?'p6.subscription':row.bucket==='coins'?'p6.coins':'p6.freeUsage') }}</small><time>{{ new Date(row.createdAt).toLocaleString(state.locale) }}</time></div><span>{{ row.kind==='subscription'?t('p6.pro'):row.amount }}</span></li></ol></template><ActionButton secondary :disabled="busy" @click="commerceAction('snapshot')">{{ t('retry') }}</ActionButton></template>
</ContentShell><AppModal v-if="modal" centered variant="connection" :title="t(modal==='terms'?'p6.purchaseTerms':'p6.recoveryTitle')" @close="modal=''"><div class="store-notice-copy"><p>{{ t(modal==='terms'?'p6.termsHint':'p6.recoveryHint') }}</p><p>{{ t('p6.restoreHint') }}</p></div><template #footer><ActionButton @click="modal=''">{{ t('done') }}</ActionButton></template></AppModal></template>

import { computed,onMounted,onBeforeUnmount,ref } from 'vue'
import { state } from './state.js'
import { commerce,commerceAction,cancelCommerceRefresh } from './commerce-state.js'
import { currentMembership } from './domain/commerce.js'

// Both pages observe the same saved native snapshot. Date checks never create or
// extend a subscription, and timers/listeners belong to the mounted page.
export function useMembership() {
  const now=ref(Date.now()/1000)
  const membership=computed(()=>currentMembership(commerce.ownerId===state.user?.id?commerce.wallet?.subscription:null,now.value))
  const expiry=computed(()=>membership.value.accessUntil?new Intl.DateTimeFormat(state.locale,{year:'numeric',month:'short',day:'2-digit'}).format(new Date(membership.value.accessUntil*1000)):'')
  const inactiveKey=computed(()=>({revoked:'revokedMembership',billingRetry:'billingRetry',superseded:'subscriptionChanged'}[membership.value.status]||'expiredMembership'))
  let timer
  const refresh=()=>{now.value=Date.now()/1000;if(!document.hidden&&state.user)commerceAction('snapshot',true)}
  onMounted(()=>{timer=setInterval(refresh,5000);document.addEventListener('visibilitychange',refresh)})
  onBeforeUnmount(()=>{cancelCommerceRefresh();clearInterval(timer);document.removeEventListener('visibilitychange',refresh)})
  return {membership,expiry,inactiveKey,refresh}
}

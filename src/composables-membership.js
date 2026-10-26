import { computed,onMounted,onBeforeUnmount,ref,toValue,watch } from 'vue'
import { state } from './state.js'
import { commerce,commerceAction,cancelCommerceRefresh } from './commerce-state.js'
import { currentMembership } from './domain/commerce.js'

// Pages and avatars observe one saved native snapshot and one expiry clock.
// Read-only avatar subscribers never create a refresh loop of their own.
const now=ref(Date.now()/1000)
let subscribers=0,refreshSubscribers=0,timer,lastRefresh=0
function refreshShared(){
  now.value=Date.now()/1000
  if(refreshSubscribers&&!document.hidden&&state.user){lastRefresh=Date.now();return commerceAction('snapshot',true)}
  return Promise.resolve(false)
}
function tick(){now.value=Date.now()/1000;if(refreshSubscribers&&Date.now()-lastRefresh>=5000)refreshShared()}
export function useMembership({refreshSnapshot=true,readSnapshotIfMissing=false}={}) {
  const membership=computed(()=>currentMembership(commerce.ownerId===state.user?.id?commerce.wallet?.subscription:null,now.value))
  const expiry=computed(()=>membership.value.accessUntil?new Intl.DateTimeFormat(state.locale,{year:'numeric',month:'short',day:'2-digit'}).format(new Date(membership.value.accessUntil*1000)):'')
  const inactiveKey=computed(()=>({revoked:'revokedMembership',billingRetry:'billingRetry',superseded:'subscriptionChanged'}[membership.value.status]||'expiredMembership'))
  const refresh=()=>{now.value=Date.now()/1000;return refreshSnapshot?refreshShared():Promise.resolve(false)}
  let stopMissingRead
  onMounted(()=>{
    subscribers++;if(refreshSnapshot)refreshSubscribers++
    if(subscribers===1){timer=setInterval(tick,1000);document.addEventListener('visibilitychange',refreshShared)}
    if(refreshSnapshot)refreshShared();else now.value=Date.now()/1000
    stopMissingRead=watch(()=>[state.user?.id,commerce.ownerId,commerce.loaded,!!toValue(readSnapshotIfMissing),state.ui.busy],([owner,snapshotOwner,loaded,needed,busy])=>{
      // Deep-linked own avatars need one verified read too. The commerce layer
      // coalesces concurrent readers and discards late results after switching owners.
      if(owner&&needed&&(!loaded||snapshotOwner!==owner)&&!busy)commerceAction('snapshot',true)
    },{immediate:true})
  })
  onBeforeUnmount(()=>{
    stopMissingRead?.()
    subscribers--;if(refreshSnapshot)refreshSubscribers--
    if(!subscribers){cancelCommerceRefresh();clearInterval(timer);timer=null;document.removeEventListener('visibilitychange',refreshShared)}
  })
  return {membership,expiry,inactiveKey,refresh}
}

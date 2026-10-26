import { reactive, watch } from 'vue'
import { state, bridge, run } from './state.js'
let backgroundRead=null,backgroundPromise=null
import { content } from './content-state.js'
import { subscriptionPlans } from './data/subscription-plans.js'
import { subscriptionDisplay } from './domain/subscription-display.js'
import { invariant } from './domain/errors.js'

export const commerce = reactive({ ownerId:null, loaded:false, productsLoaded:false, products:[], selectedId:subscriptionPlans[0].id, selectionTouched:false, configured:false, canPurchase:false, reason:'', platform:'', missingProductCount:0, wallet:null, status:'' })
export function cancelCommerceRefresh(){backgroundRead?.abort();backgroundRead=null;backgroundPromise=null}
export function resetCommerce(){cancelCommerceRefresh();Object.assign(commerce,{ownerId:null,loaded:false,productsLoaded:false,products:[],selectedId:subscriptionPlans[0].id,selectionTouched:false,configured:false,canPurchase:false,reason:'',platform:'',missingProductCount:0,wallet:null,status:''})}
watch(()=>state.user?.id,resetCommerce)
export function selectSubscriptionProduct(id){if(subscriptionPlans.some(plan=>plan.id===id)){commerce.selectedId=id;commerce.selectionTouched=true}}
export function applyCommerce(snapshot){
  if(!snapshot || snapshot.ownerId!==state.user?.id)return
  const previous=subscriptionDisplay(commerce.wallet?.subscription,commerce.wallet?.pendingProductId)
  const incoming=subscriptionDisplay(snapshot.subscription,snapshot.pendingProductId)
  const crossOwner=!!commerce.ownerId&&commerce.ownerId!==snapshot.ownerId
  if(crossOwner||(!commerce.loaded&&!commerce.selectionTouched)||(commerce.loaded&&incoming.currentId&&incoming.currentId!==previous.currentId)){
    commerce.selectedId=incoming.currentId||subscriptionPlans[0].id;commerce.selectionTouched=false
  }
  commerce.ownerId=snapshot.ownerId;commerce.wallet=snapshot;commerce.loaded=true
  if(snapshot.pendingProductId&&!commerce.status)commerce.status='pendingCheck'
  if(!snapshot.pendingProductId&&snapshot.subscription?.active&&['pending','pendingCheck'].includes(commerce.status))commerce.status='success'
  if(content.ownerId===snapshot.ownerId && snapshot.quota)Object.assign(content.quota,snapshot.quota)
}
async function refreshSnapshot(){
  if(backgroundRead)return backgroundPromise
  if(state.ui.busy||!state.user)return false
  const owner=state.user.id,controller=new AbortController();backgroundRead=controller
  backgroundPromise=(async()=>{
    try{const result=await bridge.call('commerce','snapshot',{}, {signal:controller.signal});if(!controller.signal.aborted&&state.user?.id===owner){applyCommerce(result.snapshot||result);return true}return false}
    catch{return false} // Keep the last verified snapshot; explicit Restore reports failures.
    finally{if(backgroundRead===controller){backgroundRead=null;backgroundPromise=null}}
  })()
  return backgroundPromise
}
export async function commerceAction(method,quiet=false){
  if(quiet&&method==='snapshot')return refreshSnapshot()
  if(quiet && state.ui.busy)return false
  return run('store-'+method,async signal=>{
    if(method==='purchase'||method==='restore')commerce.status=''
    if(['purchase','restore','manage'].includes(method))cancelCommerceRefresh()
    const owner=state.user?.id,selectedId=commerce.selectedId
    let params={}
    if(method==='purchase'){
      commerce.selectionTouched=true
      invariant(subscriptionPlans.some(plan=>plan.id===selectedId),'STORE_NOT_CONFIGURED')
      const quote=await bridge.call('commerce','products',{}, {signal,timeout:20000})
      invariant(!signal.aborted&&owner===state.user?.id,'CANCELLED')
      applyProducts(quote);applyCommerce(quote.snapshot||quote)
      invariant(quote.configured,quote.reason||'STORE_NOT_CONFIGURED')
      invariant(quote.canPurchase,quote.reason||'STORE_PRODUCTS_UNAVAILABLE')
      const product=quote.products?.find(p=>p.id===selectedId)
      invariant(product&&typeof product.displayPrice==='string'&&product.displayPrice&&typeof product.currency==='string'&&product.currency,'STORE_PRODUCTS_UNAVAILABLE')
      params={productId:product.id,displayPrice:product.displayPrice,currency:product.currency}
    }
    const result=await bridge.call('commerce',method,params,{signal,timeout:['purchase','restore','manage'].includes(method)?120000:20000})
    if(signal.aborted || owner!==state.user?.id)return
    if(method==='products')applyProducts(result)
    applyCommerce(result.snapshot||result)
    if(result.status)commerce.status=result.status
    if(!commerce.wallet?.pendingProductId&&commerce.wallet?.subscription?.active&&['pending','pendingCheck'].includes(commerce.status))commerce.status='success'
  },{critical:['purchase','restore','manage'].includes(method),preserveError:quiet})
}
function applyProducts(result){
  commerce.products=result.products||[];commerce.configured=!!result.configured;commerce.canPurchase=!!result.canPurchase;commerce.reason=result.reason||'';commerce.platform=result.platform;commerce.productsLoaded=true;commerce.missingProductCount=result.missingProductCount||0
}

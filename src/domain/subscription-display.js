import { commercePolicy,currentMembership } from './commerce.js'

// Presentation only. Never infer a paid term or grant access from a selection,
// a pending purchase, or the next renewal preference.
export function subscriptionDisplay(saved,pendingProductId,now=Date.now()/1000) {
  const membership=currentMembership(saved,now),catalog=commercePolicy.products
  const known=id=>catalog.find(product=>product.id===id)
  const current=membership.active?(known(membership.productId)||catalog.find(product=>product.plan===membership.plan)):null
  const hasNext=membership.active&&membership.willAutoRenew===true&&typeof membership.nextProductId==='string'&&!!membership.nextProductId&&membership.nextProductId!==membership.productId
  const next=hasNext?known(membership.nextProductId):null,expiry=Number(membership.expiresAt)
  const approval=typeof pendingProductId==='string'&&pendingProductId?{productId:pendingProductId,plan:known(pendingProductId)?.plan||''}:null
  return {
    currentId:current?.id||'',currentPlan:current?.plan||'',
    scheduled:hasNext?{productId:membership.nextProductId,plan:next?.plan||'',effectiveAt:Number.isFinite(expiry)&&expiry>now?expiry:null}:null,
    approval,
  }
}

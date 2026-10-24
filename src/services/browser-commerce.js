import { invariant } from '../domain/errors.js'
import { commerceSnapshot, commercePolicy } from '../domain/commerce.js'

export async function browserCommerce(repo, method, params, signal) {
  invariant(!signal?.aborted, 'CANCELLED')
  const root=await repo.read(), owner=root.session?.userId
  invariant(owner && root.accounts[owner], 'AUTH_REQUIRED')
  if (method === 'snapshot') return { ...commerceSnapshot(root,owner), platform:'browser', canPurchase:false, products:[], reason:'STORE_NATIVE_ONLY' }
  if (method === 'products') return { platform:'browser', configured:commercePolicy.confirmed, canPurchase:false, products:[], reason:'STORE_NATIVE_ONLY' }
  if (method === 'purchase' || method === 'restore') invariant(false,'STORE_NATIVE_ONLY')
  invariant(false,'METHOD_NOT_FOUND')
}

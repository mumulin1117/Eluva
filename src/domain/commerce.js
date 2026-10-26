import { invariant } from './errors.js'

// Product IDs corrected on 2026-10-24: one auto-renewing Pro group. Payment quotes come from StoreKit.
// The separately approved USD display catalog does not grant entitlements.
// Posting quotas, coins and other commercial limits remain unchanged/unconfigured.
export const commercePolicy = Object.freeze({ version: 1, confirmed: true, products: [
  { id: 'eluva_monthly_promembe', type: 'autoRenewable', entitlement: 'pro', coins: 0, plan: 'monthly', periodUnit: 'month', periodValue: 1 },
  { id: 'eluva_quarterly_promembe', type: 'autoRenewable', entitlement: 'pro', coins: 0, plan: 'quarterly', periodUnit: 'month', periodValue: 3 },
  { id: 'eluva_annualy_promembe', type: 'autoRenewable', entitlement: 'pro', coins: 0, plan: 'annual', periodUnit: 'year', periodValue: 1 }
], publicPostFree: null, publicPostCoinCost: null, resetTimeZone: null, spendEnvironment: null })
export const storeEnvironments = ['production', 'sandbox', 'xcode']
export function commerceState(root) {
  if(root.commerce === undefined) root.commerce = { version: 1, accounts: {}, transactions: {} }
  const c = root.commerce
  invariant(c.version === 1 && c.accounts && typeof c.accounts === 'object' && !Array.isArray(c.accounts) && c.transactions && typeof c.transactions === 'object' && !Array.isArray(c.transactions), 'STORAGE_CORRUPT')
  return c
}
export function commerceAccount(root, owner) {
  invariant(root.accounts[owner], 'AUTH_REQUIRED')
  const c = commerceState(root)
  c.accounts[owner] ??= { usage: {}, rewards: {}, wallets: {}, ledger: {} }
  const a = c.accounts[owner]
  invariant(['usage','rewards','wallets','ledger'].every(k => a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])), 'STORAGE_CORRUPT')
  for(const w of Object.values(a.wallets)) invariant(w && Number.isSafeInteger(w.balance) && w.balance >= 0, 'STORAGE_CORRUPT')
  for(const row of Object.values(a.ledger)) invariant(row && typeof row.createdAt === 'string' && Number.isSafeInteger(row.amount), 'STORAGE_CORRUPT')
  return a
}
export function quotaDay(date = new Date(), policy = commercePolicy) {
  if (!policy.confirmed || !policy.resetTimeZone) return date.toISOString().slice(0,10)
  return new Intl.DateTimeFormat('en-CA', { timeZone: policy.resetTimeZone, year:'numeric', month:'2-digit', day:'2-digit' }).format(date)
}
export function consumePublicPost(root, owner, { commitId, postId, private: hidden, date = new Date(), limit = null, policy = commercePolicy }) {
  if (hidden) return
  const a = commerceAccount(root, owner), id = 'post:' + commitId
  if (a.ledger[id]) { invariant(a.ledger[id].targetId === postId, 'COMMIT_CONFLICT'); return }
  const day = quotaDay(date, policy), key = 'publicPost:' + day
  const legacy = root.content?.quota?.[owner + ':' + day] || 0
  const used = a.usage[key] ?? legacy
  invariant(Number.isSafeInteger(used) && used >= 0, 'STORAGE_CORRUPT')
  const cap = policy.confirmed && policy.publicPostFree !== null ? policy.publicPostFree : limit
  let bucket = cap === null ? 'unlimited' : 'free', amount = 1, environment = 'localPreview'
  if (cap !== null && used >= cap) {
    if ((a.rewards.publicPost || 0) > 0) { bucket = 'reward'; a.rewards.publicPost-- }
    else if (policy.confirmed && Number.isSafeInteger(policy.publicPostCoinCost) && policy.publicPostCoinCost > 0 && storeEnvironments.includes(policy.spendEnvironment)) {
      environment = policy.spendEnvironment; const wallet = a.wallets[environment]
      invariant(wallet && !wallet.reviewRequired && wallet.balance >= policy.publicPostCoinCost, 'INSUFFICIENT_BALANCE')
      bucket = 'coins'; amount = policy.publicPostCoinCost; wallet.balance -= amount
    } else invariant(false, 'QUOTA_EXHAUSTED')
  }
  if (bucket === 'free' || bucket === 'unlimited') a.usage[key] = used + 1
  a.ledger[id] = { id, kind:'publicPost', targetId:postId, day, bucket, amount:bucket === 'coins' ? -amount : amount, environment, createdAt:date.toISOString() }
}
export function commerceSnapshot(root, owner, policy = commercePolicy) {
  const a = commerceAccount(root, owner), day = quotaDay(new Date(),policy)
  return { ownerId:owner, configured:policy.confirmed && policy.products.length > 0, policyConfirmed:policy.confirmed,
    quota:{ day, timeZone:policy.resetTimeZone, used:a.usage['publicPost:'+day] ?? root.content?.quota?.[owner+':'+day] ?? 0, limit:policy.confirmed ? policy.publicPostFree : null, rewards:a.rewards.publicPost || 0 },
    wallets:storeEnvironments.map(environment => ({ environment, balance:a.wallets[environment]?.balance || 0, reviewRequired:!!a.wallets[environment]?.reviewRequired })),
    subscription:subscriptionSummary(root.commerce.transactions,owner), pendingProductId:a.pendingProductId||null, ledger:Object.values(a.ledger).sort((x,y)=>y.createdAt.localeCompare(x.createdAt)) }
}
export function removeCommerceAccount(root, owner) {
  if (!root.commerce) return
  const c = commerceState(root); delete c.accounts[owner]
  // Keep only non-personal deduplication tombstones. A replay must never mint coins
  // into a different local account after account deletion.
  for (const [id,t] of Object.entries(c.transactions)) if (t.ownerId === owner) c.transactions[id] = { deleted:true }
}

// Only native verified receipts can populate production transactions. This pure
// projection also supports isolated tests and keeps expiry independent of locale.
export function subscriptionSummary(transactions, owner, now = Date.now() / 1000) {
  const rows = Object.entries(transactions || {}).filter(([,t]) => !t.deleted && t.ownerId === owner && t.entitlement === 'pro')
    .map(([id,t]) => {
      const expiry = Number(t.expiresAt), grace = t.renewalState === 'gracePeriod' ? Number(t.graceUntil) : 0
      const until = Math.max(Number.isFinite(expiry) ? expiry : 0, Number.isFinite(grace) ? grace : 0)
      const status = t.revokedAt || t.renewalState === 'revoked' ? 'revoked' : t.upgraded ? 'superseded' : ['expired','billingRetry'].includes(t.renewalState) ? t.renewalState : until > now ? (grace > now ? 'gracePeriod' : 'active') : t.renewalState === 'billingRetry' ? 'billingRetry' : 'expired'
      return { transactionId:id, originalTransactionId:t.originalId || id, productId:t.productId, plan:t.plan || '', environment:t.environment, purchasedAt:t.purchasedAt, expiresAt:expiry || null, accessUntil:until || null, willAutoRenew:typeof t.willAutoRenew === 'boolean' ? t.willAutoRenew : null, nextProductId:t.nextProductId || null, status, active:['active','gracePeriod'].includes(status) }
    }).sort((a,b) => Number(b.active)-Number(a.active) || (b.accessUntil || 0)-(a.accessUntil || 0) || String(b.purchasedAt).localeCompare(String(a.purchasedAt)))
  return rows[0] || { status:'none', active:false }
}
export function currentMembership(saved, now = Date.now() / 1000) {
  if (!saved) return { status:'none',active:false }
  if (saved.active && !(Number(saved.accessUntil) > now)) return { ...saved, active:false,status:saved.status === 'gracePeriod' ? 'billingRetry' : 'expired' }
  return saved
}

// Read the account-owned receipt projection; UI flags and product display data
// never grant Pro features. This also leaves accounts without commerce data alone.
export function proMembership(root, owner, now = Date.now() / 1000) {
  return root.accounts?.[owner] ? subscriptionSummary(root.commerce?.transactions, owner, now) : { status:'none', active:false }
}
export const hasProAccess = (root, owner, now = Date.now() / 1000) => proMembership(root, owner, now).active

import { commercePolicy } from '../domain/commerce.js'

// Approved display catalog. These USD amounts are never sent as Apple quotes
// and cannot activate Pro; StoreKit confirms the actual storefront price.
const amounts = { monthly: 4.99, quarterly: 12.99, annual: 39.99 }
export const subscriptionPlans = Object.freeze(commercePolicy.products.map(({ id, plan }) =>
  Object.freeze({ id, plan, amount: amounts[plan], currency: 'USD' })
))
export function displayedSubscriptionPlans(locale = 'en') {
  return subscriptionPlans.map(plan => ({ ...plan, displayPrice: new Intl.NumberFormat(locale, { style: 'currency', currency: plan.currency }).format(plan.amount) }))
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { subscriptionSummary,currentMembership,commercePolicy } from '../src/domain/commerce.js'
import { subscriptionPlans,displayedSubscriptionPlans } from '../src/data/subscription-plans.js'
const now=1800000000
const transaction=(extra={})=>({ownerId:'a',entitlement:'pro',productId:'eluva_monthly_promember',plan:'monthly',environment:'sandbox',originalId:'original',purchasedAt:'2027-01-01T00:00:00Z',expiresAt:now+100,willAutoRenew:true,...extra})
test('approved Pro product policy preserves IDs and periods separately from the fixed USD display catalog',()=>{
 assert.deepEqual(commercePolicy.products.map(x=>[x.id,x.periodUnit,x.periodValue]),[['eluva_monthly_promember','month',1],['eluva_quarterly_promember','month',3],['eluva_annualy_promember','year',1]])
 assert.ok(commercePolicy.products.every(x=>x.type==='autoRenewable'&&x.entitlement==='pro'&&!('price'in x)))
 assert.equal(commercePolicy.publicPostFree,null)
 assert.deepEqual(subscriptionPlans.map(p=>[p.id,p.amount,p.currency]),commercePolicy.products.map((p,i)=>[p.id,[4.99,12.99,39.99][i],'USD']))
 assert.deepEqual(displayedSubscriptionPlans('en').map(p=>p.displayPrice),['$4.99','$12.99','$39.99'])
 assert.ok(displayedSubscriptionPlans('fr').every(p=>p.displayPrice.includes('$US')))
})
test('subscription expiry and disabled renewal retain only the paid access period',()=>{
 const saved=subscriptionSummary({one:transaction({willAutoRenew:false})},'a',now)
 assert.equal(saved.active,true);assert.equal(saved.willAutoRenew,false)
 assert.equal(currentMembership(saved,now+100).active,false)
 assert.equal(subscriptionSummary({one:transaction()},'a',now+100).status,'expired')
})
test('verified renewal replaces the displayed plan; owners, tombstones and refunds cannot leak access',()=>{
 const rows={old:transaction({upgraded:true}),renewal:transaction({productId:'eluva_quarterly_promember',plan:'quarterly',expiresAt:now+1000}),foreign:transaction({ownerId:'b',expiresAt:now+9999}),deleted:{deleted:true}}
 assert.equal(subscriptionSummary(rows,'a',now).plan,'quarterly');assert.equal(subscriptionSummary(rows,'c',now).status,'none')
 rows.renewal.revokedAt='2027-01-02';assert.equal(subscriptionSummary(rows,'a',now).active,false)
})
test('billing grace uses Apple grace date; billing retry without grace does not grant Pro',()=>{
 const rows={one:transaction({expiresAt:now-1,renewalState:'gracePeriod',graceUntil:now+20})}
 const saved=subscriptionSummary(rows,'a',now);assert.equal(saved.status,'gracePeriod');assert.equal(saved.active,true);assert.equal(currentMembership(saved,now+20).status,'billingRetry')
 rows.one.renewalState='billingRetry';assert.equal(subscriptionSummary(rows,'a',now).active,false)
 rows.one.renewalState='expired';rows.one.expiresAt=now+500;assert.equal(subscriptionSummary(rows,'a',now).active,false);rows.one.renewalState='revoked';assert.equal(subscriptionSummary(rows,'a',now).active,false)
})

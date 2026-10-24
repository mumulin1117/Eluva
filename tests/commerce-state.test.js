import test,{beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {nextTick} from 'vue'
globalThis.window={}
const {state,bridge}=await import('../src/state.js')
const {commerce,commerceAction,applyCommerce,resetCommerce}=await import('../src/commerce-state.js')
const saved=(extra={})=>({ownerId:'a',subscription:{status:'active',active:true,productId:'eluva_monthly_promember',accessUntil:Date.now()/1000+3600},...extra})
beforeEach(async()=>{state.user={id:'a'};state.ui.busy='';state.ui.error=null;await nextTick();resetCommerce()})
test('background subscription reads neither block controls nor erase errors; duplicate reads coalesce',async()=>{
 let release,calls=0;bridge.adapter={execute:async()=>{calls++;return new Promise(resolve=>release=resolve)}}
 state.ui.error='PREVIOUS_ERROR';const pending=commerceAction('snapshot',true);await Promise.resolve();await Promise.resolve()
 assert.equal(state.ui.busy,'');assert.equal(state.ui.error,'PREVIOUS_ERROR');assert.equal(await commerceAction('snapshot',true),false)
 release(saved());assert.equal(await pending,true);assert.equal(calls,1);assert.equal(commerce.wallet.subscription.active,true)
})
test('account changes discard a background receipt snapshot and preserve account isolation',async()=>{
 let release;bridge.adapter={execute:async()=>new Promise(resolve=>release=resolve)}
 const pending=commerceAction('snapshot',true);await Promise.resolve();await Promise.resolve();state.user={id:'b'};await nextTick();release(saved())
 assert.equal(await pending,false);assert.equal(commerce.wallet,null);assert.equal(commerce.ownerId,null)
})
test('pending plan changes keep the old paid plan and only actual approval clears pending feedback',()=>{
 commerce.status='pending';applyCommerce(saved({pendingProductId:'eluva_quarterly_promember'}));assert.equal(commerce.status,'pending');assert.equal(commerce.wallet.subscription.productId,'eluva_monthly_promember')
 applyCommerce(saved({subscription:{status:'active',active:true,productId:'eluva_quarterly_promember',accessUntil:Date.now()/1000+7200}}));assert.equal(commerce.status,'success')
})
test('purchase reads an Apple quote only on confirmation; failure and rapid retry preserve the selection and paid state',async()=>{
 applyCommerce(saved());commerce.products=[{id:'eluva_quarterly_promember',displayPrice:'12,99 €',currency:'EUR'}];commerce.selectedId=commerce.products[0].id
 let calls=0,reads=0,fail=true;bridge.adapter={execute:async(service,method,p)=>{
  assert.equal(state.ui.busy,'store-purchase')
  if(method==='products'){reads++;return {configured:true,canPurchase:true,products:[{id:commerce.selectedId,displayPrice:'12,99 €',currency:'EUR'}]}}
  assert.equal(method,'purchase');calls++;assert.equal(p.displayPrice,'12,99 €');assert.equal(p.currency,'EUR');if(fail)throw {code:'STORE_FAILED'};return {status:'success',snapshot:saved()}
 }}
 assert.equal(await commerceAction('purchase'),false);assert.equal(commerce.wallet.subscription.active,true);assert.equal(commerce.selectedId,'eluva_quarterly_promember');fail=false
 const result=await Promise.all([commerceAction('purchase'),commerceAction('purchase')]);assert.deepEqual(result,[true,false]);assert.equal(calls,2);assert.equal(reads,2)
})
test('missing selected product and restricted purchases never switch plans or call payment',async()=>{
 commerce.selectedId='eluva_annualy_promember'
 for(const quote of [
  {configured:true,canPurchase:true,products:[{id:'eluva_monthly_promember',displayPrice:'$4.99',currency:'USD'}]},
  {configured:true,canPurchase:false,reason:'STORE_RESTRICTED',products:[]},
  {configured:true,canPurchase:false,reason:'STORE_NATIVE_ONLY',products:[]}
 ]){
  const calls=[];bridge.adapter={execute:async(s,m)=>{calls.push(m);return quote}}
  assert.equal(await commerceAction('purchase'),false);assert.deepEqual(calls,['products']);assert.equal(commerce.selectedId,'eluva_annualy_promember')
 }
})
test('the quote read and Apple purchase share one lock; restore cannot interleave',async()=>{
 let release;const calls=[]
 bridge.adapter={execute:async(s,m,p)=>{calls.push(m);if(m==='products')return new Promise(resolve=>release=resolve);assert.deepEqual(p,{productId:'eluva_monthly_promember',displayPrice:'5,99 €',currency:'EUR'});return {status:'cancelled',snapshot:saved()}}}
 const pending=commerceAction('purchase');await Promise.resolve();await Promise.resolve()
 assert.equal(state.ui.busy,'store-purchase');assert.equal(await commerceAction('restore'),false);assert.equal(await commerceAction('purchase'),false)
 release({configured:true,canPurchase:true,products:[{id:'eluva_monthly_promember',displayPrice:'5,99 €',currency:'EUR'}]})
 assert.equal(await pending,true);assert.deepEqual(calls,['products','purchase']);assert.equal(commerce.status,'cancelled')
})
test('account change during quote lookup discards the quote and never opens payment',async()=>{
 let release;const calls=[];bridge.adapter={execute:async(s,m)=>{calls.push(m);return new Promise(resolve=>release=resolve)}}
 const pending=commerceAction('purchase');await Promise.resolve();await Promise.resolve();state.user={id:'b'};await nextTick()
 release({configured:true,canPurchase:true,products:[{id:'eluva_monthly_promember',displayPrice:'$4.99',currency:'USD'}]})
 assert.equal(await pending,false);assert.deepEqual(calls,['products']);assert.equal(commerce.wallet,null);assert.equal(commerce.products.length,0)
})
test('unknown catalog IDs are rejected before looking up products',async()=>{
 commerce.selectedId='forged';let calls=0;bridge.adapter={execute:async()=>{calls++}}
 assert.equal(await commerceAction('purchase'),false);assert.equal(calls,0)
})
test('restore cancels an older background snapshot and rejected duplicates keep status',async()=>{
 let release;bridge.adapter={execute:async(s,m)=>m==='snapshot'?new Promise(resolve=>release=resolve):{status:'restored',snapshot:saved({subscription:{active:true,status:'active',productId:'eluva_annualy_promember',accessUntil:Date.now()/1000+10000}})}}
 const old=commerceAction('snapshot',true);await Promise.resolve();await Promise.resolve()
 assert.equal(await commerceAction('restore'),true)
 release(saved({subscription:{active:false,status:'expired',productId:'eluva_monthly_promember'}}));await old
 assert.equal(commerce.wallet.subscription.productId,'eluva_annualy_promember');assert.equal(commerce.wallet.subscription.active,true)
 let unlock;bridge.adapter={execute:async()=>new Promise(resolve=>unlock=resolve)}
 const pending=commerceAction('snapshot');await Promise.resolve();await Promise.resolve();commerce.status='pendingCheck'
 assert.equal(await commerceAction('restore'),false);assert.equal(commerce.status,'pendingCheck')
 unlock(saved());await pending
})

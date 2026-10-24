import test from 'node:test'
import assert from 'node:assert/strict'
import { NativeBridge } from '../src/services/bridge.js'
test('Bridge cancellation ignores late results and cleans up pending calls',async()=>{
  let complete
  const adapter={execute:()=>new Promise(resolve=>{complete=resolve})}
  const bridge=new NativeBridge({adapter,host:{},timeout:1000})
  const controller=new AbortController()
  const call=bridge.call('auth','login',{}, {signal:controller.signal})
  await Promise.resolve();controller.abort();await assert.rejects(call,{code:'CANCELLED'})
  complete({user:'late'});await Promise.resolve();assert.equal(bridge.pending.size,0)
})
test('Bridge timeout and structured native errors settle exactly once',async()=>{
  let message
  const host={webkit:{messageHandlers:{eluva:{postMessage:m=>{message=m}}}}}
  const bridge=new NativeBridge({host,timeout:20})
  const p=bridge.call('auth','login',{})
  bridge.receive({requestId:message.requestId,ok:false,error:{code:'ACCOUNT_NOT_FOUND'}})
  await assert.rejects(p,{code:'ACCOUNT_NOT_FOUND'})
  const timed=bridge.call('auth','login',{})
  await assert.rejects(timed,{code:'TIMEOUT'});assert.equal(bridge.pending.size,0)
})
test('timeout and disposal abort adapter work instead of leaving a late write alive',async()=>{
  let observed
  const adapter={execute:(_,__,___,{signal})=>{observed=signal;return new Promise(()=>{})}}
  const bridge=new NativeBridge({adapter,host:{},timeout:15})
  await assert.rejects(bridge.call('auth','completeRegistration',{}),{code:'TIMEOUT'})
  assert.equal(observed.aborted,true)
  const next=bridge.call('auth','login',{});await Promise.resolve();bridge.dispose()
  await assert.rejects(next,{code:'CANCELLED'});assert.equal(observed.aborted,true)
})

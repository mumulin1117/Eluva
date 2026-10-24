import test from 'node:test'
import assert from 'node:assert/strict'
import { indexedDB } from 'fake-indexeddb'
import { BrowserRepository } from '../src/services/browser-repository.js'
import { LEGAL_VERSION, TEST_USER_ID } from '../src/domain/validation.js'
import { AppError } from '../src/domain/errors.js'
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII='
const create = () => new BrowserRepository({ dbName: 'test-' + crypto.randomUUID(), indexedDB })
const call = (repo, key, params) => { const [s,m] = key.split('.'); return repo.execute(s,m,params) }
const consent = repo => call(repo,'preferences.consent',{ accepted:true,version:LEGAL_VERSION })
test('failed draft cleanup preserves the verification context for a retry',async t=>{
  const repo=create();t.after(()=>repo.close());await consent(repo)
  const flow=await call(repo,'auth.beginRegistration',{email:'cancel@example.com',password:'password1'})
  await call(repo,'auth.verify',{flowId:flow.flowId,purpose:'signup',code:'567567'})
  repo.beforeWrite=()=>{throw new AppError('STORAGE_FAILED')}
  await assert.rejects(call(repo,'auth.cancelRegistration',{flowId:flow.flowId}),{code:'STORAGE_FAILED'})
  repo.beforeWrite=()=>{}
  assert.equal((await call(repo,'auth.resend',{flowId:flow.flowId,purpose:'signup'})).simulation,true)
  await call(repo,'auth.cancelRegistration',{flowId:flow.flowId})
  await assert.rejects(call(repo,'auth.resend',{flowId:flow.flowId,purpose:'signup'}),{code:'FLOW_EXPIRED'})
})
async function draft(repo,email='new@example.com') {
  await consent(repo)
  const f = await call(repo,'auth.beginRegistration',{email,password:'password1'})
  await call(repo,'auth.startVerification',{flowId:f.flowId,email})
  await call(repo,'auth.verify',{flowId:f.flowId,purpose:'signup',code:'567567'})
  const photos = []
  for (let i=0;i<2;i++) photos.push(await call(repo,'media.import',{flowId:f.flowId,base64:png,mime:'image/png'}))
  return {flowId:f.flowId,commitId:crypto.randomUUID(),communityAccepted:true,profile:{displayName:'Élodie',birthday:'2000-10-17',gender:'private',university:'',year:'',major:'',about:'',photos,interestIds:['music','books','art'],goalIds:[],icebreakerIds:['small-joy','learn','book']}}
}
test('fixed account stable; unknown/wrong credentials do not create users',async t=>{
  const repo=create();t.after(()=>repo.close());await consent(repo)
  await assert.rejects(call(repo,'auth.login',{email:'missing@example.com',password:'password1'}),{code:'ACCOUNT_NOT_FOUND'})
  await assert.rejects(call(repo,'auth.login',{email:'eluva@gmail.com',password:'wrong'}),{code:'WRONG_PASSWORD'})
  assert.equal(Object.keys((await repo.read()).accounts).length,1)
  const r=await call(repo,'auth.login',{email:' ELUVA@GMAIL.COM ',password:'123qweasd'})
  assert.equal(r.user.id,TEST_USER_ID);assert.equal(r.fixtures.threads.length,2)
  assert.ok(r.fixtures.threads.every(x=>x.messages.length>0&&x.messages.every(m=>m.kind==='text')))
  await assert.rejects(call(repo,'auth.beginRegistration',{email:'eluva@gmail.com',password:'password1'}),{code:'ACCOUNT_EXISTS'})
})
test('draft is not an account; code context invalidates on email change and does not cross purpose',async t=>{
  const repo=create();t.after(()=>repo.close());await consent(repo)
  const f=await call(repo,'auth.beginRegistration',{email:'draft@example.com',password:'password1'})
  await assert.rejects(call(repo,'auth.login',{email:'draft@example.com',password:'password1'}),{code:'ACCOUNT_NOT_FOUND'})
  await assert.rejects(call(repo,'auth.verify',{flowId:f.flowId,purpose:'reset',code:'567567'}),{code:'FLOW_EXPIRED'})
  await assert.rejects(call(repo,'auth.verify',{flowId:f.flowId,purpose:'signup',code:'482176'}),{code:'INVALID_VERIFICATION_CODE'})
  await call(repo,'auth.verify',{flowId:f.flowId,purpose:'signup',code:'567567'})
  await call(repo,'auth.startVerification',{flowId:f.flowId,email:'changed@example.com'})
  assert.equal(repo.flows.get(f.flowId).verified,false)
  assert.equal(Object.keys((await repo.read()).accounts).length,1)
})
test('Complete is atomic on failure, retryable and idempotent under concurrent submissions',async t=>{
  const repo=create();t.after(()=>repo.close());const p=await draft(repo)
  repo.beforeWrite=()=>{throw new AppError('STORAGE_FAILED')}
  await assert.rejects(call(repo,'auth.completeRegistration',p),{code:'STORAGE_FAILED'})
  assert.equal(Object.keys((await repo.read()).accounts).length,1)
  repo.beforeWrite=()=>{}
  const [a,b]=await Promise.all([call(repo,'auth.completeRegistration',p),call(repo,'auth.completeRegistration',p)])
  assert.equal(a.user.id,b.user.id);assert.equal(Object.keys((await repo.read()).accounts).length,2)
  await call(repo,'auth.logout')
  const login=await call(repo,'auth.login',{email:'new@example.com',password:'password1'})
  assert.equal(login.user.profile.displayName,'Élodie')
  assert.equal(login.user.profile.photos.length,2)
  assert.ok((await call(repo,'media.resolve',{id:login.user.profile.photos[0].id})).url)
  assert.equal((await repo.read()).preferences.eulaConsent,true)
})
test('onboarding minima enforced, stored media is account isolated, reset grants consumed only on successful write',async t=>{
  const repo=create();t.after(()=>repo.close());const p=await draft(repo)
  const invalid={...p,profile:{...p.profile,photos:p.profile.photos.slice(0,1)}}
  await assert.rejects(call(repo,'auth.completeRegistration',invalid),{code:'PHOTOS_REQUIRED'})
  await call(repo,'auth.completeRegistration',p);await call(repo,'auth.logout')
  const f=await call(repo,'auth.beginReset',{email:'new@example.com'})
  await assert.rejects(call(repo,'auth.resetPassword',{flowId:f.flowId,password:'different1'}),{code:'VERIFICATION_REQUIRED'})
  await call(repo,'auth.verify',{flowId:f.flowId,purpose:'reset',code:'567567'})
  repo.beforeWrite=()=>{throw new AppError('STORAGE_FAILED')}
  await assert.rejects(call(repo,'auth.resetPassword',{flowId:f.flowId,password:'different1'}),{code:'STORAGE_FAILED'})
  repo.beforeWrite=()=>{}
  await call(repo,'auth.resetPassword',{flowId:f.flowId,password:'different1'})
  await assert.rejects(call(repo,'auth.resetPassword',{flowId:f.flowId,password:'againpass1'}),{code:'FLOW_EXPIRED'})
  await assert.rejects(call(repo,'auth.login',{email:'new@example.com',password:'password1'}),{code:'WRONG_PASSWORD'})
  await call(repo,'auth.login',{email:'new@example.com',password:'different1'})
  await call(repo,'auth.logout');await call(repo,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'})
  await assert.rejects(call(repo,'media.resolve',{id:p.profile.photos[0].id}),{code:'MEDIA_MISSING'})
  await assert.rejects(call(repo,'auth.beginReset',{email:'eluva@gmail.com'}),{code:'TEST_ACCOUNT_READ_ONLY'})
})

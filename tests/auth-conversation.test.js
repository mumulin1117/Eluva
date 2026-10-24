import test from 'node:test'
import assert from 'node:assert/strict'
import { indexedDB } from 'fake-indexeddb'
import { BrowserRepository } from '../src/services/browser-repository.js'
import { LEGAL_VERSION,TEST_USER_ID } from '../src/domain/validation.js'
import { conversationVersion,quizQuestions } from '../src/data/auth-conversation.js'
import { validateOnboarding,suggestedBio } from '../src/domain/auth-conversation.js'
const call=(r,key,p={})=>{const[s,m]=key.split('.');return r.execute(s,m,p)}
const answers=()=>quizQuestions.map((q,i)=>({questionId:q.id,status:i===1?'skipped':i===2?'timeout':'answered',optionId:i===1||i===2?null:q.options[0].id,elapsedMs:i===2?5000:200}))
const profile={displayName:'Élodie',birthday:'2000-01-01',gender:'private',photos:[],about:'',interestIds:[],goalIds:[],icebreakerIds:[]}
async function prepare(t,email='conversation@example.com'){
 const r=new BrowserRepository({indexedDB,dbName:'conversation-'+crypto.randomUUID()});t.after(()=>r.close());await call(r,'preferences.consent',{accepted:true,version:LEGAL_VERSION});const f=await call(r,'auth.beginRegistration',{email,version:conversationVersion});return {r,flowId:f.flowId,email}
}
async function verified(t,email){const f=await prepare(t,email);await call(f.r,'auth.verify',{flowId:f.flowId,purpose:'signup',code:'567567'});await call(f.r,'auth.setRegistrationPassword',{flowId:f.flowId,password:'password1'});f.params={flowId:f.flowId,commitId:crypto.randomUUID(),communityAccepted:true,profile,onboarding:{version:conversationVersion,theme:'cyan',answers:answers()}};return f}
test('conversation email precedes password; only verified fixed-code context can set a password',async t=>{
 const {r,flowId,email}=await prepare(t)
 await assert.rejects(call(r,'auth.setRegistrationPassword',{flowId,password:'password1'}),{code:'VERIFICATION_REQUIRED'})
 await call(r,'auth.resend',{flowId,purpose:'signup'})
 await assert.rejects(call(r,'auth.verify',{flowId,purpose:'signup',code:'000000'}),{code:'INVALID_VERIFICATION_CODE'})
 await assert.rejects(call(r,'auth.login',{email,password:'password1'}),{code:'ACCOUNT_NOT_FOUND'})
 await call(r,'auth.verify',{flowId,purpose:'signup',code:'567567'})
 await assert.rejects(call(r,'auth.setRegistrationPassword',{flowId,password:'abcdefgh'}),{code:'WEAK_PASSWORD'})
 await call(r,'auth.setRegistrationPassword',{flowId,password:'password1'})
 await call(r,'auth.startVerification',{flowId,email:'changed@example.com'})
 await assert.rejects(call(r,'auth.setRegistrationPassword',{flowId,password:'password1'}),{code:'VERIFICATION_REQUIRED'})
 await assert.rejects(call(r,'auth.beginRegistration',{email,version:'anything'}),{code:'INVALID_ARGUMENT'})
 assert.equal(Object.keys((await r.read()).accounts).length,1)
})
test('conversation commit has no legacy minima; theme, quiz and credential commit once and failure retains grant',async t=>{
 const {r,params,email}=await verified(t)
 r.beforeWrite=()=>{throw {code:'STORAGE_FAILED'}}
 await assert.rejects(call(r,'auth.completeRegistration',params),{code:'STORAGE_FAILED'})
 assert.equal(Object.keys((await r.read()).accounts).length,1)
 r.beforeWrite=()=>{}
 const [a,b]=await Promise.all([call(r,'auth.completeRegistration',params),call(r,'auth.completeRegistration',params)])
 assert.equal(a.user.id,b.user.id);assert.equal(a.theme,'cyan');assert.equal(b.theme,'cyan');assert.equal(a.user.registrationVersion,conversationVersion);assert.equal(a.user.onboarding,undefined);assert.equal(a.user.profile.birthday,'2000-01-01')
 assert.deepEqual((await r.read()).accounts[a.user.id].onboarding.answers,answers());assert.equal(Object.keys((await r.read()).accounts).length,2)
 await call(r,'personal.saveProfile',{commitId:crypto.randomUUID(),profile:{...profile,displayName:'Updated'}})
 assert.deepEqual((await r.read()).accounts[a.user.id].onboarding.answers,answers())
 await call(r,'auth.logout');const restored=await call(r,'auth.login',{email,password:'password1'});assert.equal(restored.theme,'cyan');assert.equal(restored.user.profile.displayName,'Updated')
 await call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'});assert.equal((await call(r,'app.bootstrap')).user.id,TEST_USER_ID);await assert.rejects(call(r,'auth.completeRegistration',params),{code:'AUTH_REQUIRED'});assert.equal((await call(r,'app.bootstrap')).user.id,TEST_USER_ID)
})
test('quiz schema rejects omissions, wrong order, fabricated types and invalid selection without creating an account',async t=>{
 const {r,params}=await verified(t)
 const invalid=[{...params.onboarding,answers:answers().slice(1)},{...params.onboarding,theme:'invented'},{...params.onboarding,answers:answers().toReversed()},{...params.onboarding,answers:answers().map((x,i)=>i===9?{...x,optionId:'IFNJ'}:x)},{...params.onboarding,answers:answers().map((x,i)=>i===2?{...x,optionId:'yes'}:x)}]
 for(const onboarding of invalid)await assert.rejects(call(r,'auth.completeRegistration',{...params,onboarding}),{code:'INVALID_PROFILE'})
 await assert.rejects(call(r,'auth.completeRegistration',{...params,profile:{...profile,birthday:'2020-01-01'}}),{code:'AGE_RESTRICTED'})
 await assert.rejects(call(r,'auth.completeRegistration',{...params,communityAccepted:false}),{code:'CONSENT_REQUIRED'})
 assert.equal(Object.keys((await r.read()).accounts).length,1)
 await call(r,'auth.completeRegistration',params)
})
test('bio derives only explicit answers and never invents MBTI or ranking; skipped and timeout answers stay empty',()=>{
 const skipped=answers().map(x=>({...x,status:'skipped',optionId:null,elapsedMs:0}));assert.equal(suggestedBio(skipped,'en'),'');assert.equal(suggestedBio(skipped,'fr'),'')
 for(const locale of ['en','fr']){const bio=suggestedBio(answers(),locale);assert.ok(bio.length<=300);assert.ok(bio.includes('INTJ'));assert.ok(!/IFNJ|IFFJ|outscore|rank|AI-generated/.test(bio))}
 assert.equal(validateOnboarding({version:conversationVersion,theme:'purple',answers:skipped}).answers.length,10)
})

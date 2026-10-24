import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { indexedDB } from 'fake-indexeddb'
import { BrowserRepository } from '../src/services/browser-repository.js'
import { AppError } from '../src/domain/errors.js'
import { LEGAL_VERSION,TEST_USER_ID } from '../src/domain/validation.js'
import { choices } from '../src/data/choices.js'
import { upgradePresentation } from '../src/domain/demo-upgrade.js'
import { presentationFixture } from '../src/data/demo-fixtures.js'
import { conversationVersion,quizQuestions } from '../src/data/auth-conversation.js'

test('presentation cleanup never replaces edited names, user content or another account',()=>{
 const id=TEST_USER_ID,root={accounts:{[id]:{isTest:true,profile:{displayName:'My own Demo name'}},other:{profile:{displayName:'Eluva Demo'}}},social:{messages:{[id+':echo-text']:{demo:true,body:'A small hello from the local demo.',readAt:'kept'},[id+':notes-text']:{demo:true,body:'My local story',translations:{fr:'Mon texte'}}}}}
 upgradePresentation(root)
 assert.equal(root.accounts[id].profile.displayName,'My own Demo name');assert.equal(root.accounts.other.profile.displayName,'Eluva Demo')
 assert.equal(root.social.messages[id+':echo-text'].body,presentationFixture.greeting.en);assert.equal(root.social.messages[id+':echo-text'].readAt,'kept')
 assert.equal(root.social.messages[id+':notes-text'].body,'My local story');assert.deepEqual(root.social.messages[id+':notes-text'].translations,{fr:'Mon texte'})
 const after=structuredClone(root);upgradePresentation(root);assert.deepEqual(root,after)
})

const call=(r,key,p={})=>{const [s,m]=key.split('.');return r.execute(s,m,p)}
const login=r=>call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'})
async function make(t){const r=new BrowserRepository({indexedDB,dbName:'demo-'+crypto.randomUUID()});t.after(()=>r.close());await call(r,'app.bootstrap');await call(r,'preferences.consent',{accepted:true,version:LEGAL_VERSION});await login(r);return r}
const expected=[
 'Not feeling like doing anything today, just wanna zone out.',
 'Been super busy, but still feel lonely for no reason.',
 'Ugh, all my plans got messed up again.',
 'Sometimes I wonder how I look to other people.',
 'Little happy moment — the evening breeze feels so nice.',
 'Stuck in overthinking, wish I could quiet my mind.',
 'Not everyone gets how you feel. Learning to accept it.',
 'Had a long chat with a friend today, feels like a weight lifted off.',
 'Waited for something for so long, but it turned out underwhelming.',
 'No need to stay positive all the time. It’s okay to feel low.',
]
test('supplied data has exactly ten original posts, twenty linked personas and all thirty-nine unmodified local PNGs',async t=>{
 const r=await make(t),s=await call(r,'social.snapshot'),c=await call(r,'content.snapshot'),people=s.profiles.filter(p=>p.id!==TEST_USER_ID)
 assert.equal(people.length,20);assert.equal(new Set(people.map(x=>x.id)).size,20);assert.equal(c.posts.length,10)
 const posts=[...c.posts].sort((a,b)=>a.fixtureNumber-b.fixtureNumber)
 assert.deepEqual(posts.map(x=>x.body),expected);assert.deepEqual(posts.map(x=>x.media.length),[1,2,1,2,3,2,2,2,1,3])
 for(const post of posts){const person=people.find(p=>p.id===post.authorId);assert.ok(person);assert.equal(post.author.displayName,person.displayName);assert.equal(person.photos.length,1);assert.ok(person.photos[0].asset.startsWith('images/demo-users/'));assert.ok(!post.demoKey);assert.equal(s.profilePosts.filter(x=>x.authorId===person.id).length,1)}
 assert.equal(s.threads.length,2);for(const thread of s.threads){assert.ok(people.some(p=>p.id===thread.peerId));assert.ok(thread.messages.some(m=>m.kind==='text'));assert.ok(thread.messages.every(m=>m.kind==='text'));assert.ok(thread.messages.at(-1).translations.fr)}
 const assets=JSON.parse(await readFile(new URL('../docs/evidence/demo-data-2026-10-19/assets.json',import.meta.url)))
 assert.equal(assets.length,39);for(const item of assets){const data=await readFile(new URL('../'+item.file,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);assert.equal(data.readUInt32BE(16),item.width);assert.equal(data.readUInt32BE(20),item.height)}
 await call(r,'preferences.locale',{locale:'fr'});assert.deepEqual((await call(r,'content.snapshot')).posts.sort((a,b)=>a.fixtureNumber-b.fixtureNumber).map(x=>x.body),expected)
})
test('old fixture upgrade is atomic and retryable; keeps user posts, reactions, comments, blocks, resolved requests and read state',async t=>{
 let r=await make(t);await call(r,'social.snapshot');await call(r,'content.echo',{postId:'demo-post-campus-v1',lit:true});const comment=await call(r,'content.comment',{postId:'demo-post-campus-v1',body:'Keep my comment',commitId:crypto.randomUUID()});await call(r,'social.read',{peerId:'demo-friend-echo'});await call(r,'social.ignore',{requestId:'demo-request-in',commitId:crypto.randomUUID()});await call(r,'social.block',{peerId:'demo-friend-notes',blocked:true})
 const draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});const own=await call(r,'content.publish',{draftId,commitId:crypto.randomUUID(),body:'Keep my own published post',media:[],visibility:{private:true,audience:'everyone',discover:false,profile:false},audienceFilter:'any',tagIds:[]})
 await r.write(s=>{delete s.presentationVersion;s.accounts[TEST_USER_ID].profile.displayName='Eluva Demo';const c=s.content;for(const post of Object.values(c.posts))if(post.fixtureNumber)post.demoScope=TEST_USER_ID;delete c.fixtureVersion;for(const id of Object.keys(c.posts))if(c.posts[id].demoScope&& !['demo-post-campus-v1','demo-post-question-v1'].includes(id))delete c.posts[id];c.posts['demo-post-campus-v1'].body='Old bundled preview';c.posts['demo-post-campus-v1'].demoKey='demoBody1';const d=s.social;delete d.fixtureVersion;d.profiles=Object.fromEntries(Object.entries(d.profiles).filter(([id])=>['demo-friend-echo','demo-friend-notes','demo-requester','demo-recipient','demo-stranger','demo-blocked-user'].includes(id)).map(([id,p])=>[id,{...p,displayName:'Old bundled profile',photos:[]}]));for(const id of Object.keys(d.messages))if(id.endsWith('-context-v2'))delete d.messages[id];return {state:s,result:{}}})
 const prior=await raw(r),read=prior.social.messages[TEST_USER_ID+':echo-text'].readAt,hash=prior.accounts[TEST_USER_ID].credential.hash,dbName=r.dbName;r.close()
 let fail=true;r=new BrowserRepository({indexedDB,dbName,beforeWrite:()=>{if(fail)throw new AppError('STORAGE_FAILED')}});t.after(()=>r.close());await assert.rejects(call(r,'app.bootstrap'),{code:'STORAGE_FAILED'});assert.deepEqual(await raw(r),prior)
 fail=false;await call(r,'app.bootstrap');await call(r,'social.snapshot');const next=await raw(r)
 assert.equal(Object.values(next.content.posts).filter(p=>p.fixtureNumber&&!p.demoScope).length,10);assert.equal(next.content.posts[own.resultId].body,'Keep my own published post');assert.equal(next.content.comments[comment.resultId].body,'Keep my comment');assert.ok(next.content.echoes[TEST_USER_ID+':demo-post-campus-v1']);assert.ok(next.content.blocks[TEST_USER_ID+':demo-friend-notes']);assert.equal(next.social.requests['demo-request-in'].status,'ignored');assert.equal(next.social.messages[TEST_USER_ID+':echo-text'].readAt,read);assert.equal(next.accounts[TEST_USER_ID].credential.hash,hash);assert.equal(next.accounts[TEST_USER_ID].profile.displayName,presentationFixture.accountName);assert.equal(Object.keys(next.social.profiles).length,20);assert.ok(!next.social.messages[TEST_USER_ID+':notes-context-v2']);assert.equal(next.content.posts['demo-post-campus-v1'].demoKey,undefined)
 const before=JSON.stringify(next);await call(r,'app.bootstrap');assert.equal(JSON.stringify(await raw(r)),before)
})
async function raw(r){const db=await r.open();return new Promise((ok,no)=>{const q=db.transaction('state').objectStore('state').get('root');q.onsuccess=()=>ok(q.result);q.onerror=no})}
test('retiring bundled voice history is atomic, exact, persistent and preserves recorded messages',async t=>{
 let r=await make(t);await call(r,'social.snapshot');await call(r,'social.read',{peerId:'demo-friend-echo'})
 await r.write(s=>{s.presentationVersion=1;s.accounts[TEST_USER_ID].profile.displayName='Eluva Demo';s.social.messages[TEST_USER_ID+':echo-text'].body='A small hello from the local demo.';for(const name of ['echo','notes']){
  const id=TEST_USER_ID+':'+name+'-voice';s.social.messages[id]={id,threadId:'demo-thread-'+name,senderId:TEST_USER_ID,recipientId:'demo-friend-'+name,kind:'voice',asset:'demo/local-voice.wav',readAt:null,demo:true}
  s.fixtures[TEST_USER_ID].threads.find(x=>x.id==='demo-thread-'+name).messages.push({id:name+'-voice',kind:'voice',asset:'demo/local-voice.wav',sentByMe:true})
 }
 s.social.messages['user-recording']={id:'user-recording',threadId:'demo-thread-echo',senderId:TEST_USER_ID,recipientId:'demo-friend-echo',kind:'voice',mediaId:'kept-media',duration:3,createdAt:'2026-10-21T00:00:00.000Z',readAt:'kept'}
 s.social.messages['other:echo-voice']={...s.social.messages[TEST_USER_ID+':echo-voice'],id:'other:echo-voice',senderId:'other'}
 return {state:s,result:{}}})
 const before=await raw(r),dbName=r.dbName;r.close();let fail=true;r=new BrowserRepository({indexedDB,dbName,beforeWrite:()=>{if(fail)throw new AppError('STORAGE_FAILED')}});t.after(()=>r.close())
 await assert.rejects(call(r,'app.bootstrap'),{code:'STORAGE_FAILED'});assert.deepEqual(await raw(r),before);fail=false;await call(r,'app.bootstrap');const after=await raw(r)
 for(const name of ['echo','notes']){assert.equal(after.social.messages[TEST_USER_ID+':'+name+'-voice'],undefined);assert.ok(after.fixtures[TEST_USER_ID].threads.find(x=>x.id==='demo-thread-'+name).messages.every(x=>x.kind==='text'))}
 for(const id of ['user-recording','other:echo-voice',TEST_USER_ID+':echo-text',TEST_USER_ID+':notes-text'])assert.deepEqual(after.social.messages[id],before.social.messages[id])
 assert.deepEqual(after.accounts,before.accounts);assert.deepEqual(after.social.threads,before.social.threads);assert.equal(after.presentationVersion,presentationFixture.version)
 r.close();r=new BrowserRepository({indexedDB,dbName});t.after(()=>r.close());await call(r,'app.bootstrap');assert.deepEqual(await raw(r),after)
})
test('an already-registered reader upgrades a scoped v2 catalog atomically without exposing private posts or test conversations',async t=>{
 let r=await make(t);await call(r,'social.snapshot');await call(r,'content.echo',{postId:'demo-post-campus-v1',lit:true})
 const draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});const privatePost=await call(r,'content.publish',{draftId,commitId:crypto.randomUUID(),body:'Test account private original',media:[],visibility:{private:true,audience:'everyone',discover:false,profile:false},audienceFilter:'any',tagIds:[]})
 await call(r,'auth.logout');const f=await call(r,'auth.beginRegistration',{email:'existing-reader@example.com',version:conversationVersion});await call(r,'auth.verify',{flowId:f.flowId,purpose:'signup',code:'567567'});await call(r,'auth.setRegistrationPassword',{flowId:f.flowId,password:'password1'})
 const registered=await call(r,'auth.completeRegistration',{flowId:f.flowId,commitId:crypto.randomUUID(),communityAccepted:true,profile:{displayName:'Existing reader',birthday:'2000-01-01',gender:'private',photos:[],about:'',interestIds:[],goalIds:[],icebreakerIds:[]},onboarding:{version:conversationVersion,theme:'purple',answers:quizQuestions.map(q=>({questionId:q.id,status:'skipped',optionId:null,elapsedMs:0}))}})
 await r.write(s=>{s.content.fixtureVersion=2;s.social.fixtureVersion=2;for(const p of Object.values(s.content.posts))if(p.fixtureNumber)p.demoScope=TEST_USER_ID;for(const p of Object.values(s.social.profiles))if(p.demo)p.scope=TEST_USER_ID;return {state:s,result:{}}})
 const before=await raw(r),dbName=r.dbName;r.close();let fail=true;r=new BrowserRepository({indexedDB,dbName,beforeWrite:()=>{if(fail)throw {code:'STORAGE_FAILED'}}});t.after(()=>r.close())
 await assert.rejects(call(r,'app.bootstrap'),{code:'STORAGE_FAILED'});assert.deepEqual(await raw(r),before);fail=false;const boot=await call(r,'app.bootstrap');assert.equal(boot.user.id,registered.user.id)
 const c=await call(r,'content.snapshot'),s=await call(r,'social.snapshot');assert.equal(c.posts.length,10);assert.ok(c.posts.every(p=>!p.demoScope&&!p.lit&&p.id!==privatePost.resultId));assert.equal(s.threads.length,0);assert.equal(s.unreadCount,0);assert.equal(s.profiles.filter(p=>p.id.startsWith('demo-')).length,20)
 const after=await raw(r);assert.equal(after.content.posts[privatePost.resultId].body,'Test account private original');assert.ok(after.content.echoes[TEST_USER_ID+':demo-post-campus-v1']);assert.equal(Object.keys(after.accounts).length,Object.keys(before.accounts).length)
})
test('a newly registered account sees app-wide supplied people and posts, but not another account private chats; avatar URLs stay trusted',async t=>{
 const r=await make(t);await call(r,'social.snapshot');await r.write(s=>{s.social.profiles['demo-friend-echo'].photos[0].asset='https://invalid.example/tracker.png';return {state:s,result:{}}});const safe=await call(r,'social.snapshot');assert.equal(safe.profiles.find(p=>p.id==='demo-friend-echo').photos[0].asset,'images/demo-users/female-01-avatar.png')
 await call(r,'auth.logout');const f=await call(r,'auth.beginRegistration',{email:'fixture-isolation@example.com',password:'password1'});await call(r,'auth.verify',{flowId:f.flowId,purpose:'signup',code:'567567'});const base64=(await readFile(new URL('./fixtures/qa-photo-one.png',import.meta.url))).toString('base64'),photos=[];for(let i=0;i<2;i++)photos.push(await call(r,'media.import',{flowId:f.flowId,mime:'image/png',base64}));await call(r,'auth.completeRegistration',{flowId:f.flowId,commitId:crypto.randomUUID(),communityAccepted:true,profile:{displayName:'Independent account',birthday:'2000-01-01',photos,about:'',interestIds:choices.interests.slice(0,3).map(x=>x.id),goalIds:[],icebreakerIds:choices.icebreakers.slice(0,3).map(x=>x.id)}})
 const content=await call(r,'content.snapshot'),social=await call(r,'social.snapshot')
 assert.equal(content.posts.length,10);assert.equal(social.threads.length,0);assert.equal(social.requests.length,0);assert.equal(social.events.length,0);assert.equal(social.unreadCount,0);assert.equal(social.profiles.filter(p=>p.id.startsWith('demo-')).length,20)
 await call(r,'social.profile',{peerId:'demo-friend-echo'});await call(r,'content.post',{id:'demo-post-campus-v1'})
 await assert.rejects(call(r,'social.requireFriend',{peerId:'demo-friend-echo'}),{code:'FRIENDSHIP_REQUIRED'})
 await call(r,'content.echo',{postId:'demo-post-campus-v1',lit:true});assert.equal((await call(r,'content.snapshot')).posts.find(p=>p.id==='demo-post-campus-v1').lit,true)
 await call(r,'auth.logout');await login(r);assert.equal((await call(r,'content.snapshot')).posts.find(p=>p.id==='demo-post-campus-v1').lit,false);assert.equal((await call(r,'social.snapshot')).threads.length,2)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { indexedDB } from 'fake-indexeddb'
import { BrowserRepository } from '../src/services/browser-repository.js'
import { AppError } from '../src/domain/errors.js'
import { defaultVisibility, feedPosts, discoveryBatch, contentPolicy } from '../src/domain/content.js'
import { LEGAL_VERSION } from '../src/domain/validation.js'
import { choices } from '../src/data/choices.js'
import { readFile } from 'node:fs/promises'
const call=(r,key,p={})=>{const [s,m]=key.split('.');return r.execute(s,m,p)}
async function create(t){const r=new BrowserRepository({indexedDB,dbName:'p2-'+crypto.randomUUID()});t.after(()=>r.close());await call(r,'app.bootstrap');await call(r,'preferences.consent',{accepted:true,version:LEGAL_VERSION});await call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'});return r}
async function draft(r,overrides={}){const draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});return {draftId,commitId:crypto.randomUUID(),body:'A campus moment',media:[],visibility:defaultVisibility(),audienceFilter:'any',tagIds:[],collectionId:null,...overrides}}
async function register(r,email){await call(r,'auth.logout');const f=await call(r,'auth.beginRegistration',{email,password:'password1'});await call(r,'auth.verify',{flowId:f.flowId,purpose:'signup',code:'567567'});const data=(await readFile(new URL('./fixtures/qa-photo-one.png',import.meta.url))).toString('base64'),photos=[];for(let i=0;i<2;i++)photos.push(await call(r,'media.import',{flowId:f.flowId,mime:'image/png',base64:data}));return call(r,'auth.completeRegistration',{flowId:f.flowId,commitId:crypto.randomUUID(),communityAccepted:true,profile:{displayName:email.split('@')[0],birthday:'2000-01-01',photos,about:'',interestIds:choices.interests.slice(0,3).map(x=>x.id),goalIds:[],icebreakerIds:choices.icebreakers.slice(0,3).map(x=>x.id)}})}
test('P1 vault migration preserves account and publishes atomically with stable retry identity',async t=>{
 const r=await create(t),before=await r.read(),p=await draft(r);assert.equal(before.content,undefined)
 r.beforeWrite=()=>{throw new AppError('STORAGE_FAILED')};await assert.rejects(call(r,'content.publish',p),{code:'STORAGE_FAILED'});r.beforeWrite=()=>{}
 let s=await call(r,'content.snapshot');assert.equal(s.quota.used,0);assert.ok(!s.posts.some(x=>x.body===p.body))
 const [a,b]=await Promise.all([call(r,'content.publish',p),call(r,'content.publish',p)]);assert.equal(a.resultId,b.resultId);assert.equal(b.quota.used,1);assert.equal(b.posts.filter(x=>x.id===a.resultId).length,1)
 await assert.rejects(call(r,'content.publish',{...p,body:'Different intent with the same identity'}),{code:'COMMIT_CONFLICT'})
 await assert.rejects(call(r,'content.publish',{...p,commitId:crypto.randomUUID()}),{code:'DRAFT_EXPIRED'})
 assert.equal((await r.read()).accounts[before.session.userId].credential.hash,before.accounts[before.session.userId].credential.hash)
})
test('a malformed content migration is preserved and reported rather than silently replaced',async t=>{
 const r=await create(t),before=await r.read();await r.write(s=>{s.content=false;return{state:s,result:{}}})
 await assert.rejects(call(r,'content.snapshot'),{code:'STORAGE_CORRUPT'});const db=await r.open(),raw=await new Promise((resolve,reject)=>{const q=db.transaction('state').objectStore('state').get('root');q.onsuccess=()=>resolve(q.result);q.onerror=reject});assert.equal(raw.content,false);assert.equal(raw.accounts[before.session.userId].credential.hash,before.accounts[before.session.userId].credential.hash)
})
test('configured quota is atomic: exhausted public posts fail, private posts and retries never spend it twice',async t=>{
 const r=await create(t);r.contentPolicy={...contentPolicy,dailyPublicPosts:1};const p=await draft(r);const a=await call(r,'content.publish',p);assert.equal(a.quota.limit,1);assert.equal(a.quota.used,1);assert.equal((await call(r,'content.publish',p)).quota.used,1)
 await assert.rejects(call(r,'content.publish',await draft(r)),{code:'QUOTA_EXHAUSTED'});const v=await call(r,'content.publish',await draft(r,{visibility:{...defaultVisibility(),private:true}}));assert.equal(v.quota.used,1)
})
test('published posts remain in their author snapshot, detail and collection while discovery serves other users',async t=>{
 const r=await create(t),p=await draft(r,{body:'My own public moment'}),c=await call(r,'content.createCollection',{draftId:p.draftId,commitId:crypto.randomUUID(),name:'My moments',description:''})
 p.collectionId=c.resultId
 const result=await call(r,'content.publish',p),own=result.posts.find(x=>x.id===result.resultId),owner=result.ownerId
 assert.equal(own.authorId,owner);assert.equal(own.visibility.discover,true)
 assert.ok(result.collections.find(x=>x.id===c.resultId).postIds.includes(own.id))
 assert.ok((await call(r,'content.post',{id:own.id})).posts.some(x=>x.id===own.id))
 assert.ok(!feedPosts(result.posts,undefined,{viewerId:owner}).some(x=>x.id===own.id))
 assert.equal(discoveryBatch(result.posts,undefined,{viewerId:owner}).length,5)
 await register(r,'own-feed-reader@example.com')
 const reader=await call(r,'content.snapshot')
 assert.ok(feedPosts(reader.posts,undefined,{viewerId:reader.ownerId}).some(x=>x.id===own.id))
 assert.ok(discoveryBatch(reader.posts,undefined,{viewerId:reader.ownerId}).some(x=>x.id===own.id))
 assert.equal(reader.collections.length,0)
})
test('private, friends-only, profile switches and hidden media cannot leak to another account',async t=>{
 const r=await create(t),raw=await readFile(new URL('./fixtures/qa-photo-one.png',import.meta.url)),p=await draft(r,{visibility:{private:true,audience:'everyone',discover:true,profile:true}}),m=await call(r,'media.import',{draftId:p.draftId,mime:'image/png',base64:raw.toString('base64')});p.media=[m]
 const privateResult=await call(r,'content.publish',p),privateId=privateResult.resultId;assert.equal(privateResult.quota.used,0);const privatePost=privateResult.posts.find(x=>x.id===privateId);assert.equal(privatePost.visibility.discover,false);assert.equal(privatePost.visibility.profile,false);assert.equal(feedPosts(privateResult.posts).some(x=>x.id===privateId),false)
 const f=await call(r,'content.publish',await draft(r,{visibility:{private:false,audience:'friends',discover:true,profile:true}}));const publicPost=await call(r,'content.publish',await draft(r,{body:'Public'}));
 await register(r,'reader@example.com');const other=await call(r,'content.snapshot');assert.ok(!other.posts.some(x=>[privateId,f.resultId].includes(x.id)));assert.ok(other.posts.some(x=>x.id===publicPost.resultId));assert.ok(!other.posts.some(x=>x.demoScope));assert.equal(other.quota.used,0)
 await assert.rejects(call(r,'content.post',{id:privateId}),{code:'POST_UNAVAILABLE'});await assert.rejects(call(r,'media.resolve',{id:m.id}),{code:'MEDIA_MISSING'});await assert.rejects(call(r,'content.echo',{postId:privateId,lit:true}),{code:'POST_UNAVAILABLE'})
})
test('echo/comment identities are separate from friendships; failures keep counts and comments unique',async t=>{
 const r=await create(t),p=await draft(r),created=await call(r,'content.publish',p),id=created.resultId;await register(r,'commenter@example.com')
 const c={postId:id,body:'I felt that too',commitId:crypto.randomUUID()};await assert.rejects(call(r,'content.comment',c),{code:'ECHO_REQUIRED'})
 await call(r,'content.echo',{postId:id,lit:true});let s=await call(r,'content.echo',{postId:id,lit:true});assert.equal(s.posts.find(x=>x.id===id).echoCount,1);assert.deepEqual((await r.read()).fixtures[(await r.read()).session.userId],undefined)
 r.beforeWrite=()=>{throw new AppError('STORAGE_FAILED')};await assert.rejects(call(r,'content.comment',c),{code:'STORAGE_FAILED'});r.beforeWrite=()=>{}
 const [a,b]=await Promise.all([call(r,'content.comment',c),call(r,'content.comment',c)]);assert.equal(a.resultId,b.resultId);assert.equal(b.comments.filter(x=>x.postId===id).length,1)
 s=await call(r,'content.echo',{postId:id,lit:false});assert.equal(s.posts.find(x=>x.id===id).lit,false);assert.equal(s.comments.filter(x=>x.postId===id).length,1)
})
test('collection references commit with publication; invalid, locked, empty and cancelled attempts spend nothing',async t=>{
 const r=await create(t),p=await draft(r),c=await call(r,'content.createCollection',{draftId:p.draftId,commitId:crypto.randomUUID(),name:'Campus',description:'Small moments'});p.collectionId=c.resultId
 await assert.rejects(call(r,'content.publish',{...p,body:'',media:[]}),{code:'EMPTY_POST'});await assert.rejects(call(r,'content.publish',{...p,audienceFilter:'men'}),{code:'PRO_LOCKED'});await assert.rejects(call(r,'content.publish',{...p,collectionId:'other'}),{code:'COLLECTION_UNAVAILABLE'});assert.equal((await call(r,'content.snapshot')).quota.used,0)
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(r.execute('content','publish',p,{signal:cancelled.signal}),{code:'CANCELLED'})
 const a=await call(r,'content.publish',p);assert.deepEqual(a.collections.find(x=>x.id===c.resultId).postIds,[a.resultId]);assert.equal(a.quota.used,1)
})
test('hide/block are reversible and prevent details, reactions, comments and media reads',async t=>{
 const r=await create(t),a=await call(r,'content.publish',await draft(r));await register(r,'safety@example.com');const post=a.posts.find(x=>x.id===a.resultId)
 const hidden=await call(r,'content.hide',{postId:post.id,hidden:true});assert.ok(hidden.blockedAuthors.some(x=>x.id===post.authorId));assert.equal(hidden.hiddenPosts.length,0);await assert.rejects(call(r,'content.post',{id:post.id}),{code:'POST_UNAVAILABLE'});await assert.rejects(call(r,'content.hide',{postId:post.id,hidden:false}),{code:'POST_UNAVAILABLE'});await call(r,'content.block',{authorId:post.authorId,blocked:false});await call(r,'content.block',{authorId:post.authorId,blocked:true});await assert.rejects(call(r,'content.echo',{postId:post.id,lit:true}),{code:'POST_UNAVAILABLE'});const restored=await call(r,'content.block',{authorId:post.authorId,blocked:false});assert.ok(restored.posts.some(x=>x.id===post.id))
})
test('hiding another author is atomic blocking; self-hidden compatibility does not block the owner',async t=>{
 const r=await create(t),owner=(await r.read()).session.userId,post=(await call(r,'content.snapshot')).posts.find(p=>p.authorId==='demo-friend-echo')
 assert.ok(post);await call(r,'realtime.createCall',{callId:crypto.randomUUID(),peerId:post.authorId,direction:'outgoing'})
 const before=await r.read();r.contentFailure='hide';await assert.rejects(call(r,'content.hide',{postId:post.id,hidden:true}),{code:'STORAGE_FAILED'})
 let raw=await r.read();assert.deepEqual(raw.content.blocks,before.content.blocks);assert.deepEqual(raw.content.hidden,before.content.hidden);assert.deepEqual(raw.realtime.calls,before.realtime.calls)
 await call(r,'content.hide',{postId:post.id,hidden:true});raw=await r.read();assert.equal(raw.content.blocks[owner+':'+post.authorId],true);assert.equal(raw.content.hidden[owner+':'+post.id],undefined);assert.ok(Object.values(raw.realtime.calls).every(c=>c.state==='ended'&&c.reason==='blocked'))
 assert.ok(!(await call(r,'social.snapshot')).threads.some(x=>x.peerId===post.authorId));await assert.rejects(call(r,'social.send',{peerId:post.authorId,kind:'text',body:'Blocked',commitId:crypto.randomUUID()}),{code:'USER_BLOCKED'})
 await call(r,'social.block',{peerId:post.authorId,blocked:false});assert.ok((await call(r,'content.snapshot')).posts.some(x=>x.id===post.id))
 const own=await call(r,'content.publish',await draft(r));await call(r,'content.hide',{postId:own.resultId,hidden:true});raw=await r.read();assert.equal(raw.content.blocks[owner+':'+owner],undefined);assert.equal(raw.content.hidden[owner+':'+own.resultId],true)
 await call(r,'content.hide',{postId:own.resultId,hidden:false});assert.ok((await call(r,'content.snapshot')).posts.some(x=>x.id===own.resultId))
})
test('legacy hidden-author upgrade is durable, scoped and reversible only for the chosen author',async t=>{
 const r=await create(t),owner=(await r.read()).session.userId,own=await call(r,'content.publish',await draft(r)),other=(await register(r,'hidden-other@example.com')).user.id
 await call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'})
 const posts=(await call(r,'content.snapshot')).posts,target=posts.find(p=>p.authorId==='demo-friend-echo'),separate=posts.find(p=>p.authorId==='demo-requester');assert.ok(target&&separate)
 await r.write(s=>{delete s.content.safetyVersion;s.content.hidden={[owner+':'+target.id]:true,[owner+':'+separate.id]:true,[owner+':'+own.resultId]:true,[other+':'+target.id]:true,['missing-account:'+target.id]:true};return {state:s,result:{}}})
 const db=await r.open(),raw=()=>new Promise((resolve,reject)=>{const q=db.transaction('state').objectStore('state').get('root');q.onsuccess=()=>resolve(q.result);q.onerror=reject}),before=await raw()
 const fresh=new BrowserRepository({indexedDB,dbName:r.dbName});t.after(()=>fresh.close());fresh.beforeWrite=()=>{throw new AppError('STORAGE_FAILED')};await assert.rejects(call(fresh,'app.bootstrap'),{code:'STORAGE_FAILED'});assert.deepEqual(await raw(),before)
 fresh.beforeWrite=()=>{};await call(fresh,'app.bootstrap');let migrated=await raw();assert.equal(migrated.content.safetyVersion,1);assert.deepEqual(migrated.content.hidden,before.content.hidden);assert.deepEqual(migrated.accounts,before.accounts);assert.deepEqual(migrated.content.posts,before.content.posts)
 assert.equal(migrated.content.blocks[owner+':'+owner],undefined);assert.equal(migrated.content.blocks['missing-account:'+target.authorId],undefined);for(const [viewer,author]of [[owner,target.authorId],[owner,separate.authorId],[other,target.authorId]])assert.equal(migrated.content.blocks[viewer+':'+author],true)
 fresh.beforeWrite=()=>{throw new AppError('STORAGE_FAILED')};await assert.rejects(call(fresh,'social.block',{peerId:target.authorId,blocked:false}),{code:'STORAGE_FAILED'});assert.deepEqual((await raw()).content,migrated.content)
 fresh.beforeWrite=()=>{};await call(fresh,'social.block',{peerId:target.authorId,blocked:false});migrated=await raw();assert.equal(migrated.content.hidden[owner+':'+target.id],undefined);assert.equal(migrated.content.hidden[other+':'+target.id],true);assert.equal(migrated.content.hidden[owner+':'+own.resultId],true);assert.equal(migrated.content.hidden[owner+':'+separate.id],true);assert.equal(migrated.content.blocks[other+':'+target.authorId],true)
 const reopened=new BrowserRepository({indexedDB,dbName:r.dbName});t.after(()=>reopened.close());const restored=await call(reopened,'content.snapshot');assert.ok(restored.posts.some(p=>p.id===target.id));assert.ok(!restored.posts.some(p=>p.id===separate.id));assert.equal(restored.blockedAuthors.some(x=>x.id===target.authorId),false)
 await call(reopened,'content.block',{authorId:separate.authorId,blocked:false});assert.equal((await raw()).content.hidden[owner+':'+separate.id],undefined);assert.ok((await call(reopened,'content.snapshot')).posts.some(p=>p.id===separate.id))
})
test('guide, discovery filters, reports and media staging are scoped; draft cleanup does not delete committed collection covers',async t=>{
 const r=await create(t),p=await draft(r),raw=await readFile(new URL('./fixtures/qa-photo-one.png',import.meta.url)),m=await call(r,'media.import',{draftId:p.draftId,mime:'image/png',base64:raw.toString('base64')});await call(r,'content.createCollection',{draftId:p.draftId,commitId:crypto.randomUUID(),name:'Cover',coverId:m.id});await call(r,'content.discardDraft',{draftId:p.draftId});assert.ok((await call(r,'media.resolve',{id:m.id})).url)
 const s=await call(r,'content.preferences',{guideDone:true,feedFilter:{media:'video',topic:'all'}});assert.equal(s.preferences.guideDone,true);assert.equal(feedPosts(s.posts,s.preferences.feedFilter).length,0)
 const first=s.posts[0],report={postId:first.id,commitId:crypto.randomUUID(),reason:'spam',details:'Local QA'};const a=await call(r,'content.report',report),b=await call(r,'content.report',report);assert.equal(a.resultId,b.resultId);assert.equal(Object.keys((await r.read()).content.reports).length,1)
 await register(r,'isolated@example.com');const other=await call(r,'content.snapshot');assert.equal(other.preferences.guideDone,false);assert.equal(other.collections.length,0)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { indexedDB } from 'fake-indexeddb'
import { BrowserRepository } from '../src/services/browser-repository.js'
import { LEGAL_VERSION, TEST_USER_ID } from '../src/domain/validation.js'
import { choices } from '../src/data/choices.js'
import { readFile } from 'node:fs/promises'
const call=(r,key,p={})=>{const [s,m]=key.split('.');return r.execute(s,m,p)}
const commit=p=>({commitId:crypto.randomUUID(),...p})
const png=()=>readFile(new URL('./fixtures/qa-photo-one.png',import.meta.url)).then(x=>x.toString('base64'))
async function make(t){const r=new BrowserRepository({indexedDB,dbName:'p3-'+crypto.randomUUID()});t.after(()=>r.close());await call(r,'app.bootstrap');await call(r,'preferences.consent',{accepted:true,version:LEGAL_VERSION});await login(r);return r}
const login=r=>call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'})
async function register(r){await call(r,'auth.logout');const f=await call(r,'auth.beginRegistration',{email:'p3-reader@example.com',password:'password1'});await call(r,'auth.verify',{flowId:f.flowId,purpose:'signup',code:'567567'});const photos=[];for(let i=0;i<2;i++)photos.push(await call(r,'media.import',{flowId:f.flowId,mime:'image/png',base64:await png()}));return (await call(r,'auth.completeRegistration',{flowId:f.flowId,commitId:crypto.randomUUID(),communityAccepted:true,profile:{displayName:'Local QA',birthday:'2000-01-01',photos,about:'Original content',interestIds:choices.interests.slice(0,3).map(x=>x.id),goalIds:[],icebreakerIds:choices.icebreakers.slice(0,3).map(x=>x.id)}})).user.id}
test('P3 migration retains two P1 thread identities and text-only fixtures without account changes',async t=>{
 const r=await make(t),before=await r.read(),s=await call(r,'social.snapshot');assert.equal(s.threads.length,2);assert.equal(s.requests.length,2);for(const thread of s.threads){assert.ok(thread.messages.some(m=>m.kind==='text'));assert.ok(thread.messages.every(m=>m.kind==='text'));assert.ok(thread.id.startsWith('demo-thread-'))}assert.equal((await r.read()).accounts[TEST_USER_ID].credential.hash,before.accounts[TEST_USER_ID].credential.hash);assert.ok(!('birthday'in s.profiles[0]));assert.ok(!('email'in s.profiles[0]));assert.deepEqual((await call(r,'social.snapshot')).threads.map(x=>x.id).sort(),s.threads.map(x=>x.id).sort())
})
test('follow never grants chat/media; one intro is idempotent, duplicates and ignored retries rejected',async t=>{
 const r=await make(t);await call(r,'social.follow',{peerId:'demo-stranger',following:true});await assert.rejects(call(r,'social.send',commit({peerId:'demo-stranger',kind:'text',body:'Blocked second message'})),{code:'FRIENDSHIP_REQUIRED'});await assert.rejects(call(r,'social.beginDraft',{peerId:'demo-stranger',draftId:crypto.randomUUID()}),{code:'FRIENDSHIP_REQUIRED'});
 const p=commit({peerId:'demo-stranger',body:'One introduction'});await call(r,'social.simulateFailure',{operation:'request'});await assert.rejects(call(r,'social.request',p),{code:'STORAGE_FAILED'});const [a,b]=await Promise.all([call(r,'social.request',p),call(r,'social.request',p)]);assert.equal(a.resultId,b.resultId);assert.equal(b.requests.filter(x=>x.recipientId==='demo-stranger').length,1);await assert.rejects(call(r,'social.request',commit({peerId:'demo-stranger',body:'Second intro'})),{code:'REQUEST_PENDING'});await assert.rejects(call(r,'social.request',{...p,body:'Changed'}),{code:'COMMIT_CONFLICT'});await assert.rejects(call(r,'social.accept',commit({requestId:a.resultId})),{code:'REQUEST_UNAVAILABLE'});
 const ignored=await call(r,'social.ignore',commit({requestId:'demo-request-in'}));assert.equal(ignored.requests.find(x=>x.id==='demo-request-in').status,'ignored');await assert.rejects(call(r,'social.request',commit({peerId:'demo-requester',body:'Retry'})),{code:'REQUEST_IGNORED'})
})
test('recipient accepts atomically; both accounts unlock and only real reader marks outgoing messages read',async t=>{
 const r=await make(t),peer=await register(r);assert.equal((await call(r,'social.snapshot')).threads.length,0);await call(r,'social.profile',{peerId:'demo-friend-echo'});await assert.rejects(call(r,'social.requireFriend',{peerId:'demo-friend-echo'}),{code:'FRIENDSHIP_REQUIRED'});await login(r);const photo=(await r.read()).accounts[peer].profile.photos[0];await assert.rejects(call(r,'media.resolve',{id:photo.id}),{code:'MEDIA_MISSING'});await call(r,'social.profile',{peerId:peer});assert.ok((await call(r,'media.resolve',{id:photo.id})).url);const contentDraft=crypto.randomUUID();await call(r,'content.beginDraft',{draftId:contentDraft});const friendPost=await call(r,'content.publish',{draftId:contentDraft,commitId:crypto.randomUUID(),body:'Friends-only cross-phase proof',media:[],visibility:{private:false,audience:'friends',discover:true,profile:true},audienceFilter:'any',tagIds:[]});const request=await call(r,'social.request',commit({peerId:peer,body:'Hello'}));await call(r,'auth.login',{email:'p3-reader@example.com',password:'password1'});await assert.rejects(call(r,'content.post',{id:friendPost.resultId}),{code:'POST_UNAVAILABLE'});const p=commit({requestId:request.resultId});await call(r,'social.accept',p);const accepted=await call(r,'social.accept',p);assert.equal(accepted.threads.length,1);assert.ok((await call(r,'content.post',{id:friendPost.resultId})).posts.some(x=>x.id===friendPost.resultId));await call(r,'social.block',{peerId:TEST_USER_ID,blocked:true});await assert.rejects(call(r,'content.post',{id:friendPost.resultId}),{code:'POST_UNAVAILABLE'});await call(r,'social.block',{peerId:TEST_USER_ID,blocked:false});await call(r,'social.send',commit({peerId:TEST_USER_ID,kind:'text',body:'A real local message'}));await login(r);let s=await call(r,'social.snapshot');let thread=s.threads.find(x=>x.peerId===peer);assert.equal(thread.unread,1);await call(r,'social.read',{peerId:peer});assert.equal((await call(r,'social.snapshot')).threads.find(x=>x.peerId===peer).unread,0);await call(r,'auth.login',{email:'p3-reader@example.com',password:'password1'});s=await call(r,'social.snapshot');assert.ok(s.threads[0].messages[0].readAt)
})
test('accept/ignore failure leaves pending request and retry creates one friendship/thread',async t=>{
 const r=await make(t);await call(r,'social.simulateFailure',{operation:'accept'});const p=commit({requestId:'demo-request-in'});await assert.rejects(call(r,'social.accept',p),{code:'STORAGE_FAILED'});assert.equal((await call(r,'social.snapshot')).requests.find(x=>x.id===p.requestId).status,'pending');const [a,b]=await Promise.all([call(r,'social.accept',p),call(r,'social.accept',p)]);assert.equal(a.resultId,b.resultId);assert.equal(b.threads.filter(x=>x.peerId==='demo-requester').length,1);await assert.rejects(call(r,'social.ignore',commit({requestId:p.requestId})),{code:'REQUEST_RESOLVED'})
})
test('image/send rollback, stable retry, friendship and cross-account media boundaries',async t=>{
 const r=await make(t),peer='demo-friend-echo',draftId=crypto.randomUUID();await call(r,'social.beginDraft',{peerId:peer,draftId});const media=await call(r,'media.import',{draftId,mime:'image/png',base64:await png()});const p=commit({peerId:peer,draftId,mediaId:media.id,kind:'image'});await call(r,'social.simulateFailure',{operation:'send'});await assert.rejects(call(r,'social.send',p),{code:'STORAGE_FAILED'});let s=await call(r,'social.snapshot');assert.ok(!s.threads.flatMap(x=>x.messages).some(x=>x.mediaId===media.id));const [a,b]=await Promise.all([call(r,'social.send',p),call(r,'social.send',p)]);assert.equal(a.resultId,b.resultId);assert.equal(b.threads.flatMap(x=>x.messages).filter(x=>x.mediaId===media.id).length,1);await call(r,'social.discardDraft',{draftId});assert.ok((await call(r,'media.resolve',{id:media.id})).url);await call(r,'social.block',{peerId:peer,blocked:true});await assert.rejects(call(r,'media.resolve',{id:media.id}),{code:'MEDIA_MISSING'});await assert.rejects(call(r,'social.send',commit({peerId:peer,kind:'text',body:'No'})),{code:'USER_BLOCKED'});assert.ok(!(await call(r,'social.snapshot')).threads.some(x=>x.peerId===peer));await call(r,'social.block',{peerId:peer,blocked:false});assert.ok((await call(r,'social.thread',{peerId:peer})).threads.find(x=>x.peerId===peer).messages.length);await register(r);await assert.rejects(call(r,'media.resolve',{id:media.id}),{code:'MEDIA_MISSING'})
})
test('targeted light read markers never change normal unread messages; local help and safety stay scoped',async t=>{
 const r=await make(t);await call(r,'content.echo',{postId:'demo-post-campus-v1',lit:true});let s=await call(r,'social.snapshot');assert.equal(s.events.length,1);const normal=s.threads.reduce((n,t)=>n+t.unread,0);await call(r,'social.readEvents',{eventIds:[s.events[0].id]});s=await call(r,'social.snapshot');assert.ok(s.events[0].read);assert.equal(s.threads.reduce((n,t)=>n+t.unread,0),normal);await assert.rejects(call(r,'social.readEvents',{eventIds:['not-an-owned-event']}),{code:'INVALID_ARGUMENT'});await call(r,'social.preferences',{filter:'following',unreadOnly:true});const help=await call(r,'social.help',commit({body:'How does this work?',topic:'how'}));assert.equal(help.feedback.length,1);assert.equal(help.feedback[0].simulation,true);const report=await call(r,'social.report',commit({peerId:'demo-stranger',reason:'spam',details:'Local QA'}));assert.ok(report.resultId);await register(r);s=await call(r,'social.snapshot');assert.equal(s.events.length,0);assert.equal(s.feedback.length,0);assert.deepEqual(s.preferences,{filter:'all',unreadOnly:false})
})
test('malformed social root is preserved rather than resetting accounts or messages',async t=>{
 const r=await make(t);await call(r,'social.snapshot');await r.write(s=>{s.social=false;return {state:s,result:{}}});await assert.rejects(call(r,'social.snapshot'),{code:'STORAGE_CORRUPT'});const db=await r.open();const raw=await new Promise((ok,no)=>{const q=db.transaction('state').objectStore('state').get('root');q.onsuccess=()=>ok(q.result);q.onerror=no});assert.equal(raw.social,false);assert.ok(raw.accounts[TEST_USER_ID].credential.hash)
})

test('light-only category moves after an actual Reply without granting ongoing chat; clearing is scoped and reversible',async t=>{
 const r=await make(t),postId='demo-post-female-03-v2';await call(r,'content.echo',{postId,lit:true});await call(r,'content.echo',{postId:'demo-post-female-04-v2',lit:true})
 let s=await call(r,'social.snapshot');assert.equal(s.events.filter(x=>x.lightOnly).length,2)
 const ids=s.events.filter(x=>x.lightOnly).map(x=>x.id),before=await r.read(),p=commit({eventIds:ids})
 r.socialFailure='clearLightEvents';await assert.rejects(call(r,'social.clearLightEvents',p),{code:'STORAGE_FAILED'});assert.equal((await call(r,'social.snapshot')).events.length,2)
 await Promise.all([call(r,'social.clearLightEvents',p),call(r,'social.clearLightEvents',p)]);assert.equal((await call(r,'social.snapshot')).events.length,0)
 const cleared=await r.read();assert.deepEqual(cleared.content.echoes,before.content.echoes);assert.deepEqual(cleared.social.messages,before.social.messages)
 await call(r,'social.restoreLightEvents',commit({eventIds:ids}));assert.equal((await call(r,'social.snapshot')).events.length,2)
 await call(r,'social.lightHelpSeen',{seen:true});await call(r,'social.preferences',{filter:'following',unreadOnly:true});assert.equal((await call(r,'social.snapshot')).preferences.lightHelpSeen,true)
 await call(r,'social.replyPost',commit({postId,body:'I felt that too.'}));s=await call(r,'social.snapshot');assert.equal(s.events.find(x=>x.postId===postId).lightOnly,false);assert.equal(s.events.filter(x=>x.lightOnly).length,1)
 await assert.rejects(call(r,'social.send',commit({peerId:'demo-stranger',kind:'text',body:'No second message'})),{code:'FRIENDSHIP_REQUIRED'})
 await register(r);await assert.rejects(call(r,'social.clearLightEvents',commit({eventIds:ids})),{code:'INVALID_ARGUMENT'});assert.equal((await call(r,'social.snapshot')).preferences.lightHelpSeen,undefined)
})

test('dynamic Reply is atomic, pair-scoped and only recipient text response unlocks chat',async t=>{
 const r=await make(t),peer=await register(r)
 const publish=async body=>{const draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});return (await call(r,'content.publish',{draftId,commitId:crypto.randomUUID(),body,media:[],visibility:{private:false,audience:'everyone',discover:true,profile:true},audienceFilter:'any',tagIds:[]})).resultId}
 const postId=await publish('A shared thought'),otherId=await publish('Another thought')
 await login(r);await call(r,'content.echo',{postId,lit:true});await call(r,'content.echo',{postId:otherId,lit:true})
 const p=commit({postId,body:'Your post resonated with me.'})
 await call(r,'social.simulateFailure',{operation:'replyPost'});await assert.rejects(call(r,'social.replyPost',p),{code:'STORAGE_FAILED'});assert.equal(Object.keys((await r.read()).social?.connections||{}).length,0)
 const [a,b]=await Promise.all([call(r,'social.replyPost',p),call(r,'social.replyPost',p)]);assert.equal(a.resultId,b.resultId)
 const relation=b.profiles.find(x=>x.id===peer).relationship;assert.equal(relation.connection.status,'pending');assert.equal(relation.canMessage,false);assert.equal(b.threads.find(x=>x.peerId===peer).messages.length,1)
 await assert.rejects(call(r,'social.replyPost',commit({postId:otherId,body:'Again'})),{code:'CONNECTION_PENDING'})
 await assert.rejects(call(r,'social.send',commit({peerId:peer,kind:'text',body:'Again'})),{code:'FRIENDSHIP_REQUIRED'})
 await assert.rejects(call(r,'social.declineConnection',commit({peerId:peer})),{code:'CONNECTION_UNAVAILABLE'})
 assert.ok((await call(r,'social.thread',{peerId:peer})).threads.some(x=>x.peerId===peer));await call(r,'social.read',{peerId:peer})
 await call(r,'auth.login',{email:'p3-reader@example.com',password:'password1'});const received=await call(r,'social.snapshot');assert.equal(received.threads[0].unread,1)
 await assert.rejects(call(r,'social.send',commit({peerId:TEST_USER_ID,kind:'image'})),{code:'CONNECTION_REPLY_REQUIRED'})
 const response=commit({peerId:TEST_USER_ID,kind:'text',body:'I felt that too.'});r.socialFailure='send';await assert.rejects(call(r,'social.send',response),{code:'STORAGE_FAILED'});assert.equal((await call(r,'social.snapshot')).profiles.find(x=>x.id===TEST_USER_ID).relationship.connection.status,'pending')
 await call(r,'social.read',{peerId:TEST_USER_ID});const accepted=await call(r,'social.send',response),repeated=await call(r,'social.send',response);assert.equal(accepted.resultId,repeated.resultId);assert.equal(accepted.profiles.find(x=>x.id===TEST_USER_ID).relationship.canMessage,true);assert.equal(accepted.profiles.find(x=>x.id===TEST_USER_ID).relationship.following,false)
 await login(r);await call(r,'social.send',commit({peerId:peer,kind:'text',body:'Now we can talk.'}));await call(r,'content.echo',{postId,lit:false});assert.equal((await call(r,'social.snapshot')).profiles.find(x=>x.id===peer).relationship.canMessage,true)
 await call(r,'social.block',{peerId:peer,blocked:true});await assert.rejects(call(r,'social.send',commit({peerId:peer,kind:'text',body:'No'})),{code:'USER_BLOCKED'});await assert.rejects(call(r,'social.thread',{peerId:peer}),{code:'USER_BLOCKED'})
})
test('Decline failure retains pending; retry is idempotent and mutual follows provide the second path',async t=>{
 const r=await make(t),peer=await register(r);await login(r)
 const draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});const postId=(await call(r,'content.publish',{draftId,commitId:crypto.randomUUID(),body:'Hello',media:[],visibility:{private:false,audience:'everyone',discover:true,profile:true},audienceFilter:'any',tagIds:[]})).resultId
 await call(r,'auth.login',{email:'p3-reader@example.com',password:'password1'});await call(r,'content.echo',{postId,lit:true});await call(r,'social.replyPost',commit({postId,body:'Nice to meet you.'}));await login(r)
 const p=commit({peerId:peer});await call(r,'social.simulateFailure',{operation:'declineConnection'});await assert.rejects(call(r,'social.declineConnection',p),{code:'STORAGE_FAILED'});assert.equal((await call(r,'social.snapshot')).profiles.find(x=>x.id===peer).relationship.connection.status,'pending')
 await call(r,'social.declineConnection',p);await call(r,'social.declineConnection',p);await assert.rejects(call(r,'social.send',commit({peerId:peer,kind:'text',body:'No longer pending'})),{code:'FRIENDSHIP_REQUIRED'})
 await call(r,'social.follow',{peerId:peer,following:true});await assert.rejects(call(r,'social.send',commit({peerId:peer,kind:'text',body:'Only one direction'})),{code:'FRIENDSHIP_REQUIRED'})
 await call(r,'auth.login',{email:'p3-reader@example.com',password:'password1'});await assert.rejects(call(r,'social.replyPost',commit({postId,body:'Retry after decline'})),{code:'CONNECTION_DECLINED'});await call(r,'social.follow',{peerId:TEST_USER_ID,following:true});await call(r,'social.send',commit({peerId:TEST_USER_ID,kind:'text',body:'Mutual follow unlocks.'}))
 await call(r,'social.follow',{peerId:TEST_USER_ID,following:false});await assert.rejects(call(r,'social.send',commit({peerId:TEST_USER_ID,kind:'text',body:'Unfollow revoked.'})),{code:'FRIENDSHIP_REQUIRED'})
})
test('legacy friendships migrate once; snapshots never silently refollow after unfollow',async t=>{
 const r=await make(t);let s=await call(r,'social.snapshot');assert.equal(s.profiles.find(x=>x.id==='demo-friend-echo').relationship.canMessage,true)
 await call(r,'social.follow',{peerId:'demo-friend-echo',following:false});for(let i=0;i<2;i++){s=await call(r,'social.snapshot');assert.equal(s.profiles.find(x=>x.id==='demo-friend-echo').relationship.canMessage,false)}
 assert.ok(Object.keys((await r.read()).social.friendships).length>=2)
})

test('recipient reply during mutual following establishes an independent connection that survives unfollow',async t=>{
 const r=await make(t),peer=await register(r),draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});const postId=(await call(r,'content.publish',{draftId,commitId:crypto.randomUUID(),body:'A shared thought',media:[],visibility:{private:false,audience:'everyone',discover:true,profile:true},audienceFilter:'any',tagIds:[]})).resultId
 await login(r);await call(r,'content.echo',{postId,lit:true});await call(r,'social.replyPost',commit({postId,body:'I connected with this.'}));await call(r,'social.follow',{peerId:peer,following:true})
 await call(r,'auth.login',{email:'p3-reader@example.com',password:'password1'});await call(r,'social.follow',{peerId:TEST_USER_ID,following:true});let s=await call(r,'social.send',commit({peerId:TEST_USER_ID,kind:'text',body:'Me too.'}));assert.equal(s.profiles.find(x=>x.id===TEST_USER_ID).relationship.connection.status,'connected')
 await call(r,'social.follow',{peerId:TEST_USER_ID,following:false});await call(r,'social.send',commit({peerId:TEST_USER_ID,kind:'text',body:'The reply connection remains.'}));await login(r);s=await call(r,'social.snapshot');assert.equal(s.profiles.find(x=>x.id===peer).relationship.friends,false);assert.equal(s.profiles.find(x=>x.id===peer).relationship.canMessage,true);await call(r,'social.beginDraft',{peerId:peer,draftId:crypto.randomUUID()});await call(r,'social.send',commit({peerId:peer,kind:'text',body:'Still connected.'}))
})

test('public profile collections hide private references, custom covers, blocked owners and other account fixtures',async t=>{
 const r=await make(t);await call(r,'social.snapshot');const peer='demo-requester'
 await r.write(async s=>{const post=Object.values(s.content.posts).find(x=>x.authorId===peer);assert.ok(post);s.content.collections['profile-visible']={id:'profile-visible',ownerId:peer,name:'Quiet days',coverId:'owner-private-cover',postIds:[post.id]};s.content.collections['profile-hidden']={id:'profile-hidden',ownerId:peer,name:'Private',postIds:[]};return {state:s,result:{}}})
 let snap=await call(r,'social.snapshot');assert.equal(snap.collections.find(x=>x.id==='profile-visible').coverId,null);assert.ok(!snap.collections.some(x=>x.id==='profile-hidden'))
 await call(r,'social.block',{peerId:peer,blocked:true});assert.ok(!(await call(r,'social.snapshot')).collections.some(x=>x.ownerId===peer));await call(r,'social.block',{peerId:peer,blocked:false})
 await r.write(async s=>{const c=s.content.collections['profile-visible'];s.content.posts[c.postIds[0]].visibility.private=true;return {state:s,result:{}}});assert.ok(!(await call(r,'social.snapshot')).collections.some(x=>x.id==='profile-visible'))
})
test('profile report failure is atomic, stable retry is deduplicated and targets the exact user',async t=>{
 const r=await make(t);await call(r,'social.snapshot');const p=commit({peerId:'demo-requester',reason:'spam',details:'Scoped QA report'})
 r.socialFailure='report';await assert.rejects(call(r,'social.report',p),{code:'STORAGE_FAILED'});assert.equal(Object.keys((await r.read()).social.reports).length,0)
 const[a,b]=await Promise.all([call(r,'social.report',p),call(r,'social.report',p)]);assert.equal(a.resultId,b.resultId);const report=Object.values((await r.read()).social.reports)[0];assert.equal(report.targetType,'user');assert.equal(report.targetId,p.peerId);assert.equal(Object.keys((await r.read()).social.reports).length,1)
})

test('blocking hides posts, threads, incoming and outgoing requests without deleting history or affecting another account',async t=>{
 const r=await make(t),peer='demo-requester';await call(r,'social.snapshot')
 const post=Object.values((await r.read()).content.posts).find(p=>p.authorId===peer)
 await call(r,'content.hide',{postId:post.id,hidden:true});assert.ok((await call(r,'content.snapshot')).blockedAuthors.some(p=>p.id===peer));assert.equal((await call(r,'content.snapshot')).hiddenPosts.length,0);await call(r,'social.block',{peerId:peer,blocked:false})
 await call(r,'content.echo',{postId:post.id,lit:true});await call(r,'social.replyPost',commit({postId:post.id,body:'A thought about your post.'}))
 const before=await r.read(),visible=await call(r,'social.snapshot')
 r.socialFailure='block';await assert.rejects(call(r,'social.block',{peerId:peer,blocked:true}),{code:'STORAGE_FAILED'})
 assert.ok((await call(r,'social.snapshot')).threads.some(t=>t.peerId===peer));assert.ok((await call(r,'social.snapshot')).requests.some(r=>r.senderId===peer))
 for(const blockedPeer of [peer,'demo-recipient'])await call(r,'social.block',{peerId:blockedPeer,blocked:true})
 const blocked=await call(r,'social.snapshot'),content=await call(r,'content.snapshot'),raw=await r.read()
 assert.ok(!blocked.threads.some(t=>t.peerId===peer));assert.equal(blocked.requests.length,0);assert.ok(!blocked.events.some(e=>e.peerId===peer))
 assert.ok(!blocked.profilePosts.some(p=>p.authorId===peer));assert.ok(!content.posts.some(p=>[peer,'demo-recipient'].includes(p.authorId)))
 assert.ok(content.blockedAuthors.some(p=>p.id===peer));assert.ok(blocked.threads.some(t=>t.peerId==='demo-friend-echo'))
 for(const key of ['messages','requests','connections','follows'])assert.deepEqual(raw.social[key],before.social[key])
 assert.deepEqual(raw.content.posts,before.content.posts);assert.deepEqual(raw.content.echoes,before.content.echoes);assert.deepEqual(raw.accounts,before.accounts)
 assert.equal(blocked.unreadCount,blocked.threads.reduce((n,t)=>n+t.unread,0)+blocked.events.filter(e=>e.lightOnly&&!e.read).length)
 await call(r,'auth.logout');await login(r);assert.ok(!(await call(r,'social.snapshot')).threads.some(t=>t.peerId===peer))
 await register(r);assert.ok((await call(r,'content.snapshot')).posts.some(p=>p.id===post.id));assert.equal((await call(r,'content.snapshot')).blockedAuthors.length,0)
 await login(r);for(const blockedPeer of [peer,'demo-recipient'])await call(r,'social.block',{peerId:blockedPeer,blocked:false})
 const restored=await call(r,'social.snapshot');assert.deepEqual(restored.threads.find(t=>t.peerId===peer).messages,visible.threads.find(t=>t.peerId===peer).messages)
 assert.deepEqual(restored.requests,visible.requests);assert.equal(restored.profiles.find(p=>p.id===peer).relationship.canMessage,false)
})

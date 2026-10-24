import test from 'node:test'
import assert from 'node:assert/strict'
import { reactive } from 'vue'
import { indexedDB } from 'fake-indexeddb'
import { BrowserRepository } from '../src/services/browser-repository.js'
import { LEGAL_VERSION,TEST_USER_ID } from '../src/domain/validation.js'
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII='
const call=(r,key,p={})=>{const[s,m]=key.split('.');return r.execute(s,m,p)}
const commit=p=>({commitId:crypto.randomUUID(),...p})
async function make(t){const r=new BrowserRepository({indexedDB,dbName:'p5-'+crypto.randomUUID()});t.after(()=>r.close());await call(r,'preferences.consent',{accepted:true,version:LEGAL_VERSION});await call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'});await call(r,'social.snapshot');return r}
async function register(r,email){const {flowId}=await call(r,'auth.beginRegistration',{email,password:'password1'});await call(r,'auth.verify',{flowId,purpose:'signup',code:'567567'});const photos=[];for(let i=0;i<2;i++)photos.push(await call(r,'media.import',{flowId,base64:png,mime:'image/png'}));return call(r,'auth.completeRegistration',commit({flowId,communityAccepted:true,profile:{displayName:email.split('@')[0],birthday:'2000-01-01',photos:photos.map(x=>({id:x.id})),about:'Original',interestIds:['music','books','art'],goalIds:[],icebreakerIds:['small-joy','book','learn']}}))}
async function publish(r,body='P5 original'){const draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});const x=await call(r,'content.publish',commit({draftId,body,media:[],visibility:{private:false,audience:'everyone',discover:true,profile:true},audienceFilter:'any',tagIds:[]}));return x.resultId}
async function collection(r,name='Shelf'){return(await call(r,'content.createCollection',commit({name,description:'References only'}))).resultId}
test('P5 profile writes authority only after success; old fixture missing fields do not become a new registration gate',async t=>{
 const r=await make(t),before=(await call(r,'personal.snapshot')).user.profile,p={...before,displayName:'Élodie updated',about:'Changed locally'}
 await r.write(s=>{s.accounts[TEST_USER_ID].profile.communityVersion='previous-preview';return {state:s,result:{}}})
 const operation=commit({profile:p});await call(r,'personal.simulateFailure',{operation:'saveProfile'});await assert.rejects(call(r,'personal.saveProfile',operation),{code:'STORAGE_FAILED'});assert.equal((await call(r,'app.bootstrap')).user.profile.displayName,before.displayName)
 const [a,b]=await Promise.all([call(r,'personal.saveProfile',operation),call(r,'personal.saveProfile',operation)]);assert.equal(a.user.profile.displayName,'Élodie updated');assert.equal(a.user.profile.communityVersion,'previous-preview');assert.deepEqual(a.user.profile,b.user.profile);assert.equal(a.social.profiles.find(x=>x.id===TEST_USER_ID).displayName,'Élodie updated')
 await assert.rejects(call(r,'personal.saveProfile',commit({profile:{...p,birthday:'2999-01-01'}})),{code:'INVALID_BIRTHDAY'})
 await call(r,'auth.logout');assert.equal((await call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'})).user.profile.displayName,'Élodie updated')
})
test('P5 real registered profile media cannot be replaced by another account or lose confirmed minimums',async t=>{
 const r=await make(t),a=await register(r,'owner-a@example.com'),b=await register(r,'owner-b@example.com');await call(r,'auth.login',{email:a.user.email,password:'password1'})
 await assert.rejects(call(r,'personal.saveProfile',commit({profile:{...a.user.profile,photos:b.user.profile.photos}})),{code:'MEDIA_MISSING'})
 await assert.rejects(call(r,'personal.saveProfile',commit({profile:{...a.user.profile,photos:a.user.profile.photos.slice(0,1)}})),{code:'PHOTOS_REQUIRED'})
 await assert.rejects(call(r,'personal.saveProfile',commit({profile:{...a.user.profile,interestIds:['art']}})),{code:'INTERESTS_REQUIRED'})
 const draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});const photo=await call(r,'media.import',{draftId,base64:png,mime:'image/png'});const saved=await call(r,'personal.saveProfile',commit({draftId,profile:{...a.user.profile,photos:[{id:photo.id},a.user.profile.photos[1]]}}));assert.equal(saved.user.profile.photos[0].id,photo.id)
})
test('P5 collection references are shared, owner-only, atomic, idempotent and deleting a container keeps originals',async t=>{
 const r=await make(t),post=await publish(r),one=await collection(r),two=await collection(r,'Second');const p=commit({id:one,postIds:[post]})
 await call(r,'personal.simulateFailure',{operation:'collectionPosts'});await assert.rejects(call(r,'personal.collectionPosts',p),{code:'STORAGE_FAILED'});assert.equal((await call(r,'personal.collection',{id:one})).collection.postIds.length,0)
 await call(r,'personal.collectionPosts',p);await call(r,'personal.collectionPosts',p);await call(r,'personal.collectionPosts',commit({id:two,postIds:[post]}));assert.deepEqual((await call(r,'personal.collection',{id:two})).collection.postIds,[post])
 await register(r,'other@example.com');const publicView=await call(r,'personal.collection',{id:one});assert.equal(publicView.collection.editable,false);await assert.rejects(call(r,'personal.saveCollection',commit({id:one,name:'Hijack'})),{code:'COLLECTION_UNAVAILABLE'})
 await call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'});await call(r,'personal.deleteCollection',commit({id:one}));assert.ok((await call(r,'content.snapshot')).posts.some(p=>p.id===post));await call(r,'personal.deletePost',commit({id:post}));assert.equal((await call(r,'personal.collection',{id:two})).collection.postIds.length,0)
})
test('P5 collection projections never expose private/friends/hidden/blocked posts or another owner cover',async t=>{
 const r=await make(t),post=await publish(r),id=await collection(r);await call(r,'personal.collectionPosts',commit({id,postIds:[post]}));const other=await register(r,'viewer@example.com');assert.equal((await call(r,'personal.collection',{id})).collection.coverId,null)
 await r.write(s=>{s.content.posts[post].visibility.private=true;return {state:s,result:{}}});await assert.rejects(call(r,'personal.collection',{id}),{code:'COLLECTION_UNAVAILABLE'});assert.equal((await call(r,'content.snapshot')).posts.some(x=>x.id===post),false)
 assert.equal((await call(r,'personal.snapshot')).ownerId,other.user.id)
})
test('P5 theme is account-isolated and login/bootstrap restore it; language remains the saved install preference',async t=>{
 const r=await make(t);await call(r,'personal.savePreferences',commit({theme:'cyan'}));await call(r,'preferences.locale',{locale:'fr'});assert.equal((await call(r,'app.bootstrap')).theme,'cyan');const b=await register(r,'theme-b@example.com');assert.equal((await call(r,'personal.snapshot')).preferences.theme,'purple')
 await call(r,'personal.savePreferences',commit({theme:'orange'}));await call(r,'auth.logout');assert.equal((await call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'})).theme,'cyan');assert.equal((await call(r,'app.bootstrap')).locale,'fr');assert.equal((await r.read()).accounts[b.user.id].email,b.user.email)
})
test('P5 feedback saves locally once with trusted images; failures preserve the staged attachment',async t=>{
 const r=await make(t),draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});const photo=await call(r,'media.import',{draftId,base64:png,mime:'image/png'}),p=commit({draftId,body:'Detailed local issue',topic:'crash',mediaIds:[photo.id]});await call(r,'personal.simulateFailure',{operation:'submitFeedback'});await assert.rejects(call(r,'personal.submitFeedback',p),{code:'STORAGE_FAILED'});assert.equal((await call(r,'personal.snapshot')).feedback.length,0)
 const a=await call(r,'personal.submitFeedback',p),b=await call(r,'personal.submitFeedback',p);assert.equal(a.resultId,b.resultId);assert.equal(b.feedback.length,1);assert.equal(b.feedback[0].localOnly,true);await call(r,'auth.logout');await register(r,'feedback-b@example.com');assert.equal((await call(r,'personal.snapshot')).feedback.length,0)
})
test('P5 deleting an isolated QA account rolls back on failure and never deletes another account originals',async t=>{
 const r=await make(t),a=await register(r,'delete-a@example.com'),postA=await publish(r,'A owned post'),b=await register(r,'keep-b@example.com'),postB=await publish(r,'B owned post');await call(r,'personal.savePreferences',commit({theme:'pink'}));const beforeB=structuredClone((await r.read()).accounts[b.user.id])
 await r.write(s=>{const pair=[a.user.id,b.user.id].sort().join('|');s.social.friendships[pair]={id:pair,users:[a.user.id,b.user.id]};s.social.threads.p5={id:'p5',users:[a.user.id,b.user.id],pair};s.social.messages.a={id:'a',senderId:a.user.id,recipientId:b.user.id,threadId:'p5',kind:'text',body:'A private text'};s.social.messages.b={id:'b',senderId:b.user.id,recipientId:a.user.id,threadId:'p5',kind:'text',body:'B kept original'};return {state:s,result:{}}})
 await call(r,'auth.login',{email:a.user.email,password:'password1'});const p=commit({confirmEmail:a.user.email,confirmed:true});r.beforeWrite=()=>{throw {code:'STORAGE_FAILED'}};await assert.rejects(call(r,'personal.deleteAccount',p),{code:'STORAGE_FAILED'});r.beforeWrite=()=>{};assert.ok((await r.read()).accounts[a.user.id]);assert.ok((await r.read()).content.posts[postA]);await call(r,'personal.deleteAccount',p);assert.equal((await call(r,'personal.deleteAccount',p)).deleted,true)
 const data=await r.read();assert.equal(data.accounts[a.user.id],undefined);assert.equal(data.content.posts[postA],undefined);assert.deepEqual(data.accounts[b.user.id],beforeB);assert.ok(data.content.posts[postB]);assert.equal(data.social.messages.a,undefined);assert.equal(data.social.messages.b.body,'B kept original');assert.ok(data.accounts[TEST_USER_ID]);await assert.rejects(call(r,'auth.login',{email:a.user.email,password:'password1'}),{code:'ACCOUNT_NOT_FOUND'});await call(r,'auth.login',{email:b.user.email,password:'password1'});assert.equal((await call(r,'personal.snapshot')).preferences.theme,'pink')
})
test('P5 fixed account cannot be deleted and corrupt additive state is preserved',async t=>{const r=await make(t);await assert.rejects(call(r,'personal.deleteAccount',commit({confirmEmail:'eluva@gmail.com',confirmed:true})),{code:'TEST_ACCOUNT_READ_ONLY'});await r.write(s=>{s.personal=false;return {state:s,result:{}}});await assert.rejects(call(r,'app.bootstrap'),{code:'STORAGE_CORRUPT'})})

test('P5 real Vue form proxies are snapshotted before IndexedDB commit and cannot mutate stored authority',async t=>{const r=await make(t),before=(await call(r,'personal.snapshot')).user.profile,p=reactive({...before,displayName:'Reactive form',interestIds:['music','books','art']});const saved=await call(r,'personal.saveProfile',commit({profile:p}));assert.equal(saved.user.profile.displayName,'Reactive form');p.displayName='Unsaved again';p.interestIds.pop();assert.equal((await call(r,'app.bootstrap')).user.profile.displayName,'Reactive form');assert.equal((await call(r,'app.bootstrap')).user.profile.interestIds.length,3)})

test('P5 a prepared local failure cannot cross accounts',async t=>{const r=await make(t);await call(r,'personal.simulateFailure',{operation:'savePreferences'});await register(r,'failure-isolation@example.com');await call(r,'personal.savePreferences',commit({theme:'cyan'}));assert.equal((await call(r,'personal.snapshot')).preferences.theme,'cyan')})

test('P5 deleting a post preserves shared image references, then removing the final cover reclaims it',async t=>{
 const r=await make(t),draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});const image=await call(r,'media.import',{draftId,base64:png,mime:'image/png'}),post=(await call(r,'content.publish',commit({draftId,body:'P5 shared image',media:[{id:image.id,kind:'image'}],visibility:{private:false,audience:'everyone',discover:true,profile:true},audienceFilter:'any',tagIds:[]}))).resultId,id=await collection(r)
 await r.write(s=>{s.content.collections[id].coverId=image.id;s.realtime={version:1,calls:{},language:{cached:{entityId:post,ownerId:TEST_USER_ID,text:'Derived text'}}};return {state:s,result:{}}})
 await call(r,'personal.deletePost',commit({id:post}));assert.ok((await call(r,'media.resolve',{id:image.id})).url);assert.equal(Object.values((await r.read()).content.operations).some(x=>x.resultId===post),false);assert.equal((await r.read()).realtime.language.cached,undefined)
 const deletion=commit({id});await call(r,'personal.simulateFailure',{operation:'deleteCollection'});await assert.rejects(call(r,'personal.deleteCollection',deletion),{code:'STORAGE_FAILED'});assert.ok((await call(r,'media.resolve',{id:image.id})).url);await call(r,'personal.deleteCollection',deletion);await assert.rejects(call(r,'media.resolve',{id:image.id}),{code:'MEDIA_MISSING'})
})

test('P5 account deletion removes derived commit copies for removed posts without deleting other authored posts',async t=>{
 const r=await make(t),a=await register(r,'gone@example.com'),post=await publish(r),b=await register(r,'kept@example.com'),kept=await publish(r,'Kept original')
 await r.write(s=>{s.content.operations[b.user.id+':reply']={method:'comment',target:post,resultId:'reply-id',payload:'Sensitive deleted-parent reply copy'};s.content.comments['reply-id']={id:'reply-id',postId:post,authorId:b.user.id,body:'Reply'};return {state:s,result:{}}})
 await call(r,'auth.login',{email:a.user.email,password:'password1'});await call(r,'personal.deleteAccount',commit({confirmed:true,confirmEmail:a.user.email}));const data=await r.read();assert.equal(data.content.operations[b.user.id+':reply'],undefined);assert.equal(data.content.comments['reply-id'],undefined);assert.ok(data.content.posts[kept]);assert.ok(data.accounts[b.user.id])
})

test('P5 logout reclaims only current-owner temporary attachments and preserves official profile and post media',async t=>{
 const r=await make(t),a=await register(r,'logout-a@example.com'),draftId=crypto.randomUUID();await call(r,'content.beginDraft',{draftId});const staged=await call(r,'media.import',{draftId,base64:png,mime:'image/png'}),post=await publish(r,'A kept original');const b=await register(r,'logout-b@example.com'),otherDraft=crypto.randomUUID();await call(r,'content.beginDraft',{draftId:otherDraft});const other=await call(r,'media.import',{draftId:otherDraft,base64:png,mime:'image/png'})
 // P1 profile files predate the committed flag. Their official references must protect them.
 await r.write(async(s,media)=>{for(const photo of a.user.profile.photos){const f=await new Promise(ok=>{const q=media.get(photo.id);q.onsuccess=()=>ok(q.result)});delete f.committed;media.put(f)}return {state:s,result:{}}})
 await call(r,'auth.logout');await call(r,'auth.login',{email:a.user.email,password:'password1'});assert.ok((await call(r,'media.resolve',{id:staged.id})).url);await assert.rejects(call(r,'media.resolve',{id:other.id}),{code:'MEDIA_MISSING'});await call(r,'auth.logout');await call(r,'auth.login',{email:a.user.email,password:'password1'});await assert.rejects(call(r,'media.resolve',{id:staged.id}),{code:'MEDIA_MISSING'});for(const photo of a.user.profile.photos)assert.ok((await call(r,'media.resolve',{id:photo.id})).url);assert.ok((await call(r,'content.snapshot')).posts.some(x=>x.id===post));assert.ok((await r.read()).accounts[b.user.id])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { indexedDB } from 'fake-indexeddb'
import { BrowserRepository } from '../src/services/browser-repository.js'
import { LEGAL_VERSION,TEST_USER_ID } from '../src/domain/validation.js'
import { wavDuration,realtimePolicy } from '../src/domain/realtime.js'
import { VoiceHold } from '../src/services/voice-hold.js'
const call=(r,key,p={})=>{const [service,method]=key.split('.');return r.execute(service,method,p)}
const commit=p=>({commitId:crypto.randomUUID(),...p})
const wav=()=>readFile(new URL('../public/demo/local-voice.wav',import.meta.url))
async function make(t){const r=new BrowserRepository({indexedDB,dbName:'p4-'+crypto.randomUUID()});t.after(()=>r.close());await call(r,'app.bootstrap');await call(r,'preferences.consent',{accepted:true,version:LEGAL_VERSION});await call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'});await call(r,'social.snapshot');return r}
async function voice(r,peer='demo-friend-echo'){const draftId=crypto.randomUUID();await call(r,'social.beginDraft',{peerId:peer,draftId});const media=await call(r,'realtime.importVoice',{draftId,base64:(await wav()).toString('base64')});return {draftId,media}}
test('P4 real WAV validation rejects spoofed/truncated media and out-of-bound audio',async()=>{
 const data=await wav();assert.ok(wavDuration(data)>2);assert.ok(wavDuration(data)<3)
 assert.throws(()=>wavDuration(new Uint8Array(50)),{code:'MEDIA_UNSUPPORTED'});assert.throws(()=>wavDuration(data.subarray(0,100)),{code:'MEDIA_UNSUPPORTED'})
 assert.throws(()=>wavDuration(new Uint8Array(realtimePolicy.voiceMaxBytes+1)),{code:'MEDIA_TOO_LARGE'})
 const short=Buffer.from(data);short.writeUInt32LE(0,40);assert.throws(()=>wavDuration(short),{code:'MEDIA_UNSUPPORTED'})
})
test('P4 voice send is atomic, retry-idempotent and blocked media never remains readable',async t=>{
 const r=await make(t),{draftId,media}=await voice(r),p=commit({peerId:'demo-friend-echo',kind:'voice',body:'',mediaId:media.id,draftId})
 await call(r,'social.simulateFailure',{operation:'send'});await assert.rejects(call(r,'social.send',p),{code:'STORAGE_FAILED'})
 const db=await r.open(),file=()=>new Promise(resolve=>{const q=db.transaction('media').objectStore('media').get(media.id);q.onsuccess=()=>resolve(q.result)})
 assert.ok(!(await file()).committed);const a=await call(r,'social.send',p),b=await call(r,'social.send',p);assert.equal(a.resultId,b.resultId);assert.ok((await file()).committed)
 const sent=a.threads.find(x=>x.peerId==='demo-friend-echo').messages.find(x=>x.id===a.resultId);assert.equal(sent.kind,'voice');assert.ok(sent.duration>2);assert.ok((await call(r,'media.resolve',{id:media.id})).url)
 await call(r,'social.block',{peerId:'demo-friend-echo',blocked:true});await assert.rejects(call(r,'media.resolve',{id:media.id}),{code:'MEDIA_MISSING'});await assert.rejects(call(r,'realtime.playVoice',{messageId:sent.id}),{code:'USER_BLOCKED'})
 await call(r,'social.block',{peerId:'demo-friend-echo',blocked:false});assert.ok((await call(r,'media.resolve',{id:media.id})).url);await call(r,'auth.logout');await assert.rejects(call(r,'media.resolve',{id:media.id}),{code:'MEDIA_MISSING'})
})
test('P4 one peer draft cannot send its recording to a different peer; nonfriends never record',async t=>{
 const r=await make(t),{draftId,media}=await voice(r)
 await assert.rejects(call(r,'social.send',commit({peerId:'demo-friend-notes',kind:'voice',mediaId:media.id,draftId})),{code:'DRAFT_EXPIRED'})
 await assert.rejects(call(r,'social.beginDraft',{peerId:'demo-stranger',draftId:crypto.randomUUID()}),{code:'FRIENDSHIP_REQUIRED'})
 await call(r,'media.remove',{id:media.id,draftId});await assert.rejects(call(r,'media.resolve',{id:media.id}),{code:'MEDIA_MISSING'})
})
test('P4 local call transitions require friendship, deduplicate and survive failure without fake connection',async t=>{
 const r=await make(t),callId=crypto.randomUUID(),p={callId,peerId:'demo-friend-echo',direction:'outgoing'}
 await assert.rejects(call(r,'realtime.createCall',{...p,peerId:'demo-stranger'}),{code:'FRIENDSHIP_REQUIRED'})
 const a=await call(r,'realtime.createCall',p),b=await call(r,'realtime.createCall',p);assert.equal(a.call.id,b.call.id);assert.equal(a.call.state,'ready');assert.equal(a.call.localOnly,true)
 await assert.rejects(call(r,'realtime.prepareCall',{callId}),{code:'DEVICE_UNSUPPORTED'});assert.equal((await call(r,'realtime.call',{callId})).call.startedAt,undefined)
 await assert.rejects(call(r,'realtime.createCall',{...p,peerId:'demo-friend-notes'}),{code:'COMMIT_CONFLICT'});await assert.rejects(call(r,'realtime.createCall',{...p,callId:crypto.randomUUID()}),{code:'CALL_BUSY'})
 await assert.rejects(call(r,'realtime.startCamera',{callId}),{code:'DEVICE_UNSUPPORTED'});assert.equal((await call(r,'realtime.call',{callId})).call.state,'ready')
 const playing=await call(r,'realtime.activateDemo',{callId});assert.equal(playing.call.mode,'fixture');assert.equal(playing.call.state,'active')
 r.beforeWrite=()=>{throw {code:'STORAGE_FAILED'}};await assert.rejects(call(r,'realtime.endCall',{callId,reason:'hangup'}),{code:'STORAGE_FAILED'});r.beforeWrite=()=>{}
 assert.equal((await call(r,'realtime.call',{callId})).call.state,'active');await call(r,'realtime.cancel',{callId,reason:'background'});const ended=await call(r,'realtime.endCall',{callId,reason:'hangup'});assert.equal(ended.call.reason,'background');assert.equal(ended.call.state,'ended');await assert.rejects(call(r,'realtime.activateDemo',{callId}),{code:'CALL_ENDED'})
})
test('P4 blocked calls and language reads preserve original content and reject unavailable system results',async t=>{
 const r=await make(t),callId=crypto.randomUUID();await call(r,'realtime.createCall',{callId,peerId:'demo-friend-echo',direction:'incoming'});const before=(await r.read()).social.messages[TEST_USER_ID+':echo-text'].body
 assert.deepEqual((await call(r,'realtime.languageSnapshot',{type:'message',id:TEST_USER_ID+':echo-text'})).rows,[])
 await assert.rejects(call(r,'realtime.translate',{type:'message',id:TEST_USER_ID+':echo-text',source:'auto',target:'fr'}),{code:'LANGUAGE_UNAVAILABLE'})
 assert.equal((await r.read()).social.messages[TEST_USER_ID+':echo-text'].body,before)
 await call(r,'social.block',{peerId:'demo-friend-echo',blocked:true});await assert.rejects(call(r,'realtime.activateDemo',{callId}),{code:'USER_BLOCKED'});await assert.rejects(call(r,'realtime.languageSnapshot',{type:'message',id:TEST_USER_ID+':echo-text'}),{code:'USER_BLOCKED'})
 await call(r,'realtime.endCall',{callId,reason:'blocked'});const account=(await r.read()).accounts[TEST_USER_ID];assert.equal(account.email,'eluva@gmail.com')
})
test('P7 incoming expiry is atomic, frees the lease and keeps its reason after a late leave',async t=>{
 const r=await make(t),callId=crypto.randomUUID()
 await call(r,'realtime.createCall',{callId,peerId:'demo-friend-echo',direction:'incoming'})
 r.beforeWrite=()=>{throw {code:'STORAGE_FAILED'}}
 await assert.rejects(call(r,'realtime.endCall',{callId,reason:'timeout'}),{code:'STORAGE_FAILED'})
 r.beforeWrite=()=>{}
 assert.equal((await call(r,'realtime.call',{callId})).call.state,'incoming')
 assert.equal((await call(r,'realtime.endCall',{callId,reason:'timeout'})).call.reason,'timeout')
 assert.equal((await call(r,'realtime.endCall',{callId,reason:'left'})).call.reason,'timeout')
 const next=await call(r,'realtime.createCall',{callId:crypto.randomUUID(),peerId:'demo-friend-notes',direction:'incoming'})
 assert.equal(next.call.state,'incoming')
})
test('P4 corrupt additive state is preserved instead of clearing accounts',async t=>{
 const r=await make(t);await r.write(s=>{s.realtime=false;return {state:s,result:{}}});await assert.rejects(call(r,'app.bootstrap'),{code:'STORAGE_CORRUPT'})
 const db=await r.open(),root=await new Promise(resolve=>{const q=db.transaction('state').objectStore('state').get('root');q.onsuccess=()=>resolve(q.result)});assert.ok(root.accounts[TEST_USER_ID])
})
test('P4 release before asynchronous record-start completion cannot produce a voice message',async()=>{
 let release,media=0,stops=0,cancels=0
 const hold=new VoiceHold({call:async(_,method)=>{if(method==='recordStart')await new Promise(r=>release=r);if(method==='recordStop'){stops++;return {}}if(method==='cancel')cancels++;return {recording:true}},media:()=>media++})
 const pending=hold.start({peerId:'peer',draftId:'draft'});hold.release();release();await pending;assert.equal(hold.phase,'idle');assert.equal(media,0);assert.equal(stops,0);assert.equal(cancels,2)
})
test('P4 armed cancellation never sends; repeated release commits one captured recording',async()=>{
 let media=0,stops=0,release
 const hold=new VoiceHold({call:async(_,method)=>{if(method==='recordStop'){stops++;await new Promise(r=>release=r);return {id:'actual-capture'}}return {recording:true,duration:2}},media:()=>media++})
 await hold.start({});hold.arm(true);hold.release();assert.equal(media,0);assert.equal(stops,0)
 await hold.start({});const one=hold.release();hold.release();release();await one;assert.equal(stops,1);assert.equal(media,1);hold.cancel()
})
test('P4 failed voice staging retains the stopped capture for one explicit retry',async()=>{
 let attempts=0,delivered=0
 const hold=new VoiceHold({call:async(_,method)=>{if(method==='recordStop'){if(++attempts===1)throw {code:'STORAGE_FAILED'};return {id:'retained-capture'}}return {recording:true}},media:()=>delivered++})
 await hold.start({});await hold.release();assert.equal(hold.phase,'retry');assert.equal(delivered,0);await hold.finish(true);assert.equal(delivered,1);assert.equal(attempts,2);hold.cancel()
})


test('voice cancellation after a late start targets only the cancelled gesture',async t=>{
 const starts=[],cancels=[],resolvers=[]
 const hold=new VoiceHold({call:async(_,method,p)=>{if(method==='recordStart'){starts.push(p.recordingId);await new Promise(resolve=>resolvers.push(resolve))}if(method==='cancel')cancels.push(p.recordingId);return {recording:true}},media:()=>assert.fail('cancelled recording must not send')})
 t.after(()=>hold.cancel())
 const old=hold.start({peerId:'peer',draftId:'draft'});hold.cancel('background')
 const current=hold.start({peerId:'peer',draftId:'draft'})
 resolvers[0]();await old
 assert.equal(hold.phase,'starting');assert.deepEqual(cancels,[starts[0],starts[0]])
 resolvers[1]();await current;assert.equal(hold.phase,'recording');assert.notEqual(starts[0],starts[1])
})

test('a stopped capture returned after leaving is discarded instead of emitted',async()=>{
 let completeStop,delivered=0;const removed=[]
 const hold=new VoiceHold({call:async(service,method,p)=>{if(method==='recordStop'){await new Promise(resolve=>completeStop=resolve);return {id:'late-media'}}if(service==='media'&&method==='remove')removed.push(p);return {recording:true,duration:2}},media:()=>delivered++})
 await hold.start({peerId:'peer',draftId:'original-draft'})
 const stopping=hold.release();hold.cancel('left');completeStop();await stopping
 assert.equal(delivered,0);assert.equal(hold.phase,'idle');assert.deepEqual(removed,[{id:'late-media',draftId:'original-draft'}])
})

test('the 60-second review draft keeps its review intent when staging is retried',async t=>{
 let attempts=0;const delivered=[]
 const hold=new VoiceHold({call:async(_,method)=>{if(method==='recordStatus')return {recording:false,state:'limit',duration:60,level:1};if(method==='recordStop'){if(++attempts===1)throw {code:'STORAGE_FAILED'};return {id:'limit-media'}}return {}},media:(_,options)=>delivered.push(options)})
 t.after(()=>hold.cancel())
 await hold.start({});await new Promise(resolve=>setImmediate(resolve))
 assert.equal(hold.phase,'retry');assert.deepEqual(delivered,[])
 await hold.finish();assert.deepEqual(delivered,[{send:false}]);assert.equal(attempts,2)
})

test('native interruption restores idle and announces that no recording was sent',async t=>{
 const errors=[],delivered=[]
 const hold=new VoiceHold({call:async(_,method)=>method==='recordStatus'?{recording:false,state:'ended',reason:'interrupted'}:{},error:value=>errors.push(value.code),media:value=>delivered.push(value)})
 t.after(()=>hold.cancel())
 await hold.start({});await new Promise(resolve=>setImmediate(resolve))
 assert.equal(hold.phase,'idle');assert.deepEqual(errors,['RECORDING_INTERRUPTED']);assert.deepEqual(delivered,[])
})

test('recording meter clamps invalid native values and repeated holds own one start',async t=>{
 let starts=0,ready;const changes=[]
 const hold=new VoiceHold({call:async(_,method)=>{if(method==='recordStart'){starts++;await new Promise(resolve=>ready=resolve)}return {recording:true,duration:-3,level:5}},changed:value=>changes.push(value)})
 t.after(()=>hold.cancel())
 const start=hold.start({});await hold.start({});assert.equal(starts,1)
 ready();await start;await new Promise(resolve=>setImmediate(resolve))
 assert.ok(changes.some(value=>value.duration===0&&value.level===1))
})


test('holding over the cancellation target at the recording limit discards the capture',async t=>{
 let completeStatus,stops=0,delivered=0
 const hold=new VoiceHold({call:async(_,method)=>{if(method==='recordStatus'){await new Promise(resolve=>completeStatus=resolve);return {recording:false,state:'limit',duration:60}}if(method==='recordStop')stops++;return {}},media:()=>delivered++})
 t.after(()=>hold.cancel())
 await hold.start({});hold.arm(true);completeStatus();await new Promise(resolve=>setImmediate(resolve))
 assert.equal(hold.phase,'idle');assert.equal(stops,0);assert.equal(delivered,0)
})

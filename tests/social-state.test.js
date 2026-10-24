import test,{beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {nextTick} from 'vue'
globalThis.window={}
const {state,bridge}=await import('../src/state.js')
const {social,loadSocial,resetSocial,socialAction,applySocial}=await import('../src/social-state.js')
const {content,resetContent,applyContent}=await import('../src/content-state.js')
const snapshot=ownerId=>({ownerId,profiles:[],threads:[],requests:[],events:[],unreadCount:0,preferences:{filter:'all',unreadOnly:false}})
beforeEach(async()=>{state.user=null;resetSocial();resetContent();state.ui.busy='';state.ui.error=null;await nextTick();state.user={id:'new-account'};await nextTick()})
async function seedVisibleBlockTarget(){
 state.user=null
 Object.assign(social,{...snapshot('new-account'),loaded:true,profiles:[{id:'peer',displayName:'Peer',photos:[{id:'peer-photo',url:'visible-peer.jpg'}],relationship:{blocked:false,canMessage:true}},{id:'other',displayName:'Other before hydration',photos:[],relationship:{blocked:false}}],threads:[{id:'peer-thread',peerId:'peer',messages:[],unread:3},{id:'safe-thread',peerId:'other',messages:[],unread:2}],requests:[{id:'peer-request',senderId:'peer',recipientId:'new-account',direction:'received',status:'pending'},{id:'safe-request',senderId:'other',recipientId:'new-account',direction:'received',status:'pending'}],events:[{id:'peer-event',peerId:'peer',postId:'peer-post',lightOnly:true,read:false},{id:'post-event',peerId:'other',postId:'peer-post',lightOnly:true,read:false},{id:'safe-event',peerId:'other',postId:'safe-post',lightOnly:true,read:false}],unreadCount:10,profilePosts:[{id:'peer-post',authorId:'peer'},{id:'safe-post',authorId:'other'}],collections:[{id:'peer-collection',ownerId:'peer',postIds:['peer-post']},{id:'shared-collection',ownerId:'other',postIds:['peer-post','safe-post']},{id:'inaccessible-collection',ownerId:'other',postIds:['peer-post']}]})
 Object.assign(content,{ownerId:'new-account',loaded:true,posts:[{id:'peer-post',authorId:'peer'},{id:'safe-post',authorId:'other'}],hiddenPosts:[{id:'earlier-peer-post',authorId:'peer'},{id:'safe-hidden-post',authorId:'other'}],lastHidden:'earlier-peer-post',comments:[{id:'peer-comment',authorId:'peer',postId:'safe-post'},{id:'post-comment',authorId:'other',postId:'peer-post'},{id:'safe-comment',authorId:'other',postId:'safe-post'}],events:[{id:'peer-event',senderId:'peer',postId:'peer-post'},{id:'post-event',senderId:'other',postId:'peer-post'},{id:'safe-event',senderId:'other',postId:'safe-post'}],collections:[{id:'peer-collection',ownerId:'peer',postIds:['peer-post']},{id:'own-collection',ownerId:'new-account',postIds:['peer-post','safe-post']}]})
 await nextTick();state.user={id:'new-account'}
}
function committedBlockSnapshot(){
 return {...snapshot('new-account'),profiles:[{id:'peer',displayName:'Peer',photos:[{id:'peer-photo'}],relationship:{blocked:true,blockedByMe:true,canMessage:false}},{id:'other',displayName:'Other after hydration',photos:[{id:'slow-photo'}],relationship:{blocked:false}}],threads:[{id:'peer-thread',peerId:'peer',messages:[{id:'private-message',mediaId:'peer-media'}],unread:3},{id:'safe-thread',peerId:'other',messages:[],unread:2}],requests:[{id:'peer-request',senderId:'peer',recipientId:'new-account',direction:'received',status:'pending'},{id:'safe-request',senderId:'other',recipientId:'new-account',direction:'received',status:'pending'}],events:[{id:'peer-event',peerId:'peer',postId:'peer-post',lightOnly:true,read:false},{id:'post-event',peerId:'other',postId:'peer-post',lightOnly:true,read:false},{id:'safe-event',peerId:'other',postId:'safe-post',lightOnly:true,read:false}],unreadCount:10,profilePosts:[{id:'peer-post',authorId:'peer'},{id:'safe-post',authorId:'other'}],collections:[{id:'peer-collection',ownerId:'peer',postIds:['peer-post']},{id:'shared-collection',ownerId:'other',postIds:['peer-post','safe-post']},{id:'inaccessible-collection',ownerId:'other',postIds:['peer-post']}]}
}
function committedContentBlockSnapshot(){return {ownerId:'new-account',posts:[{id:'safe-post',authorId:'other',media:[]}],hiddenPosts:[{id:'safe-hidden-post',authorId:'other'}],comments:[{id:'safe-comment',authorId:'other',postId:'safe-post'}],events:[{id:'safe-event',senderId:'other',postId:'safe-post'}],collections:[{id:'own-collection',ownerId:'new-account',postIds:['safe-post']}],blockedAuthors:[{id:'peer',name:'Peer'}],preferences:{guideDone:true,feedFilter:{media:'all',topic:'all'}}}}
function assertSocialBlockProjection(){
 const peer=social.profiles.find(x=>x.id==='peer');assert.equal(peer.relationship.blocked,true);assert.equal(peer.relationship.canMessage,false);assert.deepEqual(peer.photos,[])
 assert.deepEqual(social.threads.map(x=>x.id),['safe-thread']);assert.deepEqual(social.requests.map(x=>x.id),['safe-request']);assert.deepEqual(social.events.map(x=>x.id),['safe-event']);assert.equal(social.unreadCount,4)
 assert.deepEqual(social.profilePosts.map(x=>x.id),['safe-post']);assert.deepEqual(social.collections.map(x=>({id:x.id,postIds:x.postIds})),[{id:'shared-collection',postIds:['safe-post']}])
}
function assertBlockProjection(){
 assert.deepEqual(content.posts.map(x=>x.id),['safe-post']);assert.deepEqual(content.hiddenPosts.map(x=>x.id),['safe-hidden-post']);assert.equal(content.lastHidden,null)
 assert.deepEqual(content.comments.map(x=>x.id),['safe-comment']);assert.deepEqual(content.events.map(x=>x.id),['safe-event'])
 assert.deepEqual(content.collections.map(x=>({id:x.id,postIds:x.postIds})),[{id:'own-collection',postIds:['safe-post']}]);assert.deepEqual(content.blockedAuthors,[{id:'peer',name:'Peer'}])
 assertSocialBlockProjection()
}
test('empty Chats read completes during a global mutation; TabBar and page share one request',async()=>{
 let calls=0,release;bridge.adapter={execute:()=>{calls++;return new Promise(resolve=>release=resolve)}}
 state.ui.busy='auth-complete';const first=loadSocial({quiet:true}),second=loadSocial();assert.equal(first,second)
 await Promise.resolve();release(snapshot('new-account'));assert.equal(await first,true)
 assert.equal(calls,1);assert.equal(social.loaded,true);assert.deepEqual(social.threads,[]);assert.equal(state.ui.busy,'auth-complete')
})
test('a committed block hides cached posts and adds the blacklist even when the follow-up content read fails',async()=>{
 Object.assign(content,{ownerId:'new-account',loaded:true,posts:[{id:'hidden',authorId:'peer'},{id:'safe',authorId:'other'}],hiddenPosts:[{id:'hidden-earlier',authorId:'peer'},{id:'other-hidden',authorId:'other'}],lastHidden:'hidden-earlier',events:[{id:'event',senderId:'peer',postId:'hidden'}],collections:[{id:'mine',ownerId:'new-account',postIds:['hidden','safe']}]})
 const blocked={...snapshot('new-account'),profiles:[{id:'peer',displayName:'Peer',photos:[],relationship:{blocked:true,blockedByMe:true}}],threads:[{id:'thread',peerId:'peer',messages:[]}],requests:[{id:'request',senderId:'peer',recipientId:'new-account'}]}
 bridge.adapter={execute:async(service)=>{if(service==='content')throw {code:'STORAGE_FAILED'};return structuredClone(blocked)}}
 assert.equal(await socialAction('block',{peerId:'peer',blocked:true},{notice:''}),true)
 assert.deepEqual(content.posts.map(x=>x.id),['safe']);assert.deepEqual(content.collections[0].postIds,['safe']);assert.deepEqual(content.events,[])
 assert.deepEqual(content.blockedAuthors,[{id:'peer',name:'Peer'}]);assert.deepEqual(social.threads,[]);assert.deepEqual(social.requests,[])
 assert.deepEqual(content.hiddenPosts.map(x=>x.id),['other-hidden']);assert.equal(content.lastHidden,null)
 assert.equal(state.ui.error,'STORAGE_FAILED')
})
test('a committed block projects every cached view before an unrelated avatar resolves, then finishes hydration without deleting history',async()=>{
 await seedVisibleBlockTarget()
 const stored=committedBlockSnapshot(),releases=[],resolved=[];let held=true
 bridge.adapter={execute:async(service,method,params)=>{
  if(service==='social')return structuredClone(stored)
  assert.equal(service+'.'+method,'media.resolve');assert.equal(params.id,'slow-photo','blocked profile and chat media must never be resolved');resolved.push(params.id)
  if(held)await new Promise(resolve=>releases.push(resolve))
  return {url:'resolved-other.jpg'}
 }}
 const pending=applySocial(structuredClone(stored))
 // No await: the committed safety boundary precedes even the first media call.
 assertBlockProjection();assert.equal(social.profiles.find(x=>x.id==='other').displayName,'Other before hydration')
 await Promise.resolve();assert.ok(releases.length);assertBlockProjection()
 held=false;for(const release of releases)release()
 await pending;await loadSocial({quiet:true});assertBlockProjection()
 assert.equal(social.profiles.find(x=>x.id==='other').displayName,'Other after hydration');assert.equal(social.profiles.find(x=>x.id==='other').photos[0].url,'resolved-other.jpg')
 assert.ok(resolved.length);assert.equal(stored.profiles[0].photos[0].id,'peer-photo');assert.equal(stored.threads[0].messages[0].id,'private-message');assert.equal(stored.profilePosts[0].id,'peer-post')
})
test('a failed block write leaves every visible cache and profile untouched until the repository commits',async()=>{
 await seedVisibleBlockTarget()
 const before=JSON.stringify({social,content});let rejectWrite
 bridge.adapter={execute:async(service,method)=>{assert.equal(service+'.'+method,'social.block');await new Promise((resolve,reject)=>rejectWrite=reject)}}
 const pending=socialAction('block',{peerId:'peer',blocked:true},{notice:''})
 await Promise.resolve();assert.equal(JSON.stringify({social,content}),before)
 rejectWrite({code:'STORAGE_FAILED'});assert.equal(await pending,false);assert.equal(state.ui.error,'STORAGE_FAILED');assert.equal(JSON.stringify({social,content}),before)
})
test('a committed content block prunes social caches synchronously while its social read is held; a missing blacklist row never unblocks',async()=>{
 await seedVisibleBlockTarget()
 const stored=committedBlockSnapshot();stored.profiles[1].photos=[]
 let release
 bridge.adapter={execute:async(service,method)=>{assert.equal(service+'.'+method,'social.snapshot');return new Promise(resolve=>release=()=>resolve(structuredClone(stored)))}}
 const pending=applyContent(committedContentBlockSnapshot())
 assert.equal(social.profiles.find(x=>x.id==='peer').relationship.blocked,true);assert.deepEqual(social.profiles.find(x=>x.id==='peer').photos,[])
 assert.deepEqual(social.threads.map(x=>x.id),['safe-thread']);assert.deepEqual(social.requests.map(x=>x.id),['safe-request']);assert.deepEqual(social.events.map(x=>x.id),['safe-event']);assert.equal(social.unreadCount,4)
 assert.deepEqual(social.profilePosts.map(x=>x.id),['safe-post']);assert.deepEqual(social.collections.map(x=>x.id),['shared-collection']);assert.deepEqual(social.collections[0].postIds,['safe-post'])
 await pending;await Promise.resolve();assert.equal(typeof release,'function')
 content.blockedAuthors=[];assert.equal(social.profiles.find(x=>x.id==='peer').relationship.blocked,true);assert.deepEqual(social.threads.map(x=>x.id),['safe-thread'])
 release();await loadSocial({quiet:true});assert.equal(social.profiles.find(x=>x.id==='peer').relationship.blocked,true)
})
test('content blocking invalidates a pre-commit social read whose old avatar resolves late, then hydrates a fresh authoritative snapshot',async()=>{
 await seedVisibleBlockTarget()
 const old=committedBlockSnapshot(),fresh=committedBlockSnapshot();old.profiles[0].relationship={blocked:false,canMessage:true};old.profiles[1].photos=[];fresh.profiles[1].photos=[]
 let releasePhoto,releaseFresh,mediaStarted,freshStarted,reads=0
 const enteredMedia=new Promise(resolve=>mediaStarted=resolve),enteredFresh=new Promise(resolve=>freshStarted=resolve)
 bridge.adapter={execute:async(service,method,params)=>{
  if(service==='social'){assert.equal(method,'snapshot');if(++reads===1)return structuredClone(old);freshStarted();return new Promise(resolve=>releaseFresh=()=>resolve(structuredClone(fresh)))}
  assert.equal(service+'.'+method,'media.resolve');assert.equal(params.id,'peer-photo');mediaStarted();return new Promise(resolve=>releasePhoto=()=>resolve({url:'stale-peer.jpg'}))
 }}
 const pending=loadSocial();await enteredMedia
 await applyContent(committedContentBlockSnapshot());assertSocialBlockProjection()
 assert.equal(await pending,false);await enteredFresh
 releasePhoto();await Promise.resolve();assertSocialBlockProjection()
 releaseFresh();assert.equal(await loadSocial({quiet:true}),true);assertSocialBlockProjection();assert.equal(social.profiles.find(x=>x.id==='other').displayName,'Other after hydration')
 assert.equal(state.ui.error,null);assert.deepEqual(content.blockedAuthors,[{id:'peer',name:'Peer'}])
})
test('a late direct social hydrate is also rejected after a committed content block changes the safety boundary',async()=>{
 await seedVisibleBlockTarget()
 const old=committedBlockSnapshot(),fresh=committedBlockSnapshot();old.profiles[0].relationship={blocked:false,canMessage:true};old.profiles[1].photos=[];fresh.profiles[1].photos=[]
 let releasePhoto,mediaStarted
 const enteredMedia=new Promise(resolve=>mediaStarted=resolve)
 bridge.adapter={execute:async(service,method,params)=>{if(service==='social')return structuredClone(fresh);assert.equal(service+'.'+method,'media.resolve');assert.equal(params.id,'peer-photo');mediaStarted();return new Promise(resolve=>releasePhoto=()=>resolve({url:'stale-peer.jpg'}))}}
 const pending=applySocial(structuredClone(old));await enteredMedia
 await applyContent(committedContentBlockSnapshot());assertSocialBlockProjection()
 releasePhoto();await assert.rejects(pending,{code:'CANCELLED'});await loadSocial({quiet:true});assertSocialBlockProjection();assert.equal(state.ui.error,null)
})
test('cancelled or foreign-owner snapshots cannot project a block into the active account',async()=>{
 await seedVisibleBlockTarget()
 const before=JSON.stringify({social,content});let calls=0
 bridge.adapter={execute:async()=>{calls++;assert.fail('rejected snapshots must not hydrate media')}}
 const cancelled=new AbortController();cancelled.abort()
 await assert.rejects(applySocial(committedBlockSnapshot(),cancelled.signal),{code:'CANCELLED'})
 await applySocial({...committedBlockSnapshot(),ownerId:'other-account'})
 assert.equal(calls,0);assert.equal(JSON.stringify({social,content}),before)
})
test('a failed empty-account read ends with an error; retry becomes a successful empty snapshot',async()=>{
 bridge.adapter={execute:async()=>{throw {code:'STORAGE_FAILED'}}};assert.equal(await loadSocial(),false);assert.equal(social.loaded,false);assert.equal(social.loadError,'STORAGE_FAILED')
 bridge.adapter={execute:async()=>snapshot('new-account')};assert.equal(await loadSocial(),true);assert.equal(social.loaded,true);assert.equal(social.loadError,'');assert.equal(state.ui.error,null)
})
test('reset and account switch discard an old pending snapshot and allow the new empty account to load',async()=>{
 let release;bridge.adapter={execute:()=>new Promise(resolve=>release=resolve)}
 const old=loadSocial();await Promise.resolve();state.user={id:'other-account'};resetSocial()
 bridge.adapter={execute:async()=>snapshot('other-account')};assert.equal(await loadSocial(),true);release(snapshot('new-account'));assert.equal(await old,false);assert.equal(social.ownerId,'other-account');assert.deepEqual(social.threads,[])
})

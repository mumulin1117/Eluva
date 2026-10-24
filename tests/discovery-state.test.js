import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defaultFeedFilter, defaultVisibility, feedPosts, discoveryBatch, discoveryBatchLimit } from '../src/domain/content.js'

globalThis.window = {}
const { state, bridge, cancelTransient, saveLocale } = await import('../src/state.js')
const { content, resetContent, applyContent, loadContent, discovered, hasDiscoverablePosts, refreshContent, mutateContent } = await import('../src/content-state.js')
const owner = 'discovery-owner'
const posts = Array.from({length:10}, (_,i) => ({id:'post-'+i,createdAt:new Date(Date.UTC(2026,9,19,12-i)).toISOString(),authorId:'discovery-peer',body:'Moment '+i,visibility:defaultVisibility(),media:i%2?[{id:'image-'+i,kind:'image',asset:'images/default-avatar.png'}]:[],tagIds:i<3?['art']:['music']}))
const snapshot = (overrides={}) => structuredClone({ownerId:owner,posts,collections:[],comments:[],events:[],preferences:{guideDone:true,feedFilter:defaultFeedFilter()},...overrides})
const ids = batch => batch.map(x=>x.id)

beforeEach(() => { resetContent();state.user={id:owner};state.ui.error=null;state.ui.notice='';state.locale='en' })

test('content reads hydrate data without opening or restarting the Home guide, including resumed and quiet reads', async t => {
  const original=bridge.call;t.after(()=>{bridge.call=original})
  bridge.call=async()=>snapshot({preferences:{guideDone:false,feedFilter:defaultFeedFilter()}})
  assert.equal(await loadContent(),true)
  assert.equal(content.loaded,true);assert.equal(content.preferences.guideDone,false)
  assert.equal(content.guideStep,null,'Home must first finish its real presentation')
  content.guideStep=2
  assert.equal(await loadContent(),true);assert.equal(content.guideStep,2,'return reads do not restart a pending guide')
  assert.equal(await loadContent({quiet:true}),true);assert.equal(content.guideStep,2)
  assert.equal(content.preferences.guideDone,false,'only explicit completion or skip saves completion')
})

test('failed, cancelled and late-account content reads never open a first-use guide', async t => {
  const original=bridge.call;t.after(()=>{bridge.call=original})
  await applyContent(snapshot({preferences:{guideDone:false,feedFilter:defaultFeedFilter()}}))
  bridge.call=async()=>{throw {code:'STORAGE_FAILED'}}
  assert.equal(await loadContent(),false);assert.equal(content.loaded,true);assert.equal(content.guideStep,null)
  let release
  bridge.call=async()=>{await new Promise(resolve=>{release=resolve});return snapshot({preferences:{guideDone:false,feedFilter:defaultFeedFilter()}})}
  let read=loadContent();cancelTransient();release();assert.equal(await read,false);assert.equal(content.guideStep,null)
  read=loadContent();state.user={id:'another-account'};resetContent();release();await read
  assert.equal(content.ownerId,null);assert.equal(content.loaded,false);assert.equal(content.guideStep,null)
})

test('discovery applies filters before the five-post cap, wraps without duplicates, and leaves full data intact', () => {
  assert.equal(discoveryBatchLimit,5)
  const original=JSON.stringify(posts),first=discoveryBatch(posts),second=discoveryBatch(posts,defaultFeedFilter(),{afterId:first.at(-1).id})
  assert.deepEqual(ids(first),['post-0','post-1','post-2','post-3','post-4'])
  assert.deepEqual(ids(second),['post-5','post-6','post-7','post-8','post-9'])
  assert.deepEqual(ids(discoveryBatch(posts,defaultFeedFilter(),{afterId:second.at(-1).id})),ids(first))
  assert.deepEqual(ids(discoveryBatch(posts,{media:'image',topic:'art'})),['post-1'])
  assert.deepEqual(discoveryBatch(posts,{media:'video',topic:'art'}),[])
  assert.deepEqual(ids(discoveryBatch(posts.slice(0,3))),['post-0','post-1','post-2'])
  const wrapped=discoveryBatch(posts.slice(0,7),defaultFeedFilter(),{afterId:'post-4'})
  assert.deepEqual(ids(wrapped),['post-5','post-6','post-0','post-1','post-2'])
  assert.equal(new Set(ids(wrapped)).size,5)
  assert.equal(JSON.stringify(posts),original)
})

test('private and non-discoverable posts stay out; equal timestamps use stable IDs across snapshot order', () => {
  const hidden=[{...posts[0],visibility:{...defaultVisibility(),private:true}},{...posts[1],visibility:{...defaultVisibility(),discover:false}},...posts.slice(2)]
  assert.deepEqual(ids(discoveryBatch(hidden)),['post-2','post-3','post-4','post-5','post-6'])
  const tied=posts.map(p=>({...p,createdAt:posts[0].createdAt}))
  assert.deepEqual(ids(discoveryBatch(tied)),ids(discoveryBatch([...tied].reverse())))
})

test('discovery excludes the viewer before the cap and cursor, without removing their posts from readable data', async () => {
  const own=posts.slice(0,7).map((p,i)=>({...p,id:'own-'+i,authorId:owner,createdAt:'2026-10-24T12:00:00.000Z'})),mixed=[...own,...posts]
  const first=discoveryBatch(mixed,defaultFeedFilter(),{viewerId:owner,startId:own[0].id})
  assert.deepEqual(ids(first),ids(posts.slice(0,5)))
  assert.deepEqual(ids(discoveryBatch(mixed,defaultFeedFilter(),{viewerId:owner,afterId:first.at(-1).id})),ids(posts.slice(5)))
  assert.deepEqual(ids(feedPosts(mixed,{media:'image',topic:'art'},{viewerId:owner})),['post-1'])
  await applyContent(snapshot({posts:mixed}))
  assert.deepEqual(ids(discovered()),ids(first));assert.equal(hasDiscoverablePosts(),true)
  assert.equal(content.posts.length,17);assert.equal(content.posts.filter(p=>p.authorId===owner).length,7)
})

test('own-only successful reads are empty discovery, including filters; account changes cannot reuse cached candidates', async () => {
  const own=posts.map(p=>({...p,authorId:owner}))
  await applyContent(snapshot({posts:own,preferences:{guideDone:true,feedFilter:{media:'video',topic:'all'}}}))
  assert.equal(content.loaded,true);assert.deepEqual(discovered(),[]);assert.equal(hasDiscoverablePosts(),false)
  assert.equal(content.posts.length,10)
  state.user={id:'another-account'}
  assert.deepEqual(discovered(),[]);assert.equal(hasDiscoverablePosts(),false)
  await applyContent(snapshot({ownerId:state.user.id,posts:[...own,{...posts[0],id:'other-own',authorId:state.user.id}]}))
  assert.deepEqual(ids(discovered()),ids(posts.slice(0,5)))
  assert.equal(hasDiscoverablePosts(),true)
})

test('publishing and returning keep the peer batch and position, and refresh failure never restores own posts', async t => {
  await applyContent(snapshot())
  const original=bridge.call;t.after(()=>{bridge.call=original})
  bridge.call=async()=>snapshot();await refreshContent()
  content.feedScroll=210;content.feedPresentation={key:'all:all',ids:ids(discovered())}
  const presentation=structuredClone({ ...content.feedPresentation,ids:[...content.feedPresentation.ids] })
  const own={...posts[0],id:'published-own',authorId:owner,createdAt:'2026-10-24T12:00:00.000Z'}
  await applyContent(snapshot({posts:[own,...posts]}))
  assert.deepEqual(ids(discovered()),ids(posts.slice(5)));assert.equal(content.feedScroll,210)
  assert.deepEqual(content.feedPresentation,presentation);assert.ok(content.posts.some(p=>p.id===own.id))
  bridge.call=async()=>{throw {code:'STORAGE_FAILED'}}
  assert.equal(await refreshContent(),false);assert.deepEqual(ids(discovered()),ids(posts.slice(5)));assert.equal(content.feedScroll,210)
  bridge.call=async()=>snapshot({posts:[own,...posts]})
  assert.equal(await refreshContent(),true);assert.deepEqual(ids(discovered()),ids(posts.slice(0,5)))
})

test('refresh reads authoritative data once, advances only on success, and keeps failure inputs and scroll for retry', async t => {
  await applyContent(snapshot());content.feedScroll=240
  const original=bridge.call;t.after(()=>{bridge.call=original})
  let calls=0,fail=true
  bridge.call=async(service,method)=>{calls++;assert.equal(service+'.'+method,'content.snapshot');if(fail)throw {code:'STORAGE_FAILED'};return snapshot()}
  assert.equal(await refreshContent(),false)
  assert.equal(state.ui.error,'STORAGE_FAILED');assert.equal(content.feedScroll,240);assert.equal(content.feedStartId,null)
  assert.deepEqual(ids(discovered()),ids(posts.slice(0,5)))
  fail=false;assert.equal(await refreshContent(),true)
  assert.deepEqual(ids(discovered()),ids(posts.slice(5)));assert.equal(content.feedScroll,0);assert.equal(content.posts.length,10)
  assert.equal(await refreshContent(),true);assert.deepEqual(ids(discovered()),ids(posts.slice(0,5)))
  assert.equal(calls,3);assert.equal(state.ui.busy,'')
})

test('rapid refreshes do not queue; cancelled or stale-account results cannot replace the current group', async t => {
  await applyContent(snapshot())
  const original=bridge.call;t.after(()=>{bridge.call=original})
  let release,calls=0
  bridge.call=async()=>{calls++;await new Promise(resolve=>{release=resolve});return snapshot()}
  let pending=refreshContent();assert.equal(state.ui.busy,'content-refresh')
  assert.equal(await refreshContent(),false);assert.equal(calls,1)
  cancelTransient();release();assert.equal(await pending,false);assert.equal(content.feedStartId,null)
  pending=refreshContent();state.user={id:'another-account'};resetContent();release()
  assert.equal(await pending,false);assert.equal(content.ownerId,null);assert.deepEqual(discovered(),[])
})

test('language, draft, reaction and detail snapshots retain the group; successful filter changes select the first matching group', async t => {
  await applyContent(snapshot())
  const original=bridge.call;t.after(()=>{bridge.call=original})
  bridge.call=async(service)=>service==='preferences'?{locale:'fr'}:snapshot()
  globalThis.document={documentElement:{lang:'en'}}
  await refreshContent();content.feedScroll=120;content.draft={ownerId:owner,body:'Keep my draft'}
  await saveLocale('fr');await applyContent(snapshot({posts:posts.map(p=>({...p,lit:true,commentCount:1}))}))
  assert.deepEqual(ids(discovered()),ids(posts.slice(5)));assert.equal(content.feedScroll,120);assert.equal(content.draft.body,'Keep my draft')
  assert.equal(discovered()[0].commentCount,1)
  bridge.call=async()=>{throw {code:'STORAGE_FAILED'}}
  assert.equal(await mutateContent('preferences',{feedFilter:{media:'image',topic:'art'}}),false)
  assert.deepEqual(ids(discovered()),ids(posts.slice(5)));assert.equal(content.feedScroll,120)
  await applyContent(snapshot({preferences:{guideDone:true,feedFilter:{media:'image',topic:'art'}}}))
  assert.deepEqual(ids(discovered()),['post-1']);assert.equal(content.feedScroll,0);assert.equal(content.feedStartId,null)
  bridge.call=async()=>snapshot({preferences:{guideDone:true,feedFilter:{media:'video',topic:'all'}}})
  assert.equal(await refreshContent(),true);assert.deepEqual(discovered(),[]);assert.equal(content.feedStartId,null)
  resetContent();assert.equal(content.feedStartId,null);assert.deepEqual(discovered(),[])
})

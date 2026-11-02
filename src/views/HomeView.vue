<script setup>
import { computed,onMounted,onBeforeUnmount,nextTick,ref,watch } from 'vue'
import { router } from '../router.js'
import { state,t,canNavigate } from '../state.js'
import { content,loadContent,refreshContent,discovered,hasDiscoverablePosts,mutateContent,newPostDraft,dirtyPost } from '../content-state.js'
import { defaultFeedFilter } from '../domain/content.js'
import { choices } from '../data/choices.js'
import ContentShell from '../components/ContentShell.vue'
import AppTabBar from '../components/AppTabBar.vue'
import AppModal from '../components/AppModal.vue'
import HomeHelpModal from '../components/HomeHelpModal.vue'
import HomeEmptyPanel from '../components/HomeEmptyPanel.vue'
import '../home-empty.css'
import ActionButton from '../components/ActionButton.vue'
import PostCard from '../components/PostCard.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import HomeLandscape from '../components/HomeLandscape.vue'
import { DiscoveryPresentation } from '../services/discovery-presentation.js'
import { layoutDiscoverySignals,signalColor } from '../services/discovery-signals.js'
import { paintLoading } from '../services/loading-presentation.js'
import '../home-discovery-motion.css'
import '../home-filter-motion.css'
const hasDiscoverable=computed(hasDiscoverablePosts)
const ready=computed(()=>content.loaded&&content.ownerId===state.user?.id)
const retainedFeed=ref(null)
const sourcePosts=computed(()=>retainedFeed.value||discovered())
const empty=computed(()=>ready.value&&sourcePosts.value.length===0)
const filteredEmpty=computed(()=>empty.value&&hasDiscoverable.value)
const enteringComposer=ref(false),refreshFeedback=ref(''),readOperation=ref(''),readPending=ref(!ready.value)
const map=ref(null),filterPhase=ref('closed'),helpOpen=ref(false),filter=ref(defaultFeedFilter())
const filterOpen=computed(()=>filterPhase.value!=='closed')
const guideOpen=ref(false),entryReadSucceeded=ref(false)
const openingId=ref('')
let openingCard=null,directOpening=false
const guideTargets=computed(()=>[sourcePosts.value.length?'.share-island':'.home-empty-panel',sourcePosts.value.length?'.discovery-panel':'.resonance-group','.share-island','.eluva-tabs'])
const motion=ref({phase:'idle',items:[],activeId:null,litIds:[],busy:false}),pagePaused=ref(document.hidden||document.documentElement.dataset.launchCovered==='true'),inView=ref(true)
const motionPaused=computed(()=>pagePaused.value||!inView.value||!!openingId.value)
const arrival=ref(null)
const glowingIds=ref([]),beaconPositions=ref([]),glows=new Map()
let signalLayoutSize=''
const feedKey=computed(()=>[state.user?.id,content.preferences.feedFilter?.media,content.preferences.feedFilter?.topic,content.feedStartId].join('|'))
const posts=computed(()=>{const available=new Map(sourcePosts.value.map(post=>[post.id,post]));return motion.value.items.map(post=>available.get(post.id)).filter(Boolean)})
const readErrorKey=computed(()=>readOperation.value==='refresh'?'p2.refreshFailed':readOperation.value==='load'?'p2.loadFailed':undefined)
const discovering=computed(()=>motion.value.busy||readPending.value)
const beacons=computed(()=>sourcePosts.value.filter(post=>motion.value.litIds.includes(post.id)).map(post=>({post,index:sourcePosts.value.findIndex(x=>x.id===post.id)})))
function signalStyle(id){const index=Math.max(0,sourcePosts.value.findIndex(post=>post.id===id));return {'--signal-color':signalColor(index),'--beacon-hue':index*8+'deg'}}
function countLabel(n){return t(n===1?'p2.resonanceCountOne':'p2.resonanceCount',{n})}
const sourceSignature=computed(()=>[feedKey.value,...sourcePosts.value.map(post=>post.id)].join('|'))
let generation=0,disposed=false,modalObserver,intersectionObserver,presentationOwner=state.user?.id,presentedSource='',filterFrame,filterTimer
const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)')
const presentation=new DiscoveryPresentation({stepMs:1000,settleMs:1000,changed(value){
 if(disposed)return
 if(value.phase==='searching'){clearGlows();signalLayoutSize=''}
 clearArrival()
 motion.value=value
 if(!value.busy&&ready.value&&state.user?.id===presentationOwner)content.feedPresentation={key:feedKey.value,ids:value.items.map(post=>post.id)}
 if(value.phase==='revealing'||value.phase==='settling')nextTick(async()=>{
  if(disposed||openingCard||!motion.value.busy||motion.value.activeId!==value.activeId)return
  positionSignals();await nextTick()
  if(disposed||openingCard||!motion.value.busy||motion.value.activeId!==value.activeId)return
  const list=feedElement();if(!list)return
  list.scrollLeft=0;content.feedScroll=0
  startArrival(value.activeId)
 })
}})
presentation.reduceMotion(motionQuery.matches)
function restoredPosts(){
 const cache=content.feedPresentation,available=new Map(sourcePosts.value.map(post=>[post.id,post]))
 return cache?.key===feedKey.value?[...cache.ids.map(id=>available.get(id)).filter(Boolean),...sourcePosts.value.filter(post=>!cache.ids.includes(post.id))]:sourcePosts.value
}
function syncPresentation(){presentationOwner=state.user?.id;presentedSource=sourceSignature.value;presentation.hydrate(restoredPosts())}
// Walk the batch from back to front so each new signal prepends its card,
// while the finished list keeps the existing recommendation/publication order.
function presentResult(token){presentationOwner=state.user?.id;presentedSource=sourceSignature.value;presentation.resolve([...sourcePosts.value].reverse(),{token})}
function feedElement(){return document.querySelector('.home-shell .discovery-list')}
function cancelCardOpen(){
 const pending=openingCard;if(!pending){retainedFeed.value=null;return}
 openingCard=null;openingId.value='';pending.animation?.cancel()
 retainedFeed.value=null
 presentation.hold('card-open',false)
}
function availableCard(post){
 if(openingCard||directOpening||disposed||router.currentRoute.value.name!=='home'||!ready.value||state.ui.busy||!canNavigate()||pagePaused.value||guideOpen.value||helpOpen.value||filterOpen.value||!posts.value.some(x=>x.id===post.id))return
 const card=[...feedElement()?.children||[]].find(x=>x.dataset.postId===post.id)
 if(!card?.isConnected||getComputedStyle(card).visibility==='hidden')return
 return card
}
async function openPost(post){
 if(!availableCard(post))return
 directOpening=true
 try{await router.push({name:'post',params:{id:post.id},query:{from:'/home'}})}
 finally{directOpening=false}
}
async function openLightUp(post){await openPost(post)}
function positionSignals(){
 const shell=document.querySelector('.home-shell'),area=shell?.querySelector('.discovery-beacons')?.getBoundingClientRect()
 if(!area)return
 const key=area.width+'|'+area.height;if(signalLayoutSize===key)return
 // Reserve the whole count row so singular/plural and French copy cannot move
 // the already lit lamps or grow underneath them during this batch.
 const avoid=[...shell.querySelectorAll('.share-island,.resonance-orbits>img,.resonance-count')].map(element=>{const r=element.getBoundingClientRect();return {x:element.matches('.resonance-count')?0:r.left-area.left,y:r.top-area.top,width:element.matches('.resonance-count')?area.width:r.width,height:r.height}})
 beaconPositions.value=layoutDiscoverySignals({width:area.width,height:area.height,avoid})
 signalLayoutSize=key
}
function clearGlows(){for(const value of glows.values()){value.animation.cancel();value.flight?.cancel()}glows.clear();glowingIds.value=[]}
function startGlow(card,id){
 const color=signalStyle(id)['--signal-color'],base=getComputedStyle(card).boxShadow
 const frames=[{offset:0,boxShadow:`0 0 5px 1px #fff5dc, 0 0 12px 2px ${color}, inset 0 0 5px ${color}`},{offset:.2,boxShadow:`0 0 9px 2px #fffbed, 0 0 25px 7px ${color}, inset 0 0 12px 1px ${color}`},{offset:.55,boxShadow:`0 0 7px 1px #fff9e3, 0 0 19px 4px ${color}, inset 0 0 8px ${color}`},{offset:1,boxShadow:base}]
 const animation=card.animate(frames,{duration:2000,easing:'ease-in-out',fill:'none'}),record={animation,frames}
 animation.id='discovery-glow-'+id;glows.set(id,record);glowingIds.value=[...glows.keys()]
 if(motionPaused.value)animation.pause()
 animation.finished.then(()=>{if(glows.get(id)!==record)return;glows.delete(id);glowingIds.value=[...glows.keys()]},()=>{})
 return record
}
// A visual copy travels above the scroll container; the actual keyed card stays
// in the real flex layout so older cards can move right without clipping the fall.
function startArrival(id){
 if(!id||motionQuery.matches||disposed)return
 const shell=document.querySelector('.home-shell'),main=shell?.querySelector('.page-content')
 const lamp=[...shell?.querySelectorAll('.discovery-beacon')||[]].find(x=>x.dataset.postId===id)
 const card=[...feedElement()?.children||[]].find(x=>x.dataset.postId===id),post=posts.value.find(x=>x.id===id)
 if(!main||!lamp||!card||!post)return
 const origin=lamp.getBoundingClientRect(),target=card.getBoundingClientRect(),bounds=main.getBoundingClientRect(),root=shell.getBoundingClientRect()
 // A refreshed batch may reuse an old keyed card that is still FLIP-moving.
 // Land in the first layout slot, never in that card's transient visual rect.
 const list=feedElement(),listBounds=list.getBoundingClientRect(),listStyle=getComputedStyle(list)
 const landing={left:listBounds.left+parseFloat(listStyle.paddingLeft),top:listBounds.top+parseFloat(listStyle.paddingTop),width:target.width,height:target.height}
 if(!target.width||!target.height||origin.bottom<bounds.top||origin.top>bounds.bottom||target.top>=bounds.bottom)return
 const glow=startGlow(card,id)
 arrival.value={id,post,stage:{left:bounds.left-root.left+'px',top:bounds.top-root.top+'px',width:bounds.width+'px',height:bounds.height+'px'},card:{left:landing.left-bounds.left+'px',top:landing.top-bounds.top+'px',width:landing.width+'px',height:landing.height+'px','--fall-x':origin.left+origin.width/2-landing.left-landing.width/2+'px','--fall-y':origin.top+origin.height/2-landing.top-landing.height/2+'px'}}
 nextTick(()=>{
  if(disposed||arrival.value?.id!==id||glows.get(id)!==glow)return
  const copy=document.querySelector('.home-shell .discovery-flight-card');if(!copy)return
  const animation=copy.animate(glow.frames,{duration:2000,easing:'ease-in-out',fill:'none'});animation.id='discovery-glow-flight-'+id
  animation.currentTime=glow.animation.currentTime||0;glow.flight=animation
  animation.finished.catch(()=>{});if(motionPaused.value)animation.pause()
 })
}
function finishArrival(event){if(event.target===event.currentTarget)clearArrival()}
function removeCard(_element,done){done()}
function clearArrival(){const glow=glows.get(arrival.value?.id);if(glow?.flight){glow.flight.cancel();glow.flight=undefined}arrival.value=null}
function clearDecorations(){cancelCardOpen();clearArrival();clearGlows()}
function pageScroll(event){
 const main=document.querySelector('.home-shell .page-content');if(event.target!==main)return
 const pending=openingCard,previous=pending?.scroll,next={height:main.scrollHeight,top:main.scrollTop}
 // Clearing a failed-save banner can shrink the scroll range and clamp the
 // existing offset. That layout correction is not a new navigation intent.
 const layoutCorrection=previous&&next.height!==previous.height&&(
  Math.abs(next.top-Math.max(0,Math.min(previous.top,next.height-main.clientHeight)))<1||
  Math.abs(next.top-(previous.top+next.height-previous.height))<1)
 if(pending)pending.scroll=next
 if(!layoutCorrection)cancelCardOpen()
 clearArrival();clearGlows()
}
// CSS animations respect the paused flag. TransitionGroup's FLIP transitions
// also need pausing while help/background/offscreen holds the presentation.
watch(motionPaused,paused=>{nextTick(()=>{document.querySelectorAll('.home-shell .discovery-cards-move').forEach(card=>card.getAnimations().forEach(animation=>{if(animation.transitionProperty!=='transform'||animation.playState==='finished'||animation.playState==='idle')return;if(paused)animation.pause();else animation.play()}));for(const glow of glows.values())for(const animation of [glow.animation,glow.flight].filter(Boolean)){if(animation.playState==='finished'||animation.playState==='idle')continue;if(paused)animation.pause();else animation.play()}})})
watch(sourceSignature,()=>{
 clearDecorations()
 if(!ready.value)return
 if(motion.value.busy&&motion.value.phase!=='searching'&&presentedSource!==sourceSignature.value)presentation.finish()
 if(!motion.value.busy)syncPresentation()
})
async function restoreFeed(){await nextTick();if(feedElement())feedElement().scrollLeft=content.feedScroll}
function syncPause(){
 pagePaused.value=document.hidden||document.documentElement.dataset.launchCovered==='true'||!!document.getElementById('app')?.hasAttribute('inert')
 if(pagePaused.value)cancelCardOpen()
 presentation.hold('page',pagePaused.value)
}
function reducedMotion(){clearDecorations();presentation.reduceMotion(motionQuery.matches)}
// Discovery's business clock becomes idle before the final card's two-second
// glow ends. Wait for the actual decorations too, never a guessed timeout.
const guideCanOpen=computed(()=>!guideOpen.value&&!content.preferences.guideDone&&ready.value&&entryReadSucceeded.value&&!readPending.value&&!readOperation.value&&!motion.value.busy&&!arrival.value&&!glowingIds.value.length&&!motionPaused.value&&!helpOpen.value&&!filterOpen.value&&!enteringComposer.value&&!state.ui.busy&&router.currentRoute.value.name==='home'&&presentedSource===sourceSignature.value)
watch([guideCanOpen,sourceSignature],async([allowed],_previous,onCleanup)=>{
 if(!allowed)return
 const controller=new AbortController(),owner=state.user?.id,source=sourceSignature.value
 onCleanup(()=>controller.abort())
 try{
  await nextTick();await paintLoading(controller.signal)
  if(disposed||controller.signal.aborted||!guideCanOpen.value||owner!==state.user?.id||source!==sourceSignature.value)return
  // The empty panel and populated feed both need a real layout before the
  // existing coach measures its targets. Route/visibility/modal changes cancel.
  if(!guideTargets.value.every(selector=>{const node=document.querySelector('.home-shell '+selector),rect=node?.getBoundingClientRect();return rect?.width>0&&rect?.height>0}))return
  content.guideStep??=0;guideOpen.value=true
 }catch(error){if(error.code!=='CANCELLED')throw error}
},{flush:'post'})
async function readHome(options){
 if(readPending.value&&readOperation.value)return false
 const animate=!ready.value||content.feedPresentation?.key!==feedKey.value,token=animate?presentation.start(ready.value?restoredPosts():posts.value):null
 const version=++generation,owner=state.user?.id;entryReadSucceeded.value=false;readOperation.value='load';readPending.value=true
 const ok=await loadContent(options)
 if(disposed||version!==generation||owner!==state.user?.id)return false
 readPending.value=false
 if(ok){entryReadSucceeded.value=true;readOperation.value='';if(animate)presentResult(token);else syncPresentation()}
 else if(animate)presentation.fail({token})
 return ok
}
async function refreshFeed(){
 if(discovering.value||state.ui.busy)return
 cancelCardOpen()
 const token=presentation.start(posts.value),version=++generation,scroll=content.feedScroll,owner=state.user?.id
 entryReadSucceeded.value=false;readOperation.value='refresh';refreshFeedback.value=''
 const ok=await refreshContent()
 if(disposed||version!==generation||owner!==state.user?.id)return
 if(ok){entryReadSucceeded.value=true;readOperation.value='';presentResult(token);if(empty.value)refreshFeedback.value='p2.noMatchesYet';await restoreFeed()}
 else{presentation.fail({token});content.feedScroll=scroll;await restoreFeed()}
}
onMounted(async()=>{
 document.addEventListener('visibilitychange',syncPause);window.addEventListener('eluva:launch-visible',syncPause);motionQuery.addEventListener('change',reducedMotion)
 document.addEventListener('scroll',pageScroll,true);window.addEventListener('resize',clearDecorations)
 modalObserver=new MutationObserver(syncPause);const app=document.getElementById('app');if(app)modalObserver.observe(app,{attributes:true,attributeFilter:['inert']});syncPause()
 intersectionObserver=new IntersectionObserver(entries=>{inView.value=!!entries[0]?.isIntersecting;presentation.hold('offscreen',!inView.value)},{threshold:0})
 if(map.value)intersectionObserver.observe(map.value)
 if(ready.value&&content.feedPresentation?.key===feedKey.value){
  // Returning restores the completed presentation, including a successful
  // empty result. Mutations already update the shared, permission-filtered data.
  syncPresentation();entryReadSucceeded.value=true;readPending.value=false
 }else await readHome({quiet:content.loaded,reuse:true})
 await restoreFeed()
})
onBeforeUnmount(()=>{
 if(filterFrame!==undefined)cancelAnimationFrame(filterFrame)
 clearTimeout(filterTimer)
 cancelCardOpen()
 presentation.finish()
 disposed=true;generation++;presentation.dispose();modalObserver?.disconnect();intersectionObserver?.disconnect()
 clearDecorations();document.removeEventListener('scroll',pageScroll,true);window.removeEventListener('resize',clearDecorations)
 document.removeEventListener('visibilitychange',syncPause);window.removeEventListener('eluva:launch-visible',syncPause);motionQuery.removeEventListener('change',reducedMotion)
 if(feedElement())content.feedScroll=feedElement().scrollLeft
})
function openHelp(event){if(helpOpen.value||!ready.value||guideOpen.value)return;cancelCardOpen();event?.currentTarget?.focus({preventScroll:true});helpOpen.value=true}
async function compose(){if(enteringComposer.value||state.ui.busy||!canNavigate())return;cancelCardOpen();enteringComposer.value=true;try{newPostDraft('/home');await router.push('/compose')}finally{enteringComposer.value=false}}
async function openFilter(){
 if(filterOpen.value)return
 clearDecorations();presentation.finish();readOperation.value='';filter.value={...content.preferences.feedFilter||defaultFeedFilter()};filterPhase.value='opening'
 await nextTick()
 if(disposed||filterPhase.value!=='opening')return
 filterFrame=requestAnimationFrame(()=>{filterFrame=undefined;if(filterPhase.value==='opening')filterPhase.value='open'})
}
function finishFilterClose(){if(filterPhase.value!=='closing')return;clearTimeout(filterTimer);filterTimer=undefined;filterPhase.value='closed'}
function closeFilter(){
 if(filterPhase.value==='closed'||filterPhase.value==='closing'||state.ui.busy)return
 if(filterFrame!==undefined){cancelAnimationFrame(filterFrame);filterFrame=undefined}
 if(motionQuery.matches){filterPhase.value='closed';return}
 filterPhase.value='closing';clearTimeout(filterTimer);filterTimer=setTimeout(finishFilterClose,450)
}
async function saveFilter(){if(await mutateContent('preferences',{feedFilter:{...filter.value}})){entryReadSucceeded.value=true;closeFilter();refreshFeedback.value='';content.feedScroll=0;await restoreFeed()}}
async function resetFilter(){readOperation.value='';if(await mutateContent('preferences',{feedFilter:defaultFeedFilter()})){entryReadSucceeded.value=true;refreshFeedback.value='';content.feedScroll=0;await restoreFeed()}}
async function finishGuide(){if(await mutateContent('preferences',{guideDone:true})){content.guideStep=null;guideOpen.value=false}}
</script>
<template>
<ContentShell home :class="{'home-empty-state':empty,'home-discovering':discovering}" :data-discovery-phase="motion.phase" :data-motion-paused="motionPaused" :data-opening-post="openingId||undefined" :data-guide-pending="ready&&!content.preferences.guideDone" :data-guide-open="guideOpen" :ready="ready" :show-error="ready" :error-key="readErrorKey" :title="t('p2.home')" @help="openHelp" @filters="openFilter">
 <div ref="map" class="home-map-content" :class="{populated:!empty}">
  <img v-if="empty" class="home-empty-cloud" src="/images/home-empty/foreground-cloud.png" alt="" draggable="false"/>
  <div class="discovery-beacons" aria-hidden="true"><template v-for="{post,index} in beacons" :key="post.id"><span v-if="beaconPositions[index]" class="discovery-beacon" :class="{'is-active':motion.activeId===post.id}" :data-post-id="post.id" :style="{...signalStyle(post.id),'--beacon-x':beaconPositions[index].x+'px','--beacon-y':beaconPositions[index].y+'px'}"><img src="/images/post-detail/lit-bulb.svg" alt="" draggable="false"/></span></template></div>
  <button class="share-island" :disabled="!!state.ui.busy||enteringComposer" @click="compose"><img :src="empty?'/images/home-empty/share-island.svg':'/images/p2/share-island.png'" alt="" draggable="false"/><span>{{ t('p2.share') }}</span></button>
  <div class="resonance-group">
   <div class="resonance-orbits" :class="{'is-discovering':discovering}" aria-hidden="true"><span v-for="wave in 3" :key="wave" class="resonance-wave" :style="{'--wave-delay':(wave-1)*-1.6+'s','--discovery-wave-delay':(wave-1)*(-3.2/3)+'s'}"/><img :src="empty?'/images/home-empty/resonance-avatar.svg':'/images/p2/resonance-avatar.png'" alt="" draggable="false"/></div>
   <button v-if="ready||readPending" class="resonance-count" :disabled="!!state.ui.busy||discovering" :aria-label="motion.phase==='searching'||!ready?t('p2.loading'):t('p2.refresh')+' · '+countLabel(posts.length)" :aria-busy="discovering" @click="refreshFeed"><span aria-live="polite" aria-atomic="true">{{ motion.phase==='searching'||!ready?t('p2.loading'):countLabel(posts.length) }}</span><span v-if="discovering" class="spinner"/><img v-else src="/images/p2/refresh.png" alt=""/></button>
  </div>
 </div>
 <LoadingSkeleton v-if="!ready&&readPending" variant="home" class="discovery-loading" :label="t('p2.loading')"/>
 <div v-else-if="!ready" class="content-state" :data-error-code="state.ui.error"><p>{{ t('p2.loadFailed') }}</p><ActionButton @click="readHome()">{{ t('retry') }}</ActionButton></div>
 <section v-else-if="sourcePosts.length" class="discovery-panel" :aria-busy="motion.busy">
  <TransitionGroup tag="div" name="discovery-cards" class="discovery-list" @leave="removeCard" @scroll="content.feedScroll=$event.target.scrollLeft"><PostCard v-for="post in posts" :key="post.id" :post="post" :echo-busy="openingId===post.id" :interaction-disabled="!!openingId" :data-post-id="post.id" :style="signalStyle(post.id)" :data-glow-id="glowingIds.includes(post.id)?post.id:undefined" :data-open-feedback="openingId===post.id?true:undefined" :aria-busy="openingId===post.id?true:undefined" :class="{'discovery-card-reveal':motion.activeId===post.id,'discovery-card-landing':arrival?.id===post.id,'discovery-card-glow':glowingIds.includes(post.id)}" @open="openPost(post)" @echo="openLightUp(post)"/></TransitionGroup>
 </section>
 <div v-if="ready&&content.draft&&dirtyPost()" class="home-local-tools"><button class="text-link" @click="compose">{{ t('p2.continueDraft') }}</button></div>
 <template #tabs><div v-if="empty" class="home-empty-footer"><HomeEmptyPanel :filtered="filteredEmpty" :busy="!!state.ui.busy||discovering" :entering="enteringComposer" :feedback="refreshFeedback" @compose="compose" @reset="resetFilter"/><AppTabBar :lights="content.events.length"/></div><AppTabBar v-else :lights="content.events.length"/></template>
 <template #overlay><HomeLandscape :paused="motionPaused"/><div v-if="arrival" class="discovery-flight-stage" :style="arrival.stage" aria-hidden="true" inert><div :key="arrival.id" class="discovery-flight" :data-post-id="arrival.id" data-flight-phase="falling" :style="arrival.card" @animationend="finishArrival"><PostCard :post="arrival.post" :style="signalStyle(arrival.id)" :data-glow-id="arrival.id" class="discovery-flight-card discovery-card-glow"/></div></div></template>
</ContentShell>
<HomeHelpModal v-if="helpOpen" @close="helpOpen=false"/>
<AppModal v-if="guideOpen&&content.guideStep!==null&&!content.preferences.guideDone" :title="t('p2.guideTitle')" :coach-side="content.guideStep%2?'right':'left'" :coach-target="guideTargets[content.guideStep]" :closable="!state.ui.busy" @close="finishGuide"><div class="home-guide" :data-guide-step="content.guideStep"><p>{{ t('p2.guide'+content.guideStep) }}</p><span>{{ t('p2.guideStep',{n:content.guideStep+1}) }}</span></div><template #footer><ActionButton secondary :disabled="!!state.ui.busy" @click="finishGuide">{{ t('p2.guideSkip') }}</ActionButton><ActionButton class="purple-gradient" :busy="!!state.ui.busy" @click="content.guideStep===3?finishGuide():content.guideStep++">{{ t(content.guideStep===3?'p2.guideDone':'p2.next') }}</ActionButton></template></AppModal>
<AppModal v-if="filterOpen" variant="home-filter" :motion-state="filterPhase" :closable="!state.ui.busy" :title="t('p2.feedFilters')" @close="closeFilter" @motionend="finishFilterClose"><p class="sheet-hint">{{ t('p2.feedHint') }}</p><fieldset :disabled="!!state.ui.busy"><legend>{{ t('p2.filters') }}</legend><div class="chips"><button v-for="id in ['all','image','video','text']" :key="id" class="chip" :class="{selected:filter.media===id}" :aria-pressed="filter.media===id" @click="filter.media=id">{{ t('p2.'+({image:'images'}[id]||id)) }}</button></div></fieldset><fieldset class="sheet-field"><legend>{{ t('p2.topics') }}</legend><select class="plain-select" :disabled="!!state.ui.busy" v-model="filter.topic" :aria-label="t('p2.topics')"><option value="all">{{ t('p2.all') }}</option><option v-for="x in choices.interests" :key="x.id" :value="x.id">{{ x[state.locale] }}</option></select></fieldset><template #footer><ActionButton secondary :disabled="!!state.ui.busy" @click="closeFilter">{{ t('cancel') }}</ActionButton><ActionButton class="purple-gradient" :busy="!!state.ui.busy" @click="saveFilter">{{ t('save') }}</ActionButton></template></AppModal></template>

import { nextTick } from 'vue'
import { createNavigationTrail } from '../domain/navigation-motion.js'

const timing = { push:360,pop:320,'tab-forward':240,'tab-back':240,present:360,dismiss:320,fade:200,'post-expand':520,'post-collapse':460,'compose-expand':560,'compose-collapse':500 }
const easing = 'cubic-bezier(.22,.68,.18,1)'
const deferred = () => {let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}

function sharedRoute(to,from){
 const expand=from.name==='home'&&to.name==='post'&&to.query?.from==='/home'
 const collapse=from.name==='post'&&to.name==='home'&&from.query?.from==='/home'
 const id=expand?to.params?.id:collapse?from.params?.id:null
 if(id!==undefined&&id!==null)return {type:'post',id:String(id),direction:expand?'expand':'collapse'}
 const composeExpand=from.name==='home'&&to.name==='compose'
 const composeCollapse=from.name==='compose'&&to.name==='home'
 return composeExpand||composeCollapse?{type:'compose',direction:composeExpand?'expand':'collapse'}:null
}

function postCard(page,id){
 return [...page.querySelectorAll('.home-shell .discovery-list .post-card[data-post-id]')].find(element=>element.dataset.postId===id)
}

function visibleRect(element){
 const rect=element?.getBoundingClientRect()
 return rect?.width>0&&rect?.height>0?{left:rect.left,top:rect.top,width:rect.width,height:rect.height}:null
}

// Animate compositor snapshots, never a second live route. Old pages still
// unmount immediately, releasing media, observers and in-flight reads normally.
export function installNavigationMotion(router, {
 getHost,isReady,ownerId,canCapture=()=>true,page=document,view=window,
 tick=nextTick,schedule=setTimeout,cancel=clearTimeout,
} = {}) {
 const trail=createNavigationTrail(),media=view.matchMedia('(prefers-reduced-motion: reduce)'),postOrigins=new Map()
 let active=null,disposed=false,sequence=0
 const position=()=>view.history?.state?.position
 function emit(op,phase,reason){view.dispatchEvent(new view.CustomEvent('eluva:navigation-motion',{detail:{phase,kind:op.kind,mode:op.mode,from:op.from,to:op.to,...(op.shared?.type==='post'?{sharedPost:op.shared.direction,postId:op.shared.id}:{}),...(op.shared?.type==='compose'?{sharedCompose:op.shared.direction}:{}),...(reason?{reason}:{})}}))}
 function sharedSource(shared){
  if(shared.type==='compose')return shared.direction==='expand'?page.querySelector('.home-shell .share-island'):page.querySelector('.composer-shell')
  return shared.direction==='expand'?postCard(page,shared.id):page.querySelector('.post-detail-shell:not(.detail-fullscreen-media)')
 }
 function sharedTarget(shared){
  if(shared.type==='compose')return shared.direction==='expand'?page.querySelector('.composer-shell'):page.querySelector('.home-shell .share-island')
  return shared.direction==='expand'?page.querySelector('.post-detail-shell:not(.detail-fullscreen-media)'):postCard(page,shared.id)||page.querySelector('.home-shell .resonance-orbits')
 }
 function alignSharedTarget(op,element){
  if(op.shared?.type!=='post'||op.shared.direction!=='collapse'||!element)return
  const origin=postOrigins.get(op.shared.id),list=element.closest('.discovery-list')
  if(!origin||!list)return
  const rect=visibleRect(element);if(!rect)return
  const next=Math.max(0,Math.min(list.scrollWidth-list.clientWidth,list.scrollLeft+rect.left-origin.left))
  list.scrollLeft=next
 }
 function sharedGeometry(rect){
  const width=view.innerWidth||page.documentElement.clientWidth,height=view.visualViewport?.height||view.innerHeight||page.documentElement.clientHeight,cx=rect.left+rect.width/2,cy=rect.top+rect.height/2
  return {cx,cy,radius:Math.hypot(Math.max(cx,width-cx),Math.max(cy,height-cy))}
 }
 function setSharedOrigin(rect){
  if(!rect)return
  const geometry=sharedGeometry(rect),style=page.documentElement.style
  style.setProperty('--navigation-shared-x',geometry.cx+'px');style.setProperty('--navigation-shared-y',geometry.cy+'px');style.setProperty('--navigation-shared-radius',geometry.radius+'px')
 }
 function clearShared(op){
  op?.surface?.remove()
  if(active===op){
   const style=page.documentElement.style
   style.removeProperty('--navigation-shared-x');style.removeProperty('--navigation-shared-y');style.removeProperty('--navigation-shared-radius')
   delete page.documentElement.dataset.navigationSharedPost;delete page.documentElement.dataset.navigationSharedPostId;delete page.documentElement.dataset.navigationSharedCompose
  }
 }
 function finish(op,reason='complete'){
  if(!op||op.done)return
  op.done=true;op.captured.resolve();op.committed.resolve()
  cancel(op.captureTimer);cancel(op.deadline)
  if(op.frame!==undefined)view.cancelAnimationFrame(op.frame)
  op.paintDone?.();op.animation?.cancel()
  if(reason!=='complete')op.transition?.skipTransition()
  clearShared(op)
  if(active===op){active=null;delete page.documentElement.dataset.navigationMotion;delete page.documentElement.dataset.navigationMode}
  emit(op,'finish',reason)
 }
 function paint(op){return new Promise(resolve=>{op.paintDone=resolve;op.frame=view.requestAnimationFrame(()=>{op.frame=undefined;op.paintDone=null;resolve()})})}
 async function afterPaint(op){await tick();await tick();if(!op.done)await paint(op)}
 function startFallback(op){
  afterPaint(op).then(()=>{
   if(op.done||active!==op||page.hidden||media.matches)return finish(op,'interrupted')
   const host=getHost();if(!host?.animate)return finish(op,'unsupported')
   if(op.shared){
    const target=sharedTarget(op.shared);alignSharedTarget(op,target)
    const targetRect=visibleRect(target),hostRect=visibleRect(host)
    if(target&&targetRect&&hostRect){
     const originRect=op.shared.direction==='expand'?op.shared.sourceRect:targetRect
     setSharedOrigin(originRect)
     const geometry=sharedGeometry(originRect),x=geometry.cx-hostRect.left,y=geometry.cy-hostRect.top,duration=timing[op.shared.type+'-'+op.shared.direction]
     if(op.shared.direction==='collapse'){
      const surface=page.createElement('div')
      surface.className='navigation-shared-fallback-surface';surface.setAttribute('aria-hidden','true');surface.inert=true
      if(op.fallbackSnapshot)surface.append(op.fallbackSnapshot)
      page.body.append(surface);op.surface=surface
      try{
       op.animation=surface.animate([{opacity:1,clipPath:`circle(${geometry.radius}px at ${x}px ${y}px)`},{opacity:0,clipPath:`circle(0 at ${x}px ${y}px)`}],{duration,easing,fill:'both'})
       op.animation.finished.then(()=>finish(op),()=>finish(op,'interrupted'))
       return
      }catch{surface.remove();op.surface=null}
     }
     try{
      op.animation=host.animate([{opacity:.12,clipPath:`circle(0 at ${x}px ${y}px)`},{opacity:1,clipPath:`circle(${geometry.radius}px at ${x}px ${y}px)`}],{duration,easing,fill:'none'})
      op.animation.finished.then(()=>finish(op),()=>finish(op,'interrupted'))
      return
     }catch{}
    }
   }
   const direction=op.kind==='pop'||op.kind==='tab-back'?-1:1
   const transform=op.kind==='present'?'translateY(32px)':op.kind==='dismiss'?'translateY(-16px)':op.kind==='fade'?'none':`translateX(${direction*(op.kind.startsWith('tab-')?14:28)}px)`
   try{
    op.animation=host.animate([{opacity:op.kind==='fade'?.7:.82,transform},{opacity:1,transform:'none'}],{duration:timing[op.kind],easing,fill:'none'})
    op.animation.finished.then(()=>finish(op),()=>finish(op,'interrupted'))
   }catch{finish(op,'unsupported')}
  }).catch(()=>finish(op,'render-error'))
 }
 async function prepare(to,from){
  const generation=++sequence
  finish(active,'superseded')
  const kind=trail.plan(to,from,{ownerId:ownerId(),position:position()})
  if(disposed||kind==='none'||!isReady()||page.hidden||media.matches||!getHost())return
  // Flush a closing action sheet and any safety-state pruning before capture.
  await tick()
  if(generation!==sequence||disposed||page.hidden||media.matches||!isReady()||!canCapture(from)||page.querySelector('[role="dialog"]'))return
  const shared=sharedRoute(to,from),source=shared&&sharedSource(shared),sourceRect=visibleRect(source)
  if(shared?.type==='post'&&shared.direction==='expand'&&sourceRect)postOrigins.set(shared.id,sourceRect)
  const op={id:generation,kind,from:from.fullPath,to:to.fullPath,mode:'fallback',captured:deferred(),committed:deferred(),done:false,shared:sourceRect?{...shared,sourceRect}:null}
  active=op;page.documentElement.dataset.navigationMotion=kind
  if(op.shared?.type==='post'){page.documentElement.dataset.navigationSharedPost=op.shared.direction;page.documentElement.dataset.navigationSharedPostId=op.shared.id}
  if(op.shared?.type==='compose')page.documentElement.dataset.navigationSharedCompose=op.shared.direction
  if(op.shared)setSharedOrigin(op.shared.sourceRect)
  // Camera/video surfaces remain live; their route uses the lightweight fallback.
  const capture=typeof page.startViewTransition==='function'&&!['videoCall'].includes(to.name)&&!['videoCall'].includes(from.name)
  if(!capture&&op.shared?.direction==='collapse'){
   op.fallbackSnapshot=source.cloneNode(true)
   const sourceScroll=source.querySelector('.page-content'),snapshotScroll=op.fallbackSnapshot.querySelector('.page-content')
   if(sourceScroll&&snapshotScroll)snapshotScroll.scrollTop=sourceScroll.scrollTop
  }
  op.mode=capture?'view-transition':'fallback';page.documentElement.dataset.navigationMode=op.mode
  emit(op,'start')
  op.deadline=schedule(()=>finish(op,'timeout'),1200)
  if(capture){
   try{
    op.transition=page.startViewTransition(async()=>{
     op.captured.resolve();await op.committed.promise
     // WebKit suspends rendering during this callback. Waiting for rAF here
     // would prevent capture from completing; Vue's DOM/scroll flush is enough.
     if(!op.done){
      await tick();await tick()
      if(op.shared){const target=sharedTarget(op.shared);alignSharedTarget(op,target);if(op.shared.direction==='collapse')setSharedOrigin(visibleRect(target))}
     }
    })
    op.transition.ready.catch(()=>finish(op,'capture-skipped'))
    op.transition.finished.then(()=>finish(op),()=>finish(op,'capture-skipped'))
    // Navigation must proceed even if WebKit skips or delays a capture.
    op.captureTimer=schedule(()=>finish(op,'capture-timeout'),200)
    await op.captured.promise;cancel(op.captureTimer)
   }catch{
    op.mode='fallback';page.documentElement.dataset.navigationMode=op.mode
    op.captured.resolve()
   }
  }
 }
 function committed(to,from,failure){
  const op=active
  if(failure){if(op?.to===to.fullPath)finish(op,'navigation-cancelled');return}
  trail.commit(to,{ownerId:ownerId(),position:position()})
  if(!op||op.to!==to.fullPath)return
  op.committed.resolve();emit(op,'commit')
  if(op.mode==='fallback')startFallback(op)
 }
 function stop(reason){sequence++;finish(active,reason)}
 function interrupted(){if(page.hidden)stop('hidden')}
 function resized(){stop('viewport-changed')}
 function reduced(){if(media.matches)stop('reduced-motion')}
 const removePrepare=router.beforeResolve(prepare),removeCommit=router.afterEach(committed),removeError=router.onError(()=>stop('navigation-error'))
 page.addEventListener('visibilitychange',interrupted);view.addEventListener('resize',resized);view.visualViewport?.addEventListener('resize',resized);media.addEventListener('change',reduced)
 return {
  reset(){stop('account-changed');trail.reset();postOrigins.clear()},
  dispose(){disposed=true;stop('disposed');postOrigins.clear();removePrepare();removeCommit();removeError();page.removeEventListener('visibilitychange',interrupted);view.removeEventListener('resize',resized);view.visualViewport?.removeEventListener('resize',resized);media.removeEventListener('change',reduced)},
 }
}

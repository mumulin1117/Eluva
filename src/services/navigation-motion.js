import { nextTick } from 'vue'
import { createNavigationTrail } from '../domain/navigation-motion.js'

const timing = { push:360,pop:320,'tab-forward':240,'tab-back':240,present:360,dismiss:320,fade:200 }
const easing = 'cubic-bezier(.22,.68,.18,1)'
const deferred = () => {let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}

// Animate compositor snapshots, never a second live route. Old pages still
// unmount immediately, releasing media, observers and in-flight reads normally.
export function installNavigationMotion(router, {
 getHost,isReady,ownerId,canCapture=()=>true,page=document,view=window,
 tick=nextTick,schedule=setTimeout,cancel=clearTimeout,
} = {}) {
 const trail=createNavigationTrail(),media=view.matchMedia('(prefers-reduced-motion: reduce)')
 let active=null,disposed=false,sequence=0
 const position=()=>view.history?.state?.position
 function emit(op,phase,reason){view.dispatchEvent(new view.CustomEvent('eluva:navigation-motion',{detail:{phase,kind:op.kind,mode:op.mode,from:op.from,to:op.to,...(reason?{reason}:{})}}))}
 function finish(op,reason='complete'){
  if(!op||op.done)return
  op.done=true;op.captured.resolve();op.committed.resolve()
  cancel(op.captureTimer);cancel(op.deadline)
  if(op.frame!==undefined)view.cancelAnimationFrame(op.frame)
  op.paintDone?.();op.animation?.cancel()
  if(reason!=='complete')op.transition?.skipTransition()
  if(active===op){active=null;delete page.documentElement.dataset.navigationMotion;delete page.documentElement.dataset.navigationMode}
  emit(op,'finish',reason)
 }
 function paint(op){return new Promise(resolve=>{op.paintDone=resolve;op.frame=view.requestAnimationFrame(()=>{op.frame=undefined;op.paintDone=null;resolve()})})}
 async function afterPaint(op){await tick();await tick();if(!op.done)await paint(op)}
 function startFallback(op){
  afterPaint(op).then(()=>{
   if(op.done||active!==op||page.hidden||media.matches)return finish(op,'interrupted')
   const host=getHost();if(!host?.animate)return finish(op,'unsupported')
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
  const op={id:generation,kind,from:from.fullPath,to:to.fullPath,mode:'fallback',captured:deferred(),committed:deferred(),done:false}
  active=op;page.documentElement.dataset.navigationMotion=kind
  // Camera/video surfaces remain live; their route uses the lightweight fallback.
  const capture=typeof page.startViewTransition==='function'&&!['videoCall'].includes(to.name)&&!['videoCall'].includes(from.name)
  op.mode=capture?'view-transition':'fallback';page.documentElement.dataset.navigationMode=op.mode
  emit(op,'start')
  op.deadline=schedule(()=>finish(op,'timeout'),1200)
  if(capture){
   try{
    op.transition=page.startViewTransition(async()=>{
     op.captured.resolve();await op.committed.promise
     // WebKit suspends rendering during this callback. Waiting for rAF here
     // would prevent capture from completing; Vue's DOM/scroll flush is enough.
     if(!op.done){await tick();await tick()}
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
  reset(){stop('account-changed');trail.reset()},
  dispose(){disposed=true;stop('disposed');removePrepare();removeCommit();removeError();page.removeEventListener('visibilitychange',interrupted);view.removeEventListener('resize',resized);view.visualViewport?.removeEventListener('resize',resized);media.removeEventListener('change',reduced)},
 }
}

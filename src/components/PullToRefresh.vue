<script setup>
import { computed,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { t } from '../state.js'
import { modalStack } from '../services/modal-stack.js'
import { gestureAxis,pullDistance } from '../domain/chats-gestures.js'
import '../chats-interactions.css'
const props=defineProps({refreshing:Boolean,disabled:Boolean,completed:Boolean})
const emit=defineEmits(['refresh','pull'])
const root=ref(null),distance=ref(0),dragging=ref(false),completionVisible=ref(false),pagePaused=ref(document.hidden)
const armed=computed(()=>distance.value>=56),height=computed(()=>props.refreshing||completionVisible.value?76:distance.value)
const progress=computed(()=>props.refreshing||completionVisible.value?1:Math.min(distance.value/56,1))
let scroller,start=null,ignoreClick=false,captured=null,requested=false,completionTimer
const blocked=()=>props.disabled||props.refreshing||modalStack.length||document.hidden
function cancel(){start=null;distance.value=0;dragging.value=false;if(captured!==null){try{scroller.releasePointerCapture(captured)}catch{}captured=null}}
function begin(x,y,id,target){ignoreClick=false;if(blocked()||requested||scroller.scrollTop>1||target.closest('input,textarea,select,[contenteditable="true"]'))return;clearTimeout(completionTimer);completionVisible.value=false;start={x,y,id};distance.value=0}
function move(x,y,id,event){
 if(!start||start.id!==id)return
 if(blocked()||scroller.scrollTop>1){cancel();return}
 const dx=x-start.x,dy=y-start.y
 if(!dragging.value){const axis=gestureAxis(dx,dy);if(axis==='horizontal'||dy< -8){cancel();return}if(axis!=='vertical'||dy<9)return;dragging.value=true;ignoreClick=true;emit('pull');if(typeof id==='number'){try{scroller.setPointerCapture(id);captured=id}catch{}}}
 if(event.cancelable)event.preventDefault()
 distance.value=pullDistance(dy)
}
function end(id,event){if(!start||start.id!==id)return;const refresh=armed.value&&!blocked();if(dragging.value&&event.cancelable)event.preventDefault();cancel();if(refresh)request()}
function pointerDown(e){if(e.pointerType!=='touch'&&e.isPrimary!==false&&e.button===0)begin(e.clientX,e.clientY,e.pointerId,e.target)}
function pointerMove(e){if(e.pointerType!=='touch')move(e.clientX,e.clientY,e.pointerId,e)}
function pointerUp(e){if(e.pointerType!=='touch')end(e.pointerId,e)}
function pointerCancel(e){if(e.pointerType!=='touch')cancel()}
function touchStart(e){if(e.touches.length!==1){cancel();return}const t=e.touches[0];begin(t.clientX,t.clientY,'touch-'+t.identifier,e.target)}
function touchMove(e){if(e.touches.length!==1){cancel();return}const t=e.touches[0];move(t.clientX,t.clientY,'touch-'+t.identifier,e)}
function touchEnd(e){const t=e.changedTouches[0];if(t)end('touch-'+t.identifier,e)}
function click(e){if(ignoreClick){ignoreClick=false;if(e.detail!==0){e.preventDefault();e.stopImmediatePropagation()}}}
function request(){if(!blocked()&&!requested){requested=true;emit('refresh');queueMicrotask(()=>{if(!props.refreshing)requested=false})}}
const listeners=[['pointerdown',pointerDown],['pointermove',pointerMove],['pointerup',pointerUp],['pointercancel',pointerCancel],['lostpointercapture',pointerCancel],['touchstart',touchStart],['touchmove',touchMove],['touchend',touchEnd],['touchcancel',cancel],['click',click]]
watch(()=>props.disabled||props.refreshing,v=>{if(v)cancel();if(!props.refreshing)requested=false})
watch(()=>props.completed,value=>{clearTimeout(completionTimer);completionVisible.value=value;if(value)completionTimer=setTimeout(()=>completionVisible.value=false,900)})
function visibility(){pagePaused.value=document.hidden;cancel()}
onMounted(()=>{scroller=root.value.closest('.page-content');for(const [name,fn] of listeners)scroller.addEventListener(name,fn,{capture:true,passive:false});document.addEventListener('visibilitychange',visibility)})
onBeforeUnmount(()=>{cancel();clearTimeout(completionTimer);for(const [name,fn] of listeners)scroller?.removeEventListener(name,fn,true);document.removeEventListener('visibilitychange',visibility)})
</script>
<template>
 <div ref="root" class="pull-refresh" :class="{dragging,refreshing,'is-armed':armed,'is-complete':completionVisible}" :data-pull-state="refreshing?'refreshing':completionVisible?'complete':armed?'armed':dragging?'pulling':'idle'" :data-animation-paused="pagePaused" :aria-busy="refreshing">
  <div class="pull-refresh-reveal" :style="{height:height+'px',opacity:height?1:0}" :aria-hidden="!height">
   <div class="chats-refresh-signal" role="status" aria-live="polite" aria-atomic="true" :style="{'--pull-progress':progress,'--pull-turn':(progress*150)+'deg'}">
    <svg class="pull-refresh-glyph" viewBox="0 0 48 40" aria-hidden="true" focusable="false">
     <circle class="refresh-echo-track" cx="24" cy="20" r="15"/>
     <g class="refresh-echo-rotor">
      <circle class="refresh-echo-arc" cx="24" cy="20" r="15" pathLength="100" :stroke-dasharray="(8+progress*64)+' 100'"/>
      <circle class="refresh-echo-inner" cx="24" cy="20" r="10" pathLength="100" :stroke-dasharray="(5+progress*36)+' 100'" stroke-dashoffset="-52"/>
      <circle class="refresh-echo-satellite" cx="24" cy="5" r="2.2"/>
     </g>
     <circle class="refresh-echo-core" cx="24" cy="20" r="3"/>
     <path class="refresh-echo-check" d="m18.5 20 3.5 3.5 7.5-8" pathLength="1"/>
    </svg>
    <span class="chats-refresh-caption">{{ t(refreshing?'s.refreshingMessages':completionVisible?'s.messagesUpdated':armed?'s.releaseToRefresh':'s.pullToRefresh') }}</span>
   </div>
  </div>
  <button class="pull-refresh-accessible sr-only" :disabled="disabled||refreshing" @click="request">{{ t('s.pullToRefresh') }}</button>
  <slot/>
 </div>
</template>

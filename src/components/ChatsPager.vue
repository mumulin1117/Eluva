<script setup>
import { computed,nextTick,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { modalStack } from '../services/modal-stack.js'
import { gestureAxis,swipeCategory } from '../domain/chats-gestures.js'
const props=defineProps({modelValue:{type:String,default:'all'},disabled:Boolean,select:{type:Function,required:true}})
const emit=defineEmits(['gesture'])
const root=ref(null),panels=ref([]),distance=ref(0),dragging=ref(false),pending=ref(''),height=ref(0)
const categories=['all','following'],activeIndex=computed(()=>categories.indexOf(pending.value||props.modelValue)),offset=computed(()=>`translate3d(calc(${-activeIndex.value*100}% + ${distance.value}px),0,0)`)
let start=null,captured=null,ignoreClick=false,observer,alive=true
const blocked=()=>!alive||props.disabled||pending.value||modalStack.length||document.hidden||!!root.value?.closest('[inert]')
function measure(){const panel=panels.value[categories.indexOf(props.modelValue)];if(panel)height.value=panel.scrollHeight}
function reset(){const id=captured;captured=null;start=null;distance.value=0;dragging.value=false;emit('gesture',false);if(id!==null){try{root.value?.releasePointerCapture(id)}catch{}}}
function begin(x,y,id,target){if(blocked()||start||target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-no-swipe]'))return;start={x,y,id,at:performance.now(),axis:''};ignoreClick=false}
function move(x,y,id,event){
 if(!start||start.id!==id)return
 if(blocked()){reset();return}
 const dx=x-start.x,dy=y-start.y
 if(Math.max(Math.abs(dx),Math.abs(dy))>=9)ignoreClick=true
 if(!start.axis)start.axis=gestureAxis(dx,dy)
 if(start.axis==='vertical'){reset();return}
 if(start.axis!=='horizontal')return
 if(!dragging.value){dragging.value=true;ignoreClick=true;emit('gesture',true);if(typeof id==='number'){try{root.value.setPointerCapture(id);captured=id}catch{}}}
 if(event.cancelable)event.preventDefault()
 const edge=props.modelValue==='all'&&dx>0||props.modelValue==='following'&&dx<0
 distance.value=dx*(edge?0.2:1)
}
async function end(x,id,event){
 if(!start||start.id!==id)return
 if(blocked()){reset();return}
 const drag=dragging.value,target=drag?swipeCategory(props.modelValue,x-start.x,{width:root.value.clientWidth,elapsed:performance.now()-start.at}):props.modelValue
 if(drag&&event.cancelable)event.preventDefault()
 reset()
 if(target===props.modelValue)return
 pending.value=target
 try{await props.select(target)}finally{if(alive){pending.value='';await nextTick();measure()}}
}
function pointerDown(e){if(e.isPrimary===false){reset();return}if(e.pointerType!=='touch'&&e.button===0)begin(e.clientX,e.clientY,e.pointerId,e.target)}
function pointerMove(e){if(e.pointerType!=='touch')move(e.clientX,e.clientY,e.pointerId,e)}
function pointerUp(e){if(e.pointerType!=='touch')end(e.clientX,e.pointerId,e)}
function pointerCancel(e){if(e.pointerType==='touch'||start?.id===e.pointerId||captured===e.pointerId)reset()}
function touchStart(e){if(e.touches.length!==1){reset();return}const touch=e.touches[0];begin(touch.clientX,touch.clientY,'touch-'+touch.identifier,e.target)}
function touchMove(e){if(e.touches.length!==1){reset();return}const touch=e.touches[0];move(touch.clientX,touch.clientY,'touch-'+touch.identifier,e)}
function touchEnd(e){const touch=[...e.changedTouches].find(touch=>'touch-'+touch.identifier===start?.id);if(touch)end(touch.clientX,'touch-'+touch.identifier,e)}
function click(e){if(ignoreClick&&e.detail!==0){ignoreClick=false;e.preventDefault();e.stopImmediatePropagation()}}
const listeners=[['pointerdown',pointerDown],['pointermove',pointerMove],['pointerup',pointerUp],['pointercancel',pointerCancel],['lostpointercapture',pointerCancel],['touchstart',touchStart],['touchmove',touchMove],['touchend',touchEnd],['touchcancel',reset],['click',click]]
watch(()=>props.modelValue,async()=>{reset();await nextTick();measure()})
watch(()=>props.disabled,value=>{if(value)reset()})
onMounted(()=>{observer=new ResizeObserver(measure);for(const panel of panels.value)if(panel)observer.observe(panel);measure();for(const [name,handler] of listeners)root.value.addEventListener(name,handler,{capture:name==='click',passive:false});document.addEventListener('visibilitychange',reset);window.addEventListener('pagehide',reset);window.addEventListener('blur',reset);window.addEventListener('eluva:cancel-interactions',reset)})
onBeforeUnmount(()=>{alive=false;reset();observer?.disconnect();for(const [name,handler] of listeners)root.value?.removeEventListener(name,handler,name==='click');document.removeEventListener('visibilitychange',reset);window.removeEventListener('pagehide',reset);window.removeEventListener('blur',reset);window.removeEventListener('eluva:cancel-interactions',reset)})
</script>
<template>
 <div ref="root" class="chats-pager" :class="{'is-dragging':dragging,'is-settling':!!pending}" :data-active-category="modelValue" :data-swipe-state="dragging?'dragging':pending?'settling':'idle'" :style="{height:height?height+'px':undefined}">
  <div class="chats-pager-track" :style="{transform:offset}">
   <section v-for="(category,index) in categories" :id="'chats-panel-'+category" :key="category" :ref="element=>panels[index]=element" class="chats-category-panel" role="tabpanel" :aria-labelledby="'chats-tab-'+category" :aria-hidden="category!==modelValue" :inert="category!==modelValue">
    <slot :category="category" :active="category===modelValue"/>
   </section>
  </div>
 </div>
</template>

<script setup>
import { computed,nextTick,onBeforeUnmount,ref } from 'vue'
import { t } from '../state.js'
import { homeHelpSlides } from '../data/home-help.js'
import AppModal from './AppModal.vue'
import ActionButton from './ActionButton.vue'

const emit=defineEmits(['close'])
const index=ref(0),statuses=ref(homeHelpSlides.map(()=> 'loading')),attempts=ref(homeHelpSlides.map(()=>0))
const current=computed(()=>homeHelpSlides[index.value])
let gesture,changing=false,alive=true
function close(){if(!alive)return;alive=false;cancelPointer();emit('close')}
async function select(value,event){
  if(!alive||changing||event?.detail>1)return
  const next=Math.min(homeHelpSlides.length-1,Math.max(0,value))
  if(next===index.value)return
  changing=true;index.value=next;await nextTick();changing=false
}
function next(event){if(changing||event?.detail>1)return;if(index.value===homeHelpSlides.length-1)close();else select(index.value+1,event)}
function status(i,value){if(alive)statuses.value[i]=value}
function retry(){const i=index.value;if(statuses.value[i]!=='failed')return;statuses.value[i]='loading';attempts.value[i]++}
function artStyle(art){return {left:art.x/360*100+'%',top:art.y/242*100+'%',width:art.width/360*100+'%',height:art.height/242*100+'%',objectPosition:art.position||'50% 50%'}}
function pointerDown(event){
  if(!event.isPrimary||event.button!==0||event.target.closest('button'))return
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,target:event.currentTarget}
  event.currentTarget.setPointerCapture(event.pointerId)
}
function pointerMove(event){if(gesture?.id===event.pointerId&&Math.abs(event.clientX-gesture.x)>10&&Math.abs(event.clientX-gesture.x)>Math.abs(event.clientY-gesture.y))event.preventDefault()}
function pointerUp(event){
  if(gesture?.id!==event.pointerId)return
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y
  cancelPointer()
  if(Math.abs(dx)>=36&&Math.abs(dx)>Math.abs(dy))select(index.value+(dx<0?1:-1))
}
function cancelPointer(){const old=gesture;gesture=null;if(old?.target.hasPointerCapture(old.id))old.target.releasePointerCapture(old.id)}
function keydown(event){
  if(event.repeat)return
  const target={ArrowLeft:index.value-1,ArrowRight:index.value+1,Home:0,End:homeHelpSlides.length-1}[event.key]
  if(target!==undefined){event.preventDefault();select(target)}
}
function hidden(){if(document.hidden)cancelPointer()}
document.addEventListener('visibilitychange',hidden)
onBeforeUnmount(()=>{alive=false;cancelPointer();document.removeEventListener('visibilitychange',hidden)})
</script>
<template>
  <AppModal centered variant="home-help" hide-header :dismiss-on-backdrop="false" :title="t('p2.help')" @close="close">
    <section class="home-help-tour" :data-help-index="index" :data-design-id="current.id" @keydown="keydown">
      <div class="home-help-artboard" :aria-busy="statuses[index]==='loading'" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="cancelPointer" @lostpointercapture="cancelPointer">
        <img v-for="(slide,i) in homeHelpSlides" v-show="index===i&&statuses[i]!=='failed'" :key="slide.id+':'+attempts[i]" class="home-help-illustration" :data-help-art="i" :src="slide.asset+(attempts[i]?'?retry='+attempts[i]:'')" :style="artStyle(slide.art)" alt="" draggable="false" decoding="async" @load="status(i,'ready')" @error="status(i,'failed')"/>
        <span v-if="statuses[index]==='loading'" class="home-help-loading" role="status">{{ t('p2.helpLoading') }}</span>
        <div v-else-if="statuses[index]==='failed'" class="home-help-recovery" role="alert"><p>{{ t('p2.helpImageFailed') }}</p><button class="home-help-retry" @click="retry">{{ t('retry') }}</button></div>
      </div>
      <p class="home-help-copy" aria-live="polite" aria-atomic="true">{{ t('p2.'+current.copy) }}</p>
      <nav class="home-help-pagination" :aria-label="t('p2.helpPages')"><button v-for="(slide,i) in homeHelpSlides" :key="slide.id" :aria-label="t('p2.helpPage',{n:i+1,total:homeHelpSlides.length})" :aria-current="index===i?'step':undefined" :class="{active:index===i}" @click="select(i,$event)"><span/></button></nav>
    </section>
    <template #footer><ActionButton class="home-help-skip" @click="close">{{ t('p2.helpSkip') }}</ActionButton><ActionButton class="home-help-next" :aria-label="t(index===homeHelpSlides.length-1?'p2.helpFinish':'p2.helpContinue')" @click="next">{{ t('p2.helpGotIt') }}</ActionButton></template>
  </AppModal>
</template>
<style>
.modal-backdrop.centered-backdrop.home-help-backdrop{padding:calc(16px + var(--safe-top)) 15px calc(55px + var(--safe-bottom));top:var(--visual-top,0);background:rgba(0,0,0,.5);overscroll-behavior:contain}
.modal-panel.centered-panel.home-help-panel{width:100%;max-width:360px;padding:0;background:rgba(255,255,255,1);border:0;border-radius:20px 20px 24px 24px;max-height:100%;isolation:isolate}
.home-help-panel .modal-body{padding:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y pinch-zoom;flex-shrink:1}
.home-help-tour{background:linear-gradient(180deg,#bb7dfd 0%,#7f3bef 100%);border-radius:20px 20px 34px 34px;overflow:hidden;color:rgba(255,255,255,1)}
.home-help-artboard{width:100%;aspect-ratio:360/242;position:relative;touch-action:pan-y pinch-zoom;overflow:hidden}
.home-help-illustration{position:absolute;object-fit:cover;display:block;pointer-events:none}
.home-help-loading,.home-help-recovery{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:20px;text-align:center;font:500 14px/21px 'Poppins',sans-serif;color:rgba(255,255,255,1)}
.home-help-recovery p{max-width:260px}.home-help-retry{min-width:100px;min-height:44px;padding:8px 16px;background:#fff;color:#582ca0;border-radius:24px;font:600 14px/20px 'Plus Jakarta Sans',sans-serif}
.home-help-tour .home-help-copy{padding:0 26.5px;margin:15px 0 0;min-height:52px;white-space:normal;overflow-wrap:break-word;text-align:center;font:500 17px/26px 'Poppins',sans-serif;color:rgba(255,255,255,1)}
.home-help-pagination{display:flex;justify-content:center;align-items:center;gap:4px;height:44px;margin-top:7px}
.home-help-pagination button{display:grid;place-items:center;padding:0;min-width:0;width:20px;height:44px;background:transparent;flex-shrink:0}
.home-help-pagination button.active{width:50px}.home-help-pagination button>span{display:block;width:100%;height:4px;border-radius:4px;background:rgba(255,255,255,.4);transform:translateY(1px)}
.home-help-pagination button.active>span{background:rgba(255,255,255,1)}
.home-help-panel .modal-footer{padding:24px 15px 25px;gap:12px;margin:0}
.modal-panel.home-help-panel .modal-footer>.action-button{flex:1;min-width:0;min-height:48px;border-radius:40px;padding:12px 10px;font:600 14px/18px 'Plus Jakarta Sans',sans-serif;white-space:normal;overflow-wrap:break-word}
.home-help-panel .modal-footer>.home-help-skip{background:rgba(255,255,255,1);border:1px solid #c8c8c8;color:rgba(150,150,150,1)}
.home-help-panel .modal-footer>.home-help-next{background:rgba(0,0,0,1);border:1px solid rgba(0,0,0,1);color:rgba(255,255,255,1)}
.home-help-panel button:focus-visible{outline:2px solid #5720a2;outline-offset:2px}.home-help-pagination button:focus-visible{outline-color:#fff}
</style>

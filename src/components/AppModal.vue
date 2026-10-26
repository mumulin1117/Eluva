<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref,watch } from 'vue'
import AppIcon from './AppIcon.vue'
import '../connection-modal.css'
import { t } from '../state.js'
import { modalStack } from '../services/modal-stack.js'
import { isInteractiveTarget } from '../services/touch-policy.js'
const props = defineProps({ title: String, closable: { type: Boolean, default: true },dismissOnBackdrop:{type:Boolean,default:true},blurOnBlank:Boolean,hideHeader:Boolean,coachTarget:String,coachSide:{type:String,default:'left'},sheet:Boolean,anchor:String,centered:Boolean,variant:String })
const emit = defineEmits(['close'])
const panel = ref(null); let previous;const token=Symbol('modal')
const coachStyle=ref({}),highlightStyle=ref({});let initialScroll,resizeObserver
function blur(event){if(props.blurOnBlank&&!isInteractiveTarget(event.target))document.activeElement?.blur?.()}
async function positionCoach(){
 if(props.anchor&&panel.value){const target=document.querySelector(props.anchor);if(target){const r=target.getBoundingClientRect(),height=window.visualViewport?.height||window.innerHeight;coachStyle.value={top:Math.min(r.bottom+8,height-120)+'px',right:Math.max(15,window.innerWidth-r.right)+'px',maxHeight:Math.max(100,height-r.bottom-24)+'px'}};return}

 if(!props.coachTarget||!panel.value)return
 await nextTick();const target=document.querySelector(props.coachTarget),height=window.visualViewport?.height||window.innerHeight,width=window.innerWidth
 if(!target)return
 target.scrollIntoView({block:'nearest',inline:'nearest'});const r=target.getBoundingClientRect(),top=Math.max(8,r.top),bottom=Math.min(height-8,r.bottom)
 highlightStyle.value={left:Math.max(8,r.left-3)+'px',top:top+'px',width:Math.min(width-16,r.width+6)+'px',height:Math.max(24,bottom-top)+'px'}
 const maxHeight=Math.max(180,height-64),panelHeight=Math.min(panel.value.scrollHeight,maxHeight),above=top-panelHeight-22,below=bottom+22
 const y=above>=16?above:below+panelHeight<=height-16?below:Math.max(16,(height-panelHeight)/2)
 coachStyle.value={top:y+'px',maxHeight:Math.min(maxHeight,height-y-16)+'px'}
}
watch(()=>props.coachTarget,positionCoach)
function keydown(event) {
  if(modalStack.at(-1)?.token!==token)return
  if (event.key === 'Escape' && props.closable) emit('close')
  if (event.key !== 'Tab') return
  const nodes = [...panel.value.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(x=>x.getClientRects().length)
  if (!nodes.length) { event.preventDefault(); return }
  if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus() }
  else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus() }
}
onMounted(async () => { window.dispatchEvent(new CustomEvent('eluva:cancel-interactions',{detail:{reason:'modal'}}));previous = document.activeElement; document.getElementById('app').inert = true;const parent=modalStack.at(-1);if(parent?.panel)parent.panel.inert=true;modalStack.push({token,panel:panel.value});await nextTick();panel.value?.focus();document.addEventListener('keydown', keydown);if(props.coachTarget||props.anchor){initialScroll=document.querySelector('.page-content')?.scrollTop;await positionCoach();window.visualViewport?.addEventListener('resize',positionCoach);window.addEventListener('resize',positionCoach);resizeObserver=new ResizeObserver(positionCoach);resizeObserver.observe(panel.value)} })
onBeforeUnmount(() => {document.removeEventListener('keydown',keydown);window.visualViewport?.removeEventListener('resize',positionCoach);window.removeEventListener('resize',positionCoach);resizeObserver?.disconnect();if(initialScroll!==undefined){const main=document.querySelector('.page-content');if(main)main.scrollTop=initialScroll}const index=modalStack.findIndex(x=>x.token===token);if(index>=0)modalStack.splice(index,1);document.getElementById('app').inert=modalStack.length>0;const top=modalStack.at(-1);if(top?.panel)top.panel.inert=false;if(previous?.isConnected&&!previous.closest('[inert]'))previous.focus()})
</script>
<template><Teleport to="body"><div class="modal-backdrop" @click="blur" :class="{'coach-backdrop':coachTarget,'popover-backdrop':anchor,'centered-backdrop':centered,'home-help-backdrop':variant==='home-help','light-help-backdrop':variant==='light-help','delete-account-backdrop':variant==='delete-account-prompt','avatar-premium-backdrop':variant==='avatar-premium'}" @click.self="!coachTarget&&dismissOnBackdrop&&closable && $emit('close')"><div v-if="coachTarget" class="coach-highlight" :style="highlightStyle" aria-hidden="true"/><section ref="panel" class="modal-panel" :class="{'coach-panel':coachTarget,'coach-orb-right':coachTarget&&coachSide==='right','design-sheet':sheet,'popover-panel':anchor,'centered-panel':centered,'personal-confirm':['personal-confirm','account-confirm'].includes(variant),'account-confirm':variant==='account-confirm','home-help-panel':variant==='home-help','mark-read-panel':variant==='mark-read','light-help-panel':variant==='light-help','safety-panel':variant==='safety','connection-panel':variant==='connection','compose-collection-editor':variant==='compose-collection','delete-account-prompt':variant==='delete-account-prompt','avatar-premium-prompt':variant==='avatar-premium'}" :style="coachTarget||anchor?coachStyle:undefined" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1"><div v-if="variant==='connection'" class="connection-modal-art" aria-hidden="true"><img src="/images/p3/connection-star.png" alt="" draggable="false"/></div><header v-if="!hideHeader" class="modal-header" :class="{'sr-only':coachTarget}"><button v-if="sheet&&closable&&!coachTarget" class="icon-button sheet-close" :aria-label="t('close')" @click="$emit('close')"><AppIcon name="close" /></button><h2>{{ title }}</h2><slot name="headerAction"/><button v-if="!sheet&&closable&&!coachTarget" class="icon-button" :aria-label="t('close')" @click="$emit('close')"><AppIcon name="close" /></button></header><div class="modal-body"><slot /></div><footer v-if="$slots.footer" class="modal-footer"><slot name="footer" /></footer><span v-if="coachTarget" class="coach-orb" aria-hidden="true"/></section></div></Teleport></template>

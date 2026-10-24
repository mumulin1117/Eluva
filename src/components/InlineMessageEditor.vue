<script setup>
import { ref,onMounted,onBeforeUnmount,watch } from 'vue'
import { t } from '../state.js'
import { stickerIds } from '../data/social-demo.js'
import { normalizeMessageParts,messagePartUnits,replaceMessageRange,previousMessageUnit } from '../domain/message-parts.js'
const props=defineProps({modelValue:{type:Array,default:()=>[]},disabled:Boolean,placeholder:String,id:String})
const emit=defineEmits(['update:modelValue','focus','submit','invalid','composition'])
const root=ref(null),empty=ref(!props.modelValue.length),stickers=new Set(stickerIds)
let selection={start:messagePartUnits(props.modelValue),end:messagePartUnits(props.modelValue)},composing=false,lastEmitted='',alive=true
function readParts(node){
 const parts=[]
 function text(value){if(value)parts.push({type:'text',text:value})}
 function visit(parent){let previous=null;for(const child of parent.childNodes){
  const block=child.nodeType===Node.ELEMENT_NODE&&['DIV','P'].includes(child.tagName),previousBlock=previous?.nodeType===Node.ELEMENT_NODE&&['DIV','P'].includes(previous.tagName)
  if(previous&&(block||previousBlock))text('\n')
  if(child.nodeType===Node.TEXT_NODE)text(child.nodeValue)
  else if(child.nodeType===Node.ELEMENT_NODE){
   if(child.tagName==='IMG'){if(stickers.has(child.dataset.stickerId))parts.push({type:'sticker',stickerId:child.dataset.stickerId})}
   else if(child.tagName==='BR')text('\n')
   else if(!(block&&child.childNodes.length===1&&child.firstChild?.nodeName==='BR'))visit(child)
  }
  previous=child
 }}
 visit(node)
 // WebKit inserts a single placeholder <br> into an empty editable.
 if(node===root.value&&node.childNodes.length===1&&node.firstChild?.nodeName==='BR')return []
 return parts
}
function remember(){
 const current=window.getSelection();if(!root.value||!current?.rangeCount)return
 const range=current.getRangeAt(0);if(!root.value.contains(range.startContainer)||!root.value.contains(range.endContainer))return
 const lengthAt=(node,offset)=>{const prefix=document.createRange();prefix.selectNodeContents(root.value);prefix.setEnd(node,offset);return messagePartUnits(readParts(prefix.cloneContents()))}
 selection={start:lengthAt(range.startContainer,range.startOffset),end:lengthAt(range.endContainer,range.endOffset)}
}
function restore(focus=false){
 const el=root.value;if(!el)return
 if(focus)el.focus({preventScroll:true})
 const locate=position=>{let left=position;for(let i=0;i<el.childNodes.length;i++){const node=el.childNodes[i],length=node.nodeType===Node.TEXT_NODE?node.nodeValue.length:1;if(left<=length){if(node.nodeType===Node.TEXT_NODE)return [node,left];return [el,i+(left?1:0)]}left-=length}return [el,el.childNodes.length]}
 const start=locate(selection.start),end=locate(selection.end),range=document.createRange();range.setStart(...start);range.setEnd(...end);const current=window.getSelection();current.removeAllRanges();current.addRange(range)
}
function resize(){const el=root.value;if(!el)return;el.style.maxHeight=Math.max(44,Math.min(120,(window.visualViewport?.height||innerHeight)*.25))+'px';if(document.activeElement===el)el.scrollIntoView({block:'nearest',inline:'nearest'})}
function render(parts){
 const el=root.value;if(!el)return
 const fragment=document.createDocumentFragment()
 for(const part of parts){if(part.type==='text')fragment.append(document.createTextNode(part.text));else{const image=document.createElement('img');image.src='/images/p3/'+part.stickerId+'.png';image.dataset.stickerId=part.stickerId;image.alt=t('s.emoji');image.contentEditable='false';image.draggable=false;fragment.append(image)}}
 el.replaceChildren(fragment);lastEmitted=JSON.stringify(parts);empty.value=!parts.length;resize()
}
function publish(parts){lastEmitted=JSON.stringify(parts);empty.value=!parts.length;emit('update:modelValue',parts);resize()}
function changed(){if(!alive||!root.value||composing)return;if(props.disabled){render(props.modelValue);return}remember();try{const parts=normalizeMessageParts(readParts(root.value));publish(parts)}catch{emit('invalid');render(props.modelValue);restore(document.activeElement===root.value)}}
function insert(parts,{rememberSelection=true}={}){if(props.disabled||composing)return;if(rememberSelection)remember();try{const next=replaceMessageRange(props.modelValue,selection.start,selection.end,parts);selection={start:selection.start+messagePartUnits(parts),end:selection.start+messagePartUnits(parts)};render(next);publish(next);restore()}catch{emit('invalid')}}
function insertSticker(stickerId){if(stickers.has(stickerId))insert([{type:'sticker',stickerId}])}
function eraseBackward(){if(props.disabled||composing)return;remember();if(selection.start===selection.end)selection.start=previousMessageUnit(props.modelValue,selection.start);insert([],{rememberSelection:false})}
function paste(event){event.preventDefault();const text=event.clipboardData?.getData('text/plain')||'';if(text)insert([{type:'text',text}])}
function beforeInput(event){if(event.inputType==='insertFromDrop')event.preventDefault();else if(!composing&&['insertParagraph','insertLineBreak'].includes(event.inputType)){event.preventDefault();insert([{type:'text',text:'\n'}])}}
function compositionStart(){if(!alive)return;composing=true;emit('composition',true)}
function compositionEnd(){if(!alive||!root.value)return;composing=false;emit('composition',false);changed()}
function keydown(event){if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!composing){event.preventDefault();emit('submit')}}
watch(()=>props.modelValue,parts=>{if(JSON.stringify(parts)===lastEmitted||composing)return;const focused=document.activeElement===root.value;remember();render(parts);const size=messagePartUnits(parts);selection={start:Math.min(selection.start,size),end:Math.min(selection.end,size)};if(focused)restore()},{deep:true})
onMounted(()=>{render(props.modelValue);document.addEventListener('selectionchange',remember);window.visualViewport?.addEventListener('resize',resize)})
onBeforeUnmount(()=>{alive=false;document.removeEventListener('selectionchange',remember);window.visualViewport?.removeEventListener('resize',resize)})
defineExpose({insertSticker,eraseBackward,remember,focus:()=>restore(true)})
</script>
<template><div ref="root" :id="id" class="inline-message-editor" :contenteditable="disabled?'false':'true'" role="textbox" aria-multiline="true" :aria-label="placeholder" :aria-disabled="disabled" :data-empty="empty" :data-placeholder="placeholder" spellcheck="true" @input="changed" @beforeinput="beforeInput" @paste="paste" @keydown="keydown" @compositionstart="compositionStart" @compositionend="compositionEnd" @focus="emit('focus')" @blur="remember" @pointerup="remember"/></template>

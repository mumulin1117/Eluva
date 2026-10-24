<script setup>
import { ref,onBeforeUnmount } from 'vue'
import { bridge,state,t,run } from '../state.js'
import { validateMediaFile,readBase64 } from '../services/media-files.js'
import AppModal from './AppModal.vue'
import ActionButton from './ActionButton.vue'
import AppIcon from './AppIcon.vue'
import MediaRecovery from './MediaRecovery.vue'
const props=defineProps({draftId:String,photos:Array,max:{type:Number,default:9},label:String,ready:Boolean,ordered:{type:Boolean,default:true},replace:Boolean,replaceLabel:String})
const emit=defineEmits(['update:photos'])
const opened=ref(false),file=ref(null);let alive=true,changePrimary=false
function open(primary=false){changePrimary=primary;opened.value=true}
defineExpose({changeMain:()=>open(true)})
onBeforeUnmount(()=>alive=false)
async function pick(source){opened.value=false;if(!bridge.isNative){if(source==='camera')state.ui.error='DEVICE_UNSUPPORTED';else file.value.click();return}await run('personal-media',async signal=>{const r=await bridge.call('media','pick',{source,draftId:props.draftId,imagesOnly:true},{signal,timeout:120000});if(alive&&!signal.aborted&&r.photos.length){const added=r.photos.map(x=>({...x,staged:true})),next=props.replace?added:changePrimary?[...added,...props.photos.slice(1)]:[...props.photos,...added];emit('update:photos',next.slice(0,props.max))}})}
async function files(e){const selected=[...e.target.files],base=props.replace?[]:changePrimary?props.photos.slice(1):[...props.photos],photos=[];e.target.value='';await run('personal-media',async signal=>{for(const f of selected.slice(0,props.max-base.length)){await validateMediaFile(f,signal,{imagesOnly:true});const r=await bridge.call('media','import',{draftId:props.draftId,base64:await readBase64(f,signal),mime:f.type},{signal});if(alive&&!signal.aborted){photos.push({...r,staged:true});emit('update:photos',changePrimary||props.replace?[...photos,...base]:[...base,...photos])}}})}
async function remove(photo){if(photo.staged){if(!await run('personal-remove',signal=>bridge.call('media','remove',{draftId:props.draftId,id:photo.id},{signal})))return}emit('update:photos',props.photos.filter(x=>x.id!==photo.id))}
function main(index){const a=[...props.photos],p=a.splice(index,1)[0];a.unshift(p);emit('update:photos',a)}
</script>
<template><div class="personal-photo-grid"><figure v-for="(photo,i) in photos" :key="photo.id"><img :src="photo.url||'/images/default-avatar.svg'" :alt="t('photoNumber',{n:i+1})"/><div><button v-if="ordered&&i" class="text-link" :disabled="!!state.ui.busy" @click="main(i)">{{ t('makeMain') }}</button><span v-else-if="ordered">{{ t('mainPhoto') }}</span><button v-if="replace" class="text-link cover-replace" :disabled="!!state.ui.busy||!ready" @click="open()"><AppIcon name="camera" :size="18"/>{{ replaceLabel||label }}</button><button class="icon-button" :aria-label="t('remove')+' '+t('photoNumber',{n:i+1})" :disabled="!!state.ui.busy" @click="remove(photo)"><AppIcon name="close" :size="18"/></button></div></figure><button v-if="photos.length<max" class="personal-photo-add" :disabled="!ready||!!state.ui.busy" @click="open()"><slot name="add"><AppIcon name="image" :size="28"/><span>{{ label||t('addPhoto') }}</span></slot></button></div><input ref="file" type="file" accept="image/png,image/jpeg,image/webp" class="file-input" :multiple="max!==1" aria-hidden="true" tabindex="-1" @change="files"/><MediaRecovery @choose="opened=true" /><AppModal v-if="opened" :title="t('photoSource')" @close="opened=false"><div class="source-actions"><ActionButton secondary @click="pick('library')">{{ t('photoLibrary') }}</ActionButton><ActionButton secondary @click="pick('camera')">{{ t('takePhoto') }}</ActionButton></div></AppModal></template>

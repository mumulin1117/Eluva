<script setup>
import { ref } from 'vue'
import { state,t,bridge,run,fail } from '../state.js'
import { content } from '../content-state.js'
import { contentPolicy } from '../domain/content.js'
import { readBase64,validateMediaFile } from '../services/media-files.js'
import AppIcon from './AppIcon.vue'
import AppModal from './AppModal.vue'
import ActionButton from './ActionButton.vue'
import MediaRecovery from './MediaRecovery.vue'
const props=defineProps({imagesOnly:Boolean})
const emit=defineEmits(['picked'])
const opened=ref(false),input=ref(null)
function accept(items){const d=content.draft,all=[...d.media,...items];if(!props.imagesOnly && (all.some(x=>x.kind==='video')?all.length>1:all.length>contentPolicy.imageLimit))return false;if(props.imagesOnly)emit('picked',items[0]);else d.media.push(...items);return true}
async function pick(source){opened.value=false;if(bridge.isNative)await run('content-media',async signal=>{const result=await bridge.call('media','pick',{source,draftId:content.draft.id,imagesOnly:props.imagesOnly},{signal,timeout:120000});if(!accept(result.photos)){for(const x of result.photos)await bridge.call('media','remove',{id:x.id,draftId:content.draft.id});fail('MEDIA_LIMIT')}});else if(source==='camera')state.ui.error='DEVICE_UNSUPPORTED';else input.value.click()}
async function changed(event){const files=[...event.target.files];event.target.value='';await run('content-media',async signal=>{for(const file of files){const kind=await validateMediaFile(file,signal,{imagesOnly:props.imagesOnly}),d=content.draft;const all=[...d.media,{kind}];if(!props.imagesOnly && (all.some(x=>x.kind==='video')?all.length>1:all.length>contentPolicy.imageLimit))fail('MEDIA_LIMIT');const base64=await readBase64(file,signal),media=await bridge.call('media','import',{draftId:d.id,mime:file.type,base64},{signal,timeout:120000});accept([media]);if(props.imagesOnly)break}})}
async function remove(media){await run('content-media',async signal=>{await bridge.call('media','remove',{id:media.id,draftId:content.draft.id},{signal});content.draft.media=content.draft.media.filter(x=>x.id!==media.id)})}
</script>
<template><div :class="imagesOnly?'cover-picker':'post-media-grid'"><template v-if="!imagesOnly"><figure v-for="(m,i) in content.draft?.media" :key="m.id" class="post-media-thumb"><video v-if="m.kind==='video'" :src="m.url" muted playsinline preload="metadata" /><img v-else :src="m.url" :alt="t('photoNumber',{n:i+1})" draggable="false" /><span v-if="m.kind==='video'" class="video-label">{{ t('p2.video') }}</span><button class="media-remove" :aria-label="t('p2.removeMedia',{n:i+1})" :disabled="!!state.ui.busy" @click="remove(m)"><AppIcon name="close" :size="16" /></button></figure></template><button class="post-media-add" :disabled="!!state.ui.busy||!content.draft?.ready" :aria-label="t(imagesOnly?'p2.cover':'p2.addMedia')" @click="opened=true"><img src="/images/p2/media-add.png" alt="" draggable="false" /><span v-if="imagesOnly">{{ t('p2.cover') }}</span></button></div><input ref="input" class="file-input" type="file" :accept="imagesOnly?'image/jpeg,image/png,image/webp':'image/jpeg,image/png,image/webp,video/mp4,video/quicktime'" :multiple="!imagesOnly" :aria-label="t('p2.addMedia')" @change="changed" /><MediaRecovery @choose="opened=true" /><AppModal v-if="opened" :title="t('p2.addMedia')" @close="opened=false"><div class="source-actions"><ActionButton secondary @click="pick('library')">{{ t('p2.chooseLibrary') }}</ActionButton><ActionButton secondary @click="pick('camera')">{{ t('p2.camera') }}</ActionButton></div></AppModal></template>

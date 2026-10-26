<script setup>
import { computed,ref } from 'vue'
import { state } from '../state.js'
import { useMembership } from '../composables-membership.js'
import AppIcon from './AppIcon.vue'
import AvatarFrame from './AvatarFrame.vue'
const props=defineProps({person:Object,size:{type:Number,default:60},frameId:{type:String,default:undefined},frameActive:{type:Boolean,default:undefined},showBadge:{type:Boolean,default:true}})
const mine=computed(()=>!!state.user?.id&&props.person?.id===state.user.id)
const {membership}=useMembership({refreshSnapshot:false,readSnapshotIfMissing:mine})
const profile=computed(()=>mine.value?state.user.profile:props.person)
const selectedFrame=computed(()=>props.frameId===undefined?profile.value?.avatarFrameId:props.frameId)
const active=computed(()=>props.frameActive===undefined?(mine.value?membership.value.active:props.person?.proActive===true):props.frameActive)
const hasFrame=computed(()=>active.value&&/^frame-[1-6]$/.test(selectedFrame.value||''))
// Frame 3 has a wider portrait opening in the original transparent asset.
const photoInset=computed(()=>selectedFrame.value==='frame-3'?'5%':'10%')
const photo=computed(()=>profile.value?.photos?.[0]?.url||''),failedPhoto=ref('')
</script>
<template><span class="person-avatar" :class="{'has-frame':hasFrame}" :style="{width:size+'px',height:size+'px','--avatar-photo-inset':photoInset}"><span class="person-avatar-surface"><img v-if="photo&&failedPhoto!==photo" :src="photo" alt="" draggable="false" @error="failedPhoto=photo"/><AppIcon v-else name="user" :size="Math.round(size*.52)"/></span><AvatarFrame :frame-id="selectedFrame" :active="active"/><img v-if="showBadge&&active" class="person-avatar-pro" src="/images/p6/pro-badge.svg" alt="PRO" draggable="false"/></span></template>
<style scoped>
.person-avatar{position:relative;display:inline-flex;flex-shrink:0;border-radius:50%;overflow:visible;background:transparent;color:#6b3198}
.person-avatar-surface{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;background:#f2e5ff}
.person-avatar-surface>img{width:100%;height:100%;object-fit:cover}
.person-avatar.has-frame .person-avatar-surface{inset:var(--avatar-photo-inset)}
.person-avatar-pro{position:absolute;width:40%;height:auto;max-width:28px;bottom:-3px;left:50%;transform:translateX(-50%);object-fit:contain;pointer-events:none}
</style>

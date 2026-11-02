<script setup>
import { computed,onMounted } from 'vue'
import { router } from '../router.js'
import { state,t } from '../state.js'
import { personal,loadPersonal } from '../personal-state.js'
import { commerceAction } from '../commerce-state.js'
import { useMembership } from '../composables-membership.js'
import { person,social } from '../social-state.js'
import ContentShell from '../components/ContentShell.vue'
import AppTabBar from '../components/AppTabBar.vue'
import ActionButton from '../components/ActionButton.vue'
import AppIcon from '../components/AppIcon.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
const p=computed(()=>state.user?.profile),self=computed(()=>person(state.user?.id))
const relationshipCounts=computed(()=>{
 const visible=social.profiles.filter(person=>!person.relationship?.blocked)
 return {friends:self.value?.counts?.friends||0,following:visible.filter(person=>person.relationship?.following).length,followers:visible.filter(person=>person.relationship?.followedBy).length}
})
const {membership,expiry,inactiveKey}=useMembership()
onMounted(async()=>{await loadPersonal({reuse:true});await commerceAction('snapshot',true)})
const entries=[['my-lights','lights','p2.myLights'],['my-posts','posts','p2.myPosts'],['collections','collections','s.collections'],['settings','settings','p5.settings'],['feedback','feedback','p5.feedback']]
</script>
<template><ContentShell class="mine-shell p5-shell" :title="t('mine')" :ready="personal.loaded" :show-error="personal.loaded"><div v-if="!personal.loaded" class="content-state"><p v-if="state.ui.error" class="error-banner" role="alert" :data-error-code="state.ui.error">{{ t('p5.loadFailed') }}</p><p v-else>{{ t('working') }}</p><ActionButton v-if="!state.ui.busy" @click="loadPersonal">{{ t('retry') }}</ActionButton></div><template v-else-if="p"><button class="mine-identity" :aria-label="t('p5.editProfile')" @click="router.push('/edit-profile')"><div class="mine-avatar-wrap"><PersonAvatar :person="{...p,id:state.user.id}" :size="70" :frame-active="membership.active"/></div><span><strong>{{ p.displayName||t('notProvided') }}</strong><small class="mine-id"><img src="/images/p5/id-badge.png" alt="ID"/><span>{{ state.user.isTest?'ELV10001':state.user.id }}</span></small><p>{{ p.about||t('s.noAbout') }}</p></span><AppIcon name="arrow" :size="16"/></button><button class="mine-pro" :class="{'mine-pro-active':membership.active}" @click="router.push('/store?from=/mine')"><span><strong>{{ t(membership.active?'p6.proActivated':'p5.upgrade') }}</strong><small>{{ membership.active?t('p6.proValidUntil',{date:expiry}):membership.status!=='none'?t('p6.'+inactiveKey,{date:expiry}):t('p5.upgradeHint') }}</small><small v-if="membership.active&&membership.environment!=='production'">{{ t('p6.'+membership.environment) }}</small></span><img src="/images/p5/pro-emblem.png" alt=""/></button><div class="mine-counts"><button v-for="[key,label] in [['friends','friends'],['following','following'],['followers','followers']]" :key="key" @click="router.push(key==='friends'?{path:'/friends',query:{from:'/mine'}}:{name:key,query:{from:'/mine'}})"><strong>{{ relationshipCounts[key] }}</strong><span>{{ t('s.'+label) }}</span></button></div><nav class="mine-grid" :aria-label="t('mine')"><button v-for="[path,icon,label] in entries" :key="path" @click="router.push('/'+path)"><img :src="'/images/p5/mine-'+icon+'.png'" alt=""/><span>{{ t(label) }}</span></button></nav><button class="mine-help" @click="router.push('/help?from=/mine')"><img src="/images/p5/mine-help.png" alt=""/><span>{{ t('p5.help') }}</span><AppIcon name="arrow" :size="16"/></button></template><template #tabs><AppTabBar/></template></ContentShell></template>

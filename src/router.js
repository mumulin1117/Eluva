import { createRouter, createWebHashHistory } from 'vue-router'
import { watch } from 'vue'
import { state, bootstrap, canNavigate, cancelTransient, clearError } from './state.js'
import { social } from './social-state.js'
import { content } from './content-state.js'
import { scrollPositions, scrollKey, blockedReturnPath } from './domain/navigation.js'
import AuthView from './views/AuthView.vue'
import ProfileEditView from './views/ProfileEditView.vue'
import CollectionsView from './views/CollectionsView.vue'
import SettingsView from './views/SettingsView.vue'
import FeedbackView from './views/FeedbackView.vue'
import StoreView from './views/StoreView.vue'
import MainView from './views/MainView.vue'
import ChatsView from './views/ChatsView.vue'
import LightNoticesView from './views/LightNoticesView.vue'
import VideoCallView from './views/VideoCallView.vue'
import ProfileView from './views/ProfileView.vue'
import ReportView from './views/ReportView.vue'
import ProfileCollectionsView from './views/ProfileCollectionsView.vue'
import FriendsView from './views/FriendsView.vue'
import FollowListView from './views/FollowListView.vue'
import ConversationView from './views/ConversationView.vue'
import HelpView from './views/HelpView.vue'
import LegalView from './views/LegalView.vue'
import HomeView from './views/HomeView.vue'
import PostComposerView from './views/PostComposerView.vue'
import PostDetailView from './views/PostDetailView.vue'
import PostListView from './views/PostListView.vue'

export const onboarding = ['basic', 'university', 'major', 'photos', 'about', 'interests', 'goal', 'icebreakers', 'notifications']
const authPaths = { age: 'age', community: 'community', signup: 'sign-up', login: 'log-in', verifyEmail: 'verify/email', verifyCode: 'verify/code', verifySuccess: 'verify/success', resetEmail: 'password/email', resetCode: 'password/code', resetNew: 'password/new' }
const routes = [
  { path: '/', redirect: '/welcome' }, { path: '/welcome', name: 'welcome', component: AuthView, meta: { authFlow: true } },
  ...Object.entries(authPaths).map(([name, path]) => ({ path: '/auth/' + path, name, component: AuthView, meta: { auth: true, authFlow: true } })),
  ...[...onboarding, 'complete'].map(name => ({ path: '/onboarding/' + name, name, component: AuthView, meta: { onboarding: true, authFlow: true } })),
  {path:'/home',name:'home',component:HomeView,meta:{main:true}},
  {path:'/chats',name:'chats',component:ChatsView,meta:{main:true}},
  {path:'/chats/lights',name:'lightNotices',component:LightNoticesView,meta:{protected:true}},
  ...['mine'].map(name => ({ path: '/' + name, name, component: MainView, meta: { main: true } })),
  ...[['/store','store'],['/store/benefits','storeBenefits'],['/store/wallet','storeWallet']].map(([path,name])=>({path,name,component:StoreView,meta:{protected:true}})),
  {path:'/edit-profile',name:'profileEdit',component:ProfileEditView,meta:{protected:true}},
  {path:'/collections',name:'collections',component:CollectionsView,meta:{protected:true}},
  {path:'/collections/:id',name:'collection',component:CollectionsView,meta:{protected:true}},
  {path:'/collections/:id/posts',name:'collectionPosts',component:CollectionsView,meta:{protected:true}},
  ...[['/settings','settings'],['/settings/theme','settingsTheme'],['/settings/language','settingsLanguage'],['/settings/blocked','blocked'],['/settings/delete-account','deleteAccount']].map(([path,name])=>({path,name,component:SettingsView,meta:{protected:true}})),
  {path:'/settings/about',redirect:'/settings'},
  {path:'/feedback',name:'feedback',component:FeedbackView,meta:{protected:true}},
  {path:'/profile/:id',name:'profile',component:ProfileView,meta:{protected:true}},
  {path:'/profile/:id/report',name:'reportUser',component:ReportView,meta:{protected:true}},
  {path:'/profile/:id/collections',name:'profileCollections',component:ProfileCollectionsView,meta:{protected:true}},
  {path:'/friends',name:'friends',component:FriendsView,meta:{protected:true}},
  {path:'/friend-requests',name:'friendRequests',component:FriendsView,meta:{protected:true}},
  {path:'/following',name:'following',component:FollowListView,meta:{protected:true}},
  {path:'/followers',name:'followers',component:FollowListView,meta:{protected:true}},
  {path:'/conversation/:peer',name:'conversation',component:ConversationView,meta:{protected:true}},
  {path:'/conversation/:peer/photo/:message',name:'chatPhoto',component:ConversationView,meta:{protected:true}},
  {path:'/call/:peer',name:'videoCall',component:VideoCallView,meta:{protected:true}},
  {path:'/help',name:'help',component:HelpView,meta:{protected:true}},
  {path:'/compose',name:'compose',component:PostComposerView,meta:{protected:true}},
  {path:'/post/:id',name:'post',component:PostDetailView,meta:{protected:true}},
  {path:'/post/:id/report',name:'reportPost',component:ReportView,meta:{protected:true}},
  {path:'/post/:id/media/:index',name:'postMedia',component:PostDetailView,meta:{protected:true}},
  ...[['my-posts','myPosts'],['my-lights','myLights']].map(([path,name])=>({path:'/'+path,name,component:PostListView,meta:{protected:true}})),
  ...['terms', 'privacy', 'guidelines', 'eula'].map(name => ({ path: '/legal/' + name, name, component: LegalView, meta: { legal: true } })),
  { path: '/:pathMatch(.*)*', redirect: '/welcome' },
]
export const router = createRouter({ history: createWebHashHistory(), routes })
export function blockedDestination(to){
  if(!state.user||social.ownerId!==state.user.id)return
  const peer=['profile','profileCollections','reportUser'].includes(to.name)?to.params.id:['conversation','chatPhoto'].includes(to.name)?to.params.peer:null
  const blockedPeerIds=social.profiles.filter(p=>p.relationship?.blocked).map(p=>p.id)
  if(peer&&blockedPeerIds.includes(String(peer)))return blockedReturnPath(to.query.from,{blockedPeerIds,posts:content.posts})
}
watch(()=>[state.user?.id,social.ownerId,social.profiles.filter(p=>p.relationship?.blocked).map(p=>p.id).sort().join('|'),state.ui.busy,router.currentRoute.value.fullPath],()=>{
  const destination=blockedDestination(router.currentRoute.value)
  if(destination&&canNavigate())router.replace(destination)
})
let ready
router.beforeEach(async (to, from) => {
  if (!canNavigate()) return false
  window.dispatchEvent(new CustomEvent('eluva:cancel-interactions',{detail:{reason:'navigation'}}))
  if (from.fullPath) scrollPositions.set(scrollKey(from.fullPath,state.user?.id), document.querySelector('.page-content')?.scrollTop || 0)
  cancelTransient()
  if (!ready) ready = bootstrap()
  await ready
  if (state.bootError) return true
  if (to.meta.legal) return true
  if (state.user && (to.meta.auth || to.meta.onboarding || to.name === 'welcome')) return { name: 'home' }
  if ((to.meta.main || to.meta.protected) && !state.user) return { name: 'welcome' }
  const blocked=blockedDestination(to)
  if(blocked){const destination=router.resolve(blocked);return {path:destination.path,query:destination.query,hash:destination.hash,replace:true}}
  if ((to.meta.auth || to.meta.onboarding) && !state.consent) { state.ui.modal = 'eula'; return { name: 'welcome' } }
  if (to.fullPath !== from.fullPath) clearError()
  return true
})
router.afterEach((to, from) => {
  if (from.meta.legal && state.legalReturn?.path === to.fullPath && state.legalReturn.modal) state.ui.modal = state.legalReturn.modal
})
export function openLegal(name) {
  state.legalReturn = { path: router.currentRoute.value.fullPath, modal: state.ui.modal }
  state.ui.modal = ''
  return router.push({ name })
}
export function returnLegal() { return router.push(state.legalReturn?.path || (state.user ? '/mine' : '/welcome')) }

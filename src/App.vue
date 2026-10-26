<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { state,t,bridge,bootstrap,run,saveConsent,canNavigate,finishSignOut } from './state.js'
import { router,openLegal,blockedDestination } from './router.js'
import AppModal from './components/AppModal.vue'
import ActionButton from './components/ActionButton.vue'
import AppToast from './components/AppToast.vue'
import AppLoadingToast from './components/AppLoadingToast.vue'
import { resetContent } from './content-state.js'
import { resetSocial } from './social-state.js'
import { firstFrameSources, launchRecoveryTarget, prepareFirstFrame } from './services/launch-presentation.js'
import { installNavigationMotion } from './services/navigation-motion.js'
import { installTouchPolicy,isEditableTarget } from './services/touch-policy.js'
import './launch.css'
import './navigation-motion.css'
watch(()=>state.theme,value=>{document.documentElement.dataset.theme=value||'purple'},{immediate:true})
const pageHost=ref(null),mountedRoute=ref(''),retrying=ref(false)
let readySent=false,readyOperation=null,disposed=false,failedLaunch='',removeTouchPolicy
const navigationMotion=installNavigationMotion(router,{getHost:()=>pageHost.value,isReady:()=>readySent&&!state.booting&&!state.bootError,ownerId:()=>state.user?.id,canCapture:from=>!blockedDestination(from)})
watch(()=>state.user?.id,(id,previous)=>{if(id!==previous){navigationMotion.reset();resetContent();resetSocial()}})
function viewport(){const v=window.visualViewport;document.documentElement.style.setProperty('--visual-height',(v?.height||window.innerHeight)+'px');document.documentElement.style.setProperty('--visual-top',(v?.offsetTop||0)+'px');const active=document.activeElement;if(isEditableTarget(active))active.scrollIntoView({block:'nearest',inline:'nearest'})}
function cancelReady(){const operation=readyOperation;readyOperation=null;operation?.controller.abort()}
function routeRendered(path){mountedRoute.value=path}
async function reportStartupFailure(code){
 const launchId=window.__ELUVA_BOOT__?.launchId
 if(!bridge.isNative||!launchId||failedLaunch===launchId+'|'+code||disposed)return
 failedLaunch=launchId+'|'+code
 try{await bridge.call('app','startupFailed',{launchId,code},{timeout:3000})}catch{/* Native also retains its independent branded timeout recovery. */}
}
async function signalReady(){
 if(readySent||readyOperation||disposed||document.hidden||retrying.value||state.booting||state.bootError)return
 const route=router.currentRoute.value
 if(!mountedRoute.value||mountedRoute.value!==route.fullPath||!pageHost.value?.firstElementChild)return
 const operation={controller:new AbortController(),path:route.fullPath,launchId:window.__ELUVA_BOOT__?.launchId??null}
 readyOperation=operation
 const current=()=>!disposed&&!document.hidden&&readyOperation===operation&&!operation.controller.signal.aborted&&!state.booting&&!state.bootError&&!retrying.value&&router.currentRoute.value.fullPath===operation.path&&mountedRoute.value===operation.path&&(window.__ELUVA_BOOT__?.launchId??null)===operation.launchId
 try{
  await router.isReady();await nextTick()
  if(!current())return
  const page=pageHost.value?.firstElementChild,rect=page?.getBoundingClientRect()
  if(!page?.isConnected||!rect||rect.width<=0||rect.height<=0)throw new Error('First route is not rendered')
  await prepareFirstFrame(firstFrameSources(pageHost.value,route.name),{signal:operation.controller.signal})
  if(!current())return
  const destination=route.name==='welcome'?'welcome':route.name==='home'?'home':'other'
  const result=await bridge.call('app','ready',{firstFrame:true,launchId:operation.launchId,destination},{signal:operation.controller.signal})
  if(!current())return
  if(result?.ready!==true)throw new Error('First frame was not accepted')
  readySent=true
  const welcomeMotion=['full','brief','reduced'].includes(result.welcomeMotion)?result.welcomeMotion:'brief'
  window.__ELUVA_BOOT__={...window.__ELUVA_BOOT__,launchReady:true,welcomeMotion}
  window.dispatchEvent(new CustomEvent('eluva:launch-prepared',{detail:{launchId:operation.launchId,welcomeMotion}}))
 }catch(error){
  if(current()&&error?.code!=='CANCELLED')state.bootError=error?.code==='TIMEOUT'?'TIMEOUT':'RESOURCE_MISSING'
 }finally{if(readyOperation===operation)readyOperation=null}
}
watch(()=>[state.booting,state.bootError,retrying.value,router.currentRoute.value.fullPath,mountedRoute.value],()=>{
 if(readySent)return
 const route=router.currentRoute.value
 if(state.booting||state.bootError||retrying.value||readyOperation?.path!==route.fullPath||mountedRoute.value!==route.fullPath)cancelReady()
 if(state.bootError){reportStartupFailure(state.bootError);return}
 signalReady()
},{flush:'post'})
function launchVisibilityChanged(){if(readySent)return;if(document.hidden)cancelReady();else signalReady()}
function suspendInteractions(){window.dispatchEvent(new CustomEvent('eluva:cancel-interactions',{detail:{reason:'background'}}))}
function visibilityChanged(){if(document.hidden)suspendInteractions();launchVisibilityChanged()}
async function retryBootstrap(){
 if(retrying.value||state.booting)return
 retrying.value=true;cancelReady();failedLaunch=''
 try{
  await bootstrap()
  if(disposed||state.bootError)return
  const target=launchRecoveryTarget(router.currentRoute.value,state)
  if(target)await router.replace(target)
  await nextTick()
 }finally{retrying.value=false}
}
onMounted(()=>{removeTouchPolicy=installTouchPolicy();viewport();signalReady();window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);window.addEventListener('resize',viewport);window.addEventListener('pagehide',suspendInteractions);document.addEventListener('visibilitychange',visibilityChanged)})
onBeforeUnmount(()=>{disposed=true;removeTouchPolicy?.();navigationMotion.dispose();cancelReady();window.visualViewport?.removeEventListener('resize',viewport);window.visualViewport?.removeEventListener('scroll',viewport);window.removeEventListener('resize',viewport);window.removeEventListener('pagehide',suspendInteractions);document.removeEventListener('visibilitychange',visibilityChanged);bridge.dispose()})
async function logout(){await run('logout',async(signal,finished)=>{await bridge.call('auth','logout',{}, {signal});finishSignOut();finished();await router.replace({name:'welcome'})},{critical:true})}
</script>
<template>
  <AppToast />
  <AppLoadingToast />
  <div v-if="state.booting" class="launch-screen" role="status" aria-label="Eluva"><img class="launch-logo" src="/images/launch-logo.png" alt="" draggable="false" /></div>
  <div v-else-if="state.bootError" class="launch-screen launch-failure"><img class="launch-logo" src="/images/launch-logo.png" alt="" draggable="false" /><section class="launch-failure-details" role="alert"><h1>{{ t('bootErrorTitle') }}</h1><p>{{ t('bootErrorHint') }}</p><ActionButton :busy="retrying" @click="retryBootstrap">{{ t('retry') }}</ActionButton></section></div>
  <div v-else ref="pageHost" class="launch-page-host navigation-page-host" :data-launch-route="mountedRoute"><RouterView v-slot="{Component,route}"><component :is="Component" @vue:mounted="routeRendered(route.fullPath)" @vue:updated="routeRendered(route.fullPath)" /></RouterView></div>
  <AppModal v-if="state.ui.modal==='eula'&&!state.booting&&!state.bootError" :title="t('eulaTitle')" :closable="false"><div class="eula-content"><p class="eula-intro">{{ t('eulaIntro') }}</p><div class="eula-row"><img src="/images/eula-shield.png" alt="" draggable="false" /><p>{{ t('eulaPolicy') }} <button class="text-link" @click="openLegal('terms')">{{ t('terms') }}</button> · <button class="text-link" @click="openLegal('privacy')">{{ t('privacy') }}</button></p></div><div class="eula-row"><img src="/images/eula-age.png" alt="" draggable="false" /><p>{{ t('eulaAge') }}</p></div><div class="eula-row"><img src="/images/eula-contact.png" alt="" draggable="false" /><p>{{ t('eulaLocal') }}</p></div><p v-if="state.ui.error" role="alert" class="error-banner">{{ t('errors.'+state.ui.error) }}</p></div><template #footer><ActionButton secondary :disabled="!!state.ui.busy" @click="saveConsent(false)">{{ t('disagree') }}</ActionButton><ActionButton :busy="state.ui.busy==='consent'" :disabled="!!state.ui.busy" @click="saveConsent(true)">{{ t('agree') }}</ActionButton></template></AppModal>
  <AppModal v-else-if="state.ui.modal==='logout'" :title="t('logoutTitle')" :closable="canNavigate()" @close="state.ui.modal=''"><p>{{ t('logoutHint') }}</p><p v-if="state.ui.error" role="alert" class="error-banner">{{ t('errors.'+state.ui.error) }}</p><template #footer><ActionButton secondary :disabled="!!state.ui.busy" @click="state.ui.modal=''">{{ t('cancel') }}</ActionButton><ActionButton :busy="state.ui.busy==='logout'" @click="logout">{{ t('logout') }}</ActionButton></template></AppModal>
</template>

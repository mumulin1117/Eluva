import { actionNotice } from './domain/notice.js'
import { reactive,watch } from 'vue'
import { state,bridge,run,hydrateUser,notify } from './state.js'
import { applyContent } from './content-state.js'
import { applySocial } from './social-state.js'
import { newId } from './domain/id.js'
import { AppError } from './domain/errors.js'
const empty=()=>({ownerId:null,loaded:false,presentedCollections:{},preferences:{theme:'purple'},feedback:[],connections:{following:[],followers:[]},profileDraft:null,feedbackDraft:null,collectionDrafts:{},collectionSelections:{}})
export const personal=reactive(empty())
export function resetPersonal(){Object.assign(personal,empty())}
watch(()=>state.user?.id,(id,old)=>{if(id!==old){resetPersonal();if(!id)state.theme='purple'}})
export async function applyPersonal(r,signal){if(signal?.aborted)throw new AppError('CANCELLED');const owner=state.user?.id;if(r.ownerId!==owner)return;await hydrateUser(r);if(signal?.aborted||state.user?.id!==owner)return;for(const x of r.feedback){x.photos=[];for(const id of x.mediaIds)try{x.photos.push({id,url:(await bridge.call('media','resolve',{id},{signal})).url})}catch{if(signal?.aborted)throw new AppError('CANCELLED');x.photos.push({id,url:null})}}await applyContent(r.content,signal);await applySocial(r.social,signal);if(signal?.aborted||state.user?.id!==owner)return;Object.assign(personal,{ownerId:owner,loaded:true,preferences:r.preferences,feedback:r.feedback,connections:r.connections})}
export async function waitPersonalIdle(){while(state.ui.busy)await new Promise(resolve=>{const stop=watch(()=>state.ui.busy,v=>{if(!v){stop();resolve()}})})}
export async function loadPersonal({reuse=false}={}){const owner=state.user?.id;if(reuse&&owner&&personal.loaded&&personal.ownerId===owner)return true;await waitPersonalIdle();if(!owner||owner!==state.user?.id)return false;const ok=await run('personal-load',async signal=>applyPersonal(await bridge.call('personal','snapshot',{}, {signal}),signal));if(!ok&&state.user?.id===owner)personal.loaded=false;return ok}
export async function personalAction(method,p,{notice=actionNotice('personal',method,p)}={}){let result;const ok=await run('personal-'+method,async(signal,done)=>{result=await bridge.call('personal',method,p,{signal});await applyPersonal(result,signal);if(notice)notify(notice);done()},{critical:true});return ok?result:null}
export async function ensurePersonalDraft(d){if(d.ready)return true;return run('personal-draft',async signal=>{await bridge.call('content','beginDraft',{draftId:d.draftId},{signal});d.ready=true})}
export function releasePersonalDraft(d){if(d?.ready)bridge.call('content','discardDraft',{draftId:d.draftId}).catch(()=>{/* Logout also reclaims owned uncommitted staging. A saved write remains successful. */})}
export function profileDraft(){if(!personal.profileDraft){const p=state.user.profile;personal.profileDraft={draftId:newId(),commitId:newId(),ready:false,profile:JSON.parse(JSON.stringify(p))};for(const k of ['pronouns','university','year','major','otherMajor'])personal.profileDraft.profile[k]||='';personal.profileDraft.profile.gender||='private'}return personal.profileDraft}
export function feedbackDraft(){if(!personal.feedbackDraft)personal.feedbackDraft={draftId:newId(),commitId:newId(),ready:false,body:'',topic:'other',photos:[]};return personal.feedbackDraft}
export function collectionDraft(id){const key=id||'new';if(!personal.collectionDrafts[key])personal.collectionDrafts[key]={draftId:newId(),commitId:newId(),ready:false,name:'',description:'',cover:null};return personal.collectionDrafts[key]}

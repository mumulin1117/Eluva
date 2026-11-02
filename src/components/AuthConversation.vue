<script setup>
import { isInteractiveTarget } from '../services/touch-policy.js'
import { computed,nextTick,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { useRoute } from 'vue-router'
import { state,t,bridge,run,startDraft,fail,hydrateUser,profilePayload,saveConsent,notify } from '../state.js'
import { router,openLegal } from '../router.js'
import { conversationVersion,quizQuestions } from '../data/auth-conversation.js'
import { suggestedBio,answeredLabel } from '../domain/auth-conversation.js'
import { createWelcomeRelay } from '../domain/welcome-relay.js'
import { ageOn,textLength,validEmail,normalizeEmail,validateCredentials } from '../domain/validation.js'
import { choices } from '../data/choices.js'
import BirthdayField from './BirthdayField.vue'
import AppIcon from './AppIcon.vue'
const route=useRoute()
if(!state.auth)state.auth={phase:'choice',messages:['welcome','intro','promise','visit'].map(key=>({role:'guide',key:'ac.'+key})),quizIndex:0,remainingMs:5000,answers:[],scrollTop:null,follow:true,bioLocale:state.locale,revealed:0,sequence:0,edit:null,bioEdited:false}
const a=state.auth,d=computed(()=>state.draft),scroller=ref(null),entry=ref(null),confirmEntry=ref(null),composing=ref(false),showPassword=ref(false),scrollAway=ref(false),ready=ref(false)
a.sequence||=0
a.edit??=null
a.bioEdited??=false
for(const m of a.messages) m.id||='auth-message-'+(++a.sequence)
a.revealed??=a.messages.length
const guidePause=700
let timer,layoutObserver,anchorFrame=0,settleFrame=0,passwordFrame=0,lastMetrics='',last=performance.now(),nextReveal=last+guidePause,settleAt=last,alive=true,answering=false,viewportAnchoring=false,pendingEntryFocus=null,entryFocusRevision=0
const motion=window.matchMedia('(prefers-reduced-motion: reduce)')
const welcomeRelay=createWelcomeRelay(),welcome=ref({phase:'waiting',held:true,paused:true})
function syncWelcome(){
 const eligible=!a.welcomePresented&&a.phase==='choice'&&a.revealed===0
 const boot=window.__ELUVA_BOOT__||{}
 if(eligible&&boot.launchReady&&!a.welcomeRelayStyle){a.welcomeRelayStyle=boot.welcomeRelayClaimed?'brief':boot.welcomeMotion||'brief';if(a.welcomeRelayStyle==='full')boot.welcomeRelayClaimed=true}
 welcome.value=welcomeRelay.update({prepared:boot.launchReady===true,covered:document.documentElement.dataset.launchCovered==='true',hidden:document.hidden,modal:!!state.ui.modal,reduced:motion.matches,style:a.welcomeRelayStyle||'brief',eligible},performance.now())
 if(eligible&&welcome.value.phase==='done')a.welcomePresented=true
}
function launchChanged(event){if(event.detail?.launchId&&event.detail.launchId!==window.__ELUVA_BOOT__?.launchId)return;syncWelcome()}
const busy=computed(()=>!!state.ui.busy),phase=computed(()=>a.phase),editing=computed(()=>a.edit)
const locked=computed(()=>busy.value||!ready.value||welcome.value.held)
const entryLocked=computed(()=>!ready.value||welcome.value.held)
const question=computed(()=>a.edit?.field.startsWith('quiz:')?quizQuestions.find(q=>q.id===a.edit.field.slice(5)):quizQuestions[a.quizIndex])
const messages=computed(()=>a.messages.slice(0,a.revealed))
const guidePending=computed(()=>a.messages.slice(a.revealed).some(m=>m.role==='guide'))
const guideTyping=computed(()=>!welcome.value.held&&!welcome.value.paused&&(busy.value||guidePending.value||(!ready.value&&messages.value.at(-1)?.role==='guide')))
const typingBubble=computed(()=>guideTyping.value&&(busy.value||guidePending.value))
const secret=computed(()=>['password','loginPassword','resetPassword'].includes(phase.value)),codePhase=computed(()=>['code','resetCode'].includes(phase.value))
const stage=computed(()=>({name:1,birthday:2,password:3,theme:4,gender:5,quizIntro:6,quiz:6,bioReview:6,bioEdit:6})[phase.value]||0)
const phaseLabel=computed(()=>stage.value===6?t('ac.quiz')+(phase.value==='quiz'?' ('+(a.quizIndex+1)+'/10)':''):t('ac.'+({name:'name',birthday:'birthday',password:'password',theme:'theme',gender:'gender'}[phase.value]||'guideName')))
const inputPhase=computed(()=>['email','loginEmail','loginPassword','code','name','password','resetEmail','resetCode','resetPassword','bioEdit'].includes(phase.value))
const field=computed({get(){
 if(a.edit){if(a.edit.field==='email'&&phase.value==='code')return a.edit.code||'';if(a.edit.field==='email'&&phase.value==='password')return a.edit.password||'';return a.edit.value||''}
 switch(phase.value){case'email':return d.value?.email||'';case'name':return d.value?.displayName||'';case'password':return d.value?.password||'';case'code':return d.value?.code||'';case'loginEmail':return state.login.email;case'loginPassword':return state.login.password;case'resetEmail':return state.reset.email;case'resetCode':return state.reset.code;case'resetPassword':return state.reset.password;case'bioEdit':return d.value?.about||'';default:return''}
},set(v){
 if(codePhase.value)v=v.replace(/[^0-9]/g,'').slice(0,6)
 if(a.edit){if(a.edit.field==='email'&&phase.value==='code')a.edit.code=v;else if(a.edit.field==='email'&&phase.value==='password')a.edit.password=v;else a.edit.value=v;return}
 switch(phase.value){case'email':d.value.email=v;break;case'name':d.value.displayName=v;break;case'password':d.value.password=v;break;case'code':d.value.code=v;break;case'loginEmail':state.login.email=v;break;case'loginPassword':state.login.password=v;break;case'resetEmail':state.reset.email=v;break;case'resetCode':state.reset.code=v;break;case'resetPassword':state.reset.password=v;break;case'bioEdit':d.value.about=v;break}
}})
const birthdayValue=computed({get:()=>a.edit?.field==='birthday'?a.edit.value:d.value?.birthday||'',set:v=>{if(a.edit?.field==='birthday')a.edit.value=v;else d.value.birthday=v}})
const placeholder=computed(()=>t('ac.'+({name:'namePlaceholder',password:'passwordPlaceholder',loginPassword:'passwordPlaceholder',resetPassword:'passwordPlaceholder',bioEdit:'bioPlaceholder'}[phase.value]||'emailPlaceholder')))
const disabled=computed(()=>locked.value||composing.value||(phase.value!=='bioEdit'&&!field.value.trim())||(codePhase.value&&field.value.length!==6)||(phase.value==='bioEdit'&&textLength(field.value)>300)||(phase.value==='resetPassword'&&!state.reset.confirm))
const theme=computed(()=>a.edit?.field==='theme'?a.edit.value:d.value?.theme||'purple'),background=computed(()=>({purple:"url('/images/auth-background.png')",pink:"url('/images/p5/theme-pink.png')",orange:"url('/images/p5/theme-orange.png')",cyan:"url('/images/p5/theme-cyan.png')"})[theme.value])
const editPrompt=computed(()=>{
 if(!a.edit)return ''
 if(a.edit.field.startsWith('quiz:'))return question.value?.[state.locale]
 return t('ac.'+({email:phase.value==='code'?'codePrompt':phase.value==='password'?'passwordPrompt':'emailPrompt',loginEmail:'loginEmailPrompt',resetEmail:'resetEmailPrompt',name:'namePrompt',birthday:'birthdayPrompt',password:'passwordPrompt',theme:'themePrompt',gender:'genderPrompt',bio:'bioIntro'}[a.edit.field]||'namePrompt'),{name:d.value?.displayName})
})
function active(edit=a.edit,current=phase.value){return alive&&state.auth===a&&a.edit===edit&&phase.value===current}
function focusEntry(){
 if(!pendingEntryFocus||locked.value||!inputPhase.value||!a.follow||state.ui.modal||document.hidden)return
 const target=pendingEntryFocus,current=phase.value,edit=a.edit
 nextTick(()=>{
  if(pendingEntryFocus!==target||!active(edit,current)||locked.value||!a.follow||state.ui.modal||document.hidden)return
  const el=target==='confirm'?confirmEntry.value:entry.value
  if(!el?.isConnected||el.disabled||el.readOnly)return
  pendingEntryFocus=null;el.focus({preventScroll:true})
 })
}
function requestEntryFocus(target='entry'){pendingEntryFocus=target;focusEntry()}
function togglePassword(){
 const el=entry.value,focused=document.activeElement===el,start=el?.selectionStart,end=el?.selectionEnd,direction=el?.selectionDirection,current=phase.value,edit=a.edit
 cancelAnimationFrame(passwordFrame)
 showPassword.value=!showPassword.value
 if(focused)nextTick(()=>{if(active(edit,current)&&entry.value===el&&!locked.value){el.focus({preventScroll:true});passwordFrame=requestAnimationFrame(()=>{passwordFrame=0;if(active(edit,current)&&entry.value===el&&document.activeElement===el&&!locked.value&&start!==null&&end!==null)el.setSelectionRange(start,end,direction)})}})
}
function text(m){if(m.kind==='age')return t('yearsOld',{n:ageOn(m.birthday)});if(m.kind==='quiz')return quizQuestions.find(q=>q.id===m.questionId)?.[state.locale];if(m.kind==='answer')return answeredLabel(m,state.locale);return m.key?t(m.key,m.values||{}):m.text}
function add(role,value,fieldName){a.messages.push({id:'auth-message-'+(++a.sequence),role,...(typeof value==='string'?{key:value}:value),...(fieldName?{field:fieldName}:{})});if(role==='user')a.revealed=a.messages.length;ready.value=false;nextReveal=performance.now()+guidePause;settleAt=performance.now()+240}
function move(next,prompt,response,fieldName){if(!alive)return;if(response)add('user',response,fieldName||({email:'email',loginEmail:'loginEmail',resetEmail:'resetEmail',name:'name',birthday:'birthday',password:'password',theme:'theme',gender:'gender'}[phase.value]));a.phase=next;if(prompt)for(const p of Array.isArray(prompt)?prompt:[prompt])add('guide',p);showPassword.value=false;state.ui.error=null;state.ui.notice='';pendingEntryFocus=inputPhase.value?'entry':null;bottom()}
function bottom(force=false){nextTick(()=>{if(scroller.value&&(force||a.follow)){scroller.value.scrollTop=scroller.value.scrollHeight;scrollAway.value=false}})}
function scrollMetrics(){const el=scroller.value;return el?[el.scrollHeight,el.clientHeight,el.clientWidth].join(':'):''}
function onScroll(){if(!scroller.value||viewportAnchoring)return;const metrics=scrollMetrics();if(a.follow&&lastMetrics&&metrics!==lastMetrics){resizeConversation();return}lastMetrics=metrics;const el=scroller.value;a.follow=el.scrollHeight-el.scrollTop-el.clientHeight<72;scrollAway.value=!a.follow;a.scrollTop=el.scrollTop}
function resizeConversation(){if(!alive||(!a.follow&&!viewportAnchoring))return;viewportAnchoring=true;cancelAnimationFrame(anchorFrame);cancelAnimationFrame(settleFrame);bottom(true);anchorFrame=requestAnimationFrame(()=>{bottom(true);settleFrame=requestAnimationFrame(()=>{if(alive){viewportAnchoring=false;lastMetrics=scrollMetrics();onScroll()}})})}
function dismiss(e){if(!isInteractiveTarget(e.target)){entryFocusRevision++;pendingEntryFocus=null;document.activeElement?.blur?.()}}
function choose(kind){if(locked.value||!state.consent)return;a.follow=true;if(kind==='register'){startDraft();d.value.theme||='purple';move('email','ac.emailPrompt','ac.first')}else move('loginEmail','ac.loginEmailPrompt','ac.returning')}
function latest(fieldName){return a.messages.findLast(m=>m.role==='user'&&m.field===fieldName)}
function canEdit(m){if(!m.field||latest(m.field)!==m)return false;if(m.field==='loginEmail')return phase.value==='loginPassword'||a.edit?.resumePhase==='loginPassword';if(m.field==='resetEmail')return phase.value.startsWith('reset');return !!d.value&&!['loginEmail','loginPassword','resetEmail','resetCode','resetPassword','accountExists'].includes(phase.value)}
function replaceAnswer(fieldName,response){const m=latest(fieldName);if(!m)return;const id=m.id;for(const key of Object.keys(m))delete m[key];Object.assign(m,{id,role:'user',field:fieldName},typeof response==='string'?{key:response}:response)}
function editAnswer(fieldName){
 if(locked.value||a.edit)return
 const m=latest(fieldName),q=fieldName.startsWith('quiz:')?a.answers.find(x=>x.questionId===fieldName.slice(5)):null
 const values={email:d.value?.email,loginEmail:state.login.email,resetEmail:state.reset.email,name:d.value?.displayName,birthday:d.value?.birthday,theme:d.value?.theme,gender:d.value?.gender,password:'',bio:d.value?.about}
 a.edit={token:++a.sequence,field:fieldName,value:q?.optionId||values[fieldName]||'',resumePhase:phase.value,scrollTop:scroller.value?.scrollTop||0,follow:a.follow,needsPassword:!!d.value?.passwordSet,flowId:null,code:'',password:''}
 a.phase=q?'quiz':fieldName==='bio'?'bioEdit':fieldName;showPassword.value=false;state.ui.error=null;a.follow=true;ready.value=false;settleAt=performance.now()+240;bottom(true);requestEntryFocus()
}
function restoreEdit(){const e=a.edit;if(!e)return;pendingEntryFocus=null;a.phase=e.resumePhase;a.edit=null;a.focusField=e.field;showPassword.value=false;state.ui.error=null;ready.value=false;settleAt=performance.now()+120;nextTick(()=>{if(scroller.value){scroller.value.scrollTop=e.scrollTop;a.follow=e.follow;onScroll()}})}
async function cancelEdit(){if(busy.value||!a.edit)return;const e=a.edit,current=phase.value;if(e.flowId){const ok=await run('auth-edit-cancel',async signal=>{await bridge.call('auth','cancelRegistration',{flowId:e.flowId},{signal})});if(!ok||!active(e,current))return}restoreEdit()}
async function finishEmailEdit(e,signal){
 const previous=d.value.flowId;Object.assign(d.value,{flowId:e.flowId,email:e.email,verified:true,passwordSet:e.needsPassword,password:'',code:''});replaceAnswer('email',{text:e.email});const resume=e.resumePhase;restoreEdit();
 if(resume==='code'||resume==='email')move('name',['ac.codeAccepted','ac.namePrompt'],'ac.verifiedReply')
 if(previous&&previous!==e.flowId)await bridge.call('auth','cancelRegistration',{flowId:previous},{signal}).catch(()=>{})
}
async function submitEdit(signal,e,current){
 if(e.field==='email'){
  if(current==='email'){
   const address=normalizeEmail(e.value);if(!validEmail(address))fail('INVALID_EMAIL')
   if(address===normalizeEmail(d.value.email)){if(e.flowId)await bridge.call('auth','cancelRegistration',{flowId:e.flowId},{signal});if(active(e,current))restoreEdit();return}
   if(!e.flowId||e.email!==address){if(e.flowId)await bridge.call('auth','cancelRegistration',{flowId:e.flowId},{signal});const r=await bridge.call('auth','beginRegistration',{email:address,version:conversationVersion},{signal});if(!active(e,current))return;e.flowId=r.flowId;e.email=r.email}
   await bridge.call('auth','startVerification',{flowId:e.flowId,email:e.email},{signal});if(!active(e,current))return;e.code='';a.phase='code';ready.value=false;settleAt=performance.now()+240;requestEntryFocus()
  }else if(current==='code'){
   await bridge.call('auth','verify',{flowId:e.flowId,purpose:'signup',code:e.code},{signal});if(!active(e,current))return
   if(e.needsPassword){a.phase='password';ready.value=false;settleAt=performance.now()+240;requestEntryFocus()}else await finishEmailEdit(e,signal)
  }else if(current==='password'){
   validateCredentials(e.email,e.password);await bridge.call('auth','setRegistrationPassword',{flowId:e.flowId,password:e.password},{signal});if(!active(e,current))return;e.password='';await finishEmailEdit(e,signal)
  }
 }else if(e.field==='name'){
  const name=e.value.trim();if(!name||textLength(name)>60)fail('INVALID_NAME');d.value.displayName=name;replaceAnswer('name',{text:name});for(const m of a.messages)if(m.key==='ac.birthdayPrompt')m.values={name};restoreEdit()
 }else if(e.field==='password'){
  validateCredentials(d.value.email,e.value);await bridge.call('auth','setRegistrationPassword',{flowId:d.value.flowId,password:e.value},{signal});if(!active(e,current))return;e.value='';d.value.passwordSet=true;restoreEdit()
 }else if(e.field==='loginEmail'){
  if(!validEmail(e.value))fail('INVALID_EMAIL');state.login.email=normalizeEmail(e.value);state.login.password='';replaceAnswer('loginEmail',{text:state.login.email});restoreEdit()
 }else if(e.field==='resetEmail'){
  const r=await bridge.call('auth','beginReset',{email:e.value},{signal});if(!active(e,current))return;const previous=state.reset.flowId;Object.assign(state.reset,{email:r.email,flowId:r.flowId,verified:false,code:'',password:'',confirm:''});replaceAnswer('resetEmail',{text:r.email});restoreEdit();move('resetCode','ac.resetCodePrompt');if(previous)await bridge.call('auth','cancelReset',{flowId:previous},{signal}).catch(()=>{})
 }else if(e.field==='bio'){d.value.about=e.value;a.bioEdited=true;restoreEdit()}
 bottom()
}
async function submit(event){
 if(disabled.value||event?.isComposing)return;const current=phase.value,e=a.edit,focusRevision=entryFocusRevision;a.follow=true
 const ok=await run('auth',async(signal,finished)=>{
  if(e){await submitEdit(signal,e,current);return}
  if(current==='email'){
   const r=await bridge.call('auth','beginRegistration',{email:d.value.email,version:conversationVersion,flowId:d.value.flowId},{signal});if(!active(e,current))return;d.value.flowId=r.flowId;d.value.email=r.email
   await bridge.call('auth','startVerification',{flowId:r.flowId,email:r.email},{signal});if(!active(e,current))return;d.value.verified=false;d.value.code='';move('code','ac.codePrompt',{text:r.email})
  }else if(current==='code'){
   await bridge.call('auth','verify',{flowId:d.value.flowId,purpose:'signup',code:d.value.code},{signal});if(!active(e,current))return;d.value.verified=true;move('name',['ac.codeAccepted','ac.namePrompt'],'ac.verifiedReply')
  }else if(current==='name'){
   if(!d.value.displayName.trim()||textLength(d.value.displayName.trim())>60)fail('INVALID_NAME');d.value.displayName=d.value.displayName.trim();move('birthday',{key:'ac.birthdayPrompt',values:{name:d.value.displayName}},{text:d.value.displayName})
  }else if(current==='password'){
   validateCredentials(d.value.email,d.value.password);await bridge.call('auth','setRegistrationPassword',{flowId:d.value.flowId,password:d.value.password},{signal});if(!active(e,current))return;d.value.password='';d.value.passwordSet=true;move('theme','ac.themePrompt','ac.passwordSaved')
  }else if(current==='loginEmail'){
   if(!validEmail(state.login.email))fail('INVALID_EMAIL');state.login.email=normalizeEmail(state.login.email);move('loginPassword','ac.loginPasswordPrompt',{text:state.login.email})
  }else if(current==='loginPassword'){
   const r=await bridge.call('auth','login',{email:state.login.email,password:state.login.password},{signal});if(!active(e,current))return;await hydrateUser(r);if(!active(e,current))return;state.login.password='';state.draft=null;finished();await router.replace('/home');state.auth=null
  }else if(current==='resetEmail'){
   const r=await bridge.call('auth','beginReset',{email:state.reset.email},{signal});if(!active(e,current))return;Object.assign(state.reset,{email:r.email,flowId:r.flowId,verified:false,code:''});move('resetCode','ac.resetCodePrompt',{text:r.email})
  }else if(current==='resetCode'){
   await bridge.call('auth','verify',{flowId:state.reset.flowId,purpose:'reset',code:state.reset.code},{signal});if(!active(e,current))return;state.reset.verified=true;move('resetPassword','ac.resetPasswordPrompt','ac.verifiedReply')
  }else if(current==='resetPassword'){
   validateCredentials(state.reset.email,state.reset.password);if(state.reset.password!==state.reset.confirm)fail('PASSWORD_MISMATCH');await bridge.call('auth','resetPassword',{flowId:state.reset.flowId,password:state.reset.password},{signal});if(!active(e,current))return;state.login.email=state.reset.email;state.login.password='';Object.assign(state.reset,{flowId:null,verified:false,password:'',confirm:'',code:''});move('loginPassword',['ac.resetDone','ac.loginPasswordPrompt'],'ac.passwordSaved');finished()
  }
 },{critical:!e&&['loginPassword','resetPassword'].includes(current)})
 if(!ok&&active(e,current)&&state.ui.error==='ACCOUNT_EXISTS'&&current==='email'&&!e){const value=d.value.email;state.ui.error=null;move('accountExists','ac.exists',{text:value})}
 if(!ok&&active(e,current)&&focusRevision===entryFocusRevision)requestEntryFocus(state.ui.error==='PASSWORD_MISMATCH'?'confirm':'entry')
 bottom()
}
async function resend(){if(locked.value)return;const e=a.edit,current=phase.value;await run('auth-code',async signal=>{await bridge.call('auth','resend',{flowId:e?.field==='email'?e.flowId:current==='resetCode'?state.reset.flowId:d.value.flowId,purpose:current==='resetCode'?'reset':'signup'},{signal});if(active(e,current))notify('resent')})}
function changeEmail(){if(locked.value)return;if(a.edit?.field==='email'){a.phase='email';ready.value=false;settleAt=performance.now()+120;requestEntryFocus();return}editAnswer(phase.value==='resetCode'?'resetEmail':'email')}
function useLogin(){if(locked.value)return;state.login.email=d.value.email;move('loginPassword','ac.loginPasswordPrompt','ac.loginChoice')}
function forgot(){if(locked.value)return;state.reset.email=state.login.email;move('resetEmail','ac.resetEmailPrompt',{key:'forgotPassword'})}
function newAccount(){if(locked.value)return;startDraft();d.value.email=state.login.email;d.value.theme||='purple';move('email','ac.emailPrompt','ac.first')}
async function cancelReset(){if(busy.value||a.edit)return;const current=phase.value;const ok=await run('auth-cancel-reset',async signal=>{if(state.reset.flowId)await bridge.call('auth','cancelReset',{flowId:state.reset.flowId},{signal})});if(!ok||!active(null,current))return;Object.assign(state.reset,{flowId:null,verified:false,code:'',password:'',confirm:''});move('loginPassword','ac.loginPasswordPrompt')}
function birthday(){if(locked.value)return;const age=ageOn(birthdayValue.value);if(age===null){state.ui.error='INVALID_BIRTHDAY';bottom();return}if(age<18){state.ui.error='AGE_RESTRICTED';bottom();return}if(a.edit){d.value.birthday=a.edit.value;replaceAnswer('birthday',{kind:'age',birthday:d.value.birthday});restoreEdit()}else{a.follow=true;move('password','ac.passwordPrompt',{kind:'age',birthday:d.value.birthday})}bottom()}
function pickTheme(id){if(locked.value)return;if(a.edit){d.value.theme=id;replaceAnswer('theme',{kind:'label',key:'p5.theme_'+id});restoreEdit()}else{d.value.theme=id;move('gender',['ac.themeSaved','ac.genderPrompt'],{kind:'label',key:'p5.theme_'+id})}bottom()}
function pickGender(id){if(locked.value)return;if(a.edit){d.value.gender=id;replaceAnswer('gender',{kind:'gender',genderId:id});restoreEdit()}else{d.value.gender=id;move('quizIntro',['ac.quizIntro','ac.quizHint','ac.ready'],{kind:'gender',genderId:id})}bottom()}
function startQuiz(){if(locked.value)return;a.quizIndex=0;a.answers=[];a.remainingMs=5000;move('quiz',{kind:'quiz',questionId:question.value.id},'ac.go');last=performance.now();bottom()}
function answer(optionId,status='answered',expectedId=question.value?.id){
 if(answering||phase.value!=='quiz'||locked.value||expectedId!==question.value?.id)return;answering=true;document.activeElement?.blur?.()
 const q=question.value,row={questionId:q.id,status,optionId,elapsedMs:a.edit?(a.answers.find(x=>x.questionId===q.id)?.elapsedMs||0):Math.round(Math.max(0,5000-a.remainingMs))},response=status==='answered'?{kind:'answer',...row}:{key:status==='timeout'?'ac.timedOut':'ac.skipped'}
 if(a.edit){const index=a.answers.findIndex(x=>x.questionId===q.id);a.answers.splice(index,1,row);replaceAnswer('quiz:'+q.id,response);if(!a.bioEdited&&a.answers.length===10)d.value.about=suggestedBio(a.answers,a.bioLocale||state.locale);restoreEdit()}
 else{
  a.answers.push(row)
  if(a.quizIndex<9){move('quiz',{kind:'quiz',questionId:quizQuestions[a.quizIndex+1].id},response,'quiz:'+q.id);a.quizIndex++;a.remainingMs=5000}
  else{d.value.about=suggestedBio(a.answers,state.locale);a.bioLocale=state.locale;move('bioReview',['ac.wrap',{key:'ac.elapsed',values:{seconds:(a.answers.reduce((n,x)=>n+x.elapsedMs,0)/1000).toFixed(1)}}],response,'quiz:'+q.id);add('guide',{kind:'profile'});add('guide','ac.bioIntro');add('guide',{kind:'bio'})}
 }
 last=performance.now();nextTick(()=>{answering=false});bottom()
}
function editBio(){editAnswer('bio')}
async function complete(){if(locked.value||a.edit)return;const current=phase.value;await run('auth-complete',async(signal,finished)=>{
 if(!d.value.communityAccepted||!state.consent)fail('CONSENT_REQUIRED')
 const r=await bridge.call('auth','completeRegistration',{flowId:d.value.flowId,commitId:d.value.commitId,communityAccepted:true,profile:profilePayload(),onboarding:{version:conversationVersion,theme:d.value.theme,answers:a.answers.map(({questionId,status,optionId,elapsedMs})=>({questionId,status,optionId,elapsedMs}))}},{signal});if(!active(null,current))return;await hydrateUser(r);if(!active(null,current))return;finished();await router.replace('/home');state.draft=null;state.auth=null
 },{critical:true})}
function consentChange(){if(state.consent)saveConsent(false);else state.ui.modal='eula'}
function visibilityChanged(){last=performance.now();nextReveal=last+guidePause;syncWelcome()}
function currentPrompt(){a.follow=true;bottom(true)}
function tick(){
 const now=performance.now(),delta=Math.max(0,Math.min(250,now-last));last=now
 syncWelcome()
 if(document.hidden||state.ui.modal||welcome.value.held){nextReveal=now+guidePause;return}
 if(a.revealed<a.messages.length){if(motion.matches)a.revealed=a.messages.length;else if(now>=nextReveal){a.revealed++;nextReveal=now+guidePause}settleAt=now+(motion.matches?0:240);ready.value=false;bottom()}
 else if(!ready.value&&now>=settleAt){ready.value=true;bottom();if(a.focusField){const target=a.focusField;a.focusField=null;nextTick(()=>scroller.value?.querySelector('[data-edit-field="'+target+'"]')?.focus({preventScroll:true}))}}
 if(phase.value==='quiz'&&ready.value&&!busy.value&&!a.edit&&a.follow){a.remainingMs=Math.max(0,a.remainingMs-delta);if(!a.remainingMs)answer(null,'timeout')}
}
watch(()=>[a.revealed,state.ui.error,busy.value,typingBubble.value],()=>bottom())
watch(()=>phase.value,()=>{composing.value=false;showPassword.value=false;last=performance.now()})
watch(()=>[locked.value,phase.value],focusEntry,{flush:'post'})
watch(()=>[state.ui.modal,phase.value],syncWelcome)
onMounted(()=>{
 syncWelcome();window.addEventListener('eluva:launch-prepared',launchChanged);window.addEventListener('eluva:launch-visible',launchChanged);motion.addEventListener('change',syncWelcome)
 if(a.scrollTop!==null&&scroller.value){const saved=a.scrollTop;nextTick(()=>{if(scroller.value){scroller.value.scrollTop=saved;onScroll()}})}else bottom(true)
 if(['login','resetEmail','resetCode','resetNew'].includes(route.name)&&a.phase==='choice')move('loginEmail','ac.loginEmailPrompt','ac.returning')
 else if(route.name!=='welcome'&&a.phase==='choice'){startDraft();d.value.theme||='purple';move('email','ac.emailPrompt','ac.first')}
 ready.value=a.revealed===a.messages.length&&!welcome.value.held;lastMetrics=scrollMetrics();layoutObserver=new ResizeObserver(resizeConversation);if(scroller.value){layoutObserver.observe(scroller.value);layoutObserver.observe(scroller.value.querySelector('.ac-log'))}document.addEventListener('visibilitychange',visibilityChanged);window.addEventListener('resize',resizeConversation);window.visualViewport?.addEventListener('resize',resizeConversation);window.visualViewport?.addEventListener('scroll',resizeConversation);timer=setInterval(tick,50)
})
onBeforeUnmount(()=>{alive=false;clearInterval(timer);layoutObserver?.disconnect();cancelAnimationFrame(anchorFrame);cancelAnimationFrame(settleFrame);cancelAnimationFrame(passwordFrame);window.removeEventListener('eluva:launch-prepared',launchChanged);window.removeEventListener('eluva:launch-visible',launchChanged);motion.removeEventListener('change',syncWelcome);document.removeEventListener('visibilitychange',visibilityChanged);window.removeEventListener('resize',resizeConversation);window.visualViewport?.removeEventListener('resize',resizeConversation);window.visualViewport?.removeEventListener('scroll',resizeConversation);if(scroller.value)a.scrollTop=scroller.value.scrollTop})
</script>
<template>
 <section class="auth-conversation page-shell" :data-auth-phase="phase" :data-ac-ready="ready" :data-guide-typing="guideTyping" :data-welcome-relay="welcome.phase" :data-welcome-paused="welcome.paused" :data-preview="theme" :style="{backgroundImage:background}" @click="dismiss">
  <header class="ac-header"><span class="ac-guide-portrait" aria-hidden="true"><img class="ac-avatar" src="/images/auth-guide-avatar.png" alt="" draggable="false"/><span class="ac-guide-presence"/></span><div><strong>{{ t('ac.guideName') }}</strong><small :class="{'ac-guide-typing':guideTyping}">{{ t(guideTyping?'ac.guideTyping':'ac.guideStatus') }}</small></div></header>
  <main ref="scroller" class="ac-transcript" :aria-label="t('ac.guideName')" @scroll.passive="onScroll"><div class="ac-log">
   <TransitionGroup name="ac-message" tag="div" class="ac-messages" role="log" aria-live="polite" aria-relevant="additions text">
    <div v-for="(m,i) in messages" :key="m.id" class="ac-row" :class="m.role==='user'?'ac-outgoing':'ac-incoming'">
     <img v-if="m.role==='guide'" class="ac-avatar" :class="{'ac-avatar-hidden':messages[i+1]?.role==='guide'||(i===messages.length-1&&typingBubble)}" src="/images/auth-guide-avatar.png" alt="" draggable="false" aria-hidden="true"/>
     <article v-if="m.kind==='profile'" class="ac-profile-card"><div class="ac-profile-identity"><img src="/images/default-avatar.svg" alt=""/><div><strong>{{ d.displayName }}</strong><small>{{ t('yearsOld',{n:ageOn(d.birthday)}) }}</small></div></div><div class="ac-profile-tags"><span v-for="row in a.answers.filter(x=>x.status==='answered'&&['quick-quiz-01','quick-quiz-04','quick-quiz-09','quick-quiz-10'].includes(x.questionId))" :key="row.questionId">{{ answeredLabel(row,state.locale) }}</span></div></article>
     <div v-else class="ac-message-body"><p class="ac-bubble">{{ m.kind==='bio'?(d.about||t('ac.noBio')):m.kind==='gender'?(choices.genders.find(x=>x.id===m.genderId)?.[state.locale]||t('notProvided')):text(m) }}</p><button v-if="canEdit(m)" class="ac-message-edit" :data-edit-field="m.field" :disabled="locked||!!editing" @click="editAnswer(m.field)">{{ t(m.field==='password'?'ac.passwordResetAction':'ac.editReply') }}</button></div>
     <span v-if="m.role==='user'" class="ac-accepted" aria-hidden="true"><AppIcon name="check" :size="12"/><AppIcon name="check" :size="12"/></span>
    </div>
   </TransitionGroup>
   <div v-if="editing" class="ac-row ac-incoming ac-edit-prompt"><img class="ac-avatar" src="/images/auth-guide-avatar.png" alt="" draggable="false"/><div class="ac-message-body"><span class="ac-editing-label">{{ t('ac.editing') }}</span><p class="ac-bubble">{{ editPrompt }}</p></div></div>
   <div v-if="typingBubble" class="ac-row ac-incoming ac-guide-output" :class="{'ac-request':busy}" role="status" :aria-label="t('ac.guideTyping')"><img class="ac-avatar" src="/images/auth-guide-avatar.png" alt="" draggable="false" aria-hidden="true"/><span class="ac-bubble ac-typing" aria-hidden="true"><i/><i/><i/></span></div>
   <p v-if="state.ui.error" id="auth-error" class="ac-error error-banner" role="alert" :data-error-code="state.ui.error">{{ t('errors.'+state.ui.error) }}</p>
   <section v-if="ready" class="ac-answer-card" :data-current-question="phase==='quiz'?question.id:undefined">
    <div v-if="stage&&!editing" class="ac-progress"><span>{{ stage }}/6 {{ phaseLabel }}</span><div aria-hidden="true"><i v-for="n in 6" :key="n" :class="{active:n===stage}"/></div></div>
    <label v-if="['choice','email','loginEmail'].includes(phase)&&!editing" class="agreement-row ac-agreement"><input type="checkbox" :checked="state.consent" :disabled="busy" @click.prevent="consentChange"/><span>{{ t('agreementPrefix') }} <button class="text-link" type="button" :disabled="busy" @click.prevent="openLegal('terms')">{{ t('terms') }}</button> {{ t('and') }} <button class="text-link" type="button" :disabled="busy" @click.prevent="openLegal('privacy')">{{ t('privacy') }}</button></span></label>
    <div v-if="phase==='choice'" class="ac-options ac-end"><button class="ac-capsule" :disabled="locked||!state.consent" @click="choose('login')">{{ t('ac.returning') }}</button><button class="ac-capsule" :disabled="locked||!state.consent" @click="choose('register')">{{ t('ac.first') }}</button></div>
    <div v-else-if="phase==='accountExists'" class="ac-options ac-end" data-error-code="ACCOUNT_EXISTS"><button class="ac-capsule" :disabled="locked" @click="useLogin">{{ t('ac.loginChoice') }}</button><button class="ac-link" :disabled="locked" @click="move('email','ac.emailPrompt')">{{ t('ac.differentEmail') }}</button></div>
    <template v-else-if="phase==='birthday'"><div class="ac-inline-action"><BirthdayField v-model="birthdayValue"/><button class="ac-send ac-submit" :aria-label="t(editing?'ac.updateAnswer':'ac.send')" :disabled="locked||!birthdayValue" @click="birthday"><img :src="!birthdayValue?'/images/auth-send.png':'/images/auth-send-active.png'" alt="" draggable="false"/></button></div><p class="ac-hint">{{ t('ac.birthdayNote') }}</p></template>
    <div v-else-if="phase==='theme'" class="ac-theme-options"><button v-for="id in ['pink','purple','orange','cyan']" :key="id" class="ac-theme" :disabled="locked" @click="pickTheme(id)"><span :class="'ac-colour-'+id"/>{{ t('p5.theme_'+id) }}</button></div>
    <div v-else-if="phase==='gender'" class="ac-options ac-genders"><button v-for="item in choices.genders" :key="item.id" class="ac-capsule" :disabled="locked" @click="pickGender(item.id)">{{ item[state.locale] }}</button></div>
    <div v-else-if="phase==='quizIntro'" class="ac-options ac-end"><button class="ac-capsule" :disabled="locked" @click="startQuiz">{{ t('ac.go') }}</button></div>
    <template v-else-if="phase==='quiz'"><div v-if="!editing" class="ac-timer" role="timer" :aria-label="t('ac.quiz')"><span>{{ Math.ceil(a.remainingMs/1000) }}s</span><div><i :style="{width:(a.remainingMs/5000*100)+'%'}"/></div></div><div class="ac-options ac-quiz-options" :class="{'ac-mbti':question.id==='quick-quiz-10'}"><button v-for="item in question.options" :key="item.id" class="ac-capsule" :data-question-id="question.id" :disabled="locked" @click="answer(item.id,'answered',$event.currentTarget.dataset.questionId)">{{ item[state.locale] }}</button></div><button v-if="question.id!=='quick-quiz-01'" class="ac-link ac-skip" :disabled="locked" @click="answer(null,'skipped')">{{ t('skip') }}</button></template>
    <template v-else-if="phase==='bioReview'"><label class="agreement-row ac-community"><input v-model="d.communityAccepted" type="checkbox" :disabled="busy"/><span>{{ t('ac.communityAgree') }} <button class="text-link" :disabled="busy" @click.prevent="openLegal('guidelines')">{{ t('community') }}</button></span></label><div class="ac-options ac-end"><button class="ac-capsule" :disabled="locked||!d.communityAccepted" @click="complete">{{ busy?t('working'):t('ac.keepBio') }}</button><button class="ac-capsule" :disabled="locked" @click="editBio">{{ t('ac.editBio') }}</button></div></template>
    <button v-if="editing" class="ac-link ac-edit-cancel" :disabled="busy" @click="cancelEdit">{{ t('ac.cancelEdit') }}</button>
   </section>
  </div></main>
  <button v-if="scrollAway" class="ac-current" @click="currentPrompt">{{ t('ac.current') }}</button>
  <footer v-if="inputPhase" class="ac-composer ac-controls">
   <form class="ac-form" @submit.prevent="submit" @compositionstart="composing=true" @compositionend="composing=false" novalidate>
    <template v-if="codePhase"><label class="sr-only" for="auth-code">{{ t('verificationCode') }}</label><div class="ac-code-entry"><div class="code-control"><div class="code-slots" aria-hidden="true"><span v-for="i in 6" :key="i" :class="{active:i===Math.min(field.length+1,6)}">{{ field[i-1] }}</span></div><input id="auth-code" ref="entry" v-model="field" class="code-input" :disabled="entryLocked" :readonly="busy" :aria-describedby="state.ui.error?'auth-error':undefined" inputmode="numeric" enterkeyhint="next" autocomplete="one-time-code" maxlength="6" :aria-invalid="state.ui.error==='INVALID_VERIFICATION_CODE'"/></div><button class="ac-send ac-submit" :disabled="disabled" :aria-label="t('ac.codeAction')"><img :src="disabled?'/images/auth-send.png':'/images/auth-send-active.png'" alt="" draggable="false"/></button></div><div class="code-links"><button type="button" class="ac-link" :disabled="locked" @click="resend">{{ t('ac.getCode') }}</button><button type="button" class="ac-link" :disabled="locked" @click="changeEmail">{{ t('ac.differentEmail') }}</button></div><p class="ac-hint">{{ t('codeHint') }}</p></template>
    <template v-else><label class="sr-only" for="auth-entry">{{ placeholder }}</label><div class="ac-entry" :class="{'ac-multiline':phase==='bioEdit'}"><textarea v-if="phase==='bioEdit'" id="auth-entry" ref="entry" v-model="field" :disabled="entryLocked" :readonly="busy" :aria-invalid="!!state.ui.error" :aria-describedby="state.ui.error?'auth-error':undefined" enterkeyhint="done" rows="2" :placeholder="placeholder"/><input v-else id="auth-entry" ref="entry" v-model="field" :disabled="entryLocked" :readonly="busy" :aria-invalid="!!state.ui.error" :aria-describedby="state.ui.error?'auth-error':undefined" :enterkeyhint="phase==='loginPassword'?'go':'next'" :type="secret&&!showPassword?'password':phase.toLowerCase().includes('email')?'email':'text'" :autocomplete="secret?(phase==='loginPassword'?'current-password':'new-password'):phase==='name'?'nickname':'email'" autocapitalize="none" :spellcheck="false" :placeholder="placeholder"/><button v-if="secret" type="button" class="ac-eye" :aria-label="t(showPassword?'hide':'show')" :aria-pressed="showPassword" :disabled="locked" @pointerdown.prevent @click="togglePassword"><AppIcon :name="showPassword?'eyeOff':'eye'"/></button><button class="ac-send" :disabled="disabled" :aria-label="t(editing?'ac.updateAnswer':phase==='loginPassword'?'login':phase==='bioEdit'?'save':'ac.send')"><img :src="disabled?'/images/auth-send.png':'/images/auth-send-active.png'" alt="" draggable="false"/></button></div>
     <template v-if="phase==='resetPassword'"><label class="sr-only" for="auth-confirm">{{ t('confirmNewPassword') }}</label><div class="ac-entry"><input id="auth-confirm" ref="confirmEntry" v-model="state.reset.confirm" type="password" autocomplete="new-password" :placeholder="t('ac.confirmPlaceholder')" :disabled="entryLocked" :readonly="busy" :aria-invalid="state.ui.error==='PASSWORD_MISMATCH'" :aria-describedby="state.ui.error?'auth-error':undefined" enterkeyhint="go"/></div></template>
     <p v-if="['password','resetPassword'].includes(phase)" class="ac-hint">{{ t('passwordHint') }}</p><p v-if="phase==='name'" class="ac-hint">{{ t('ac.nameNote') }}</p><div v-if="phase==='loginPassword'" class="ac-options"><button type="button" class="ac-link" :disabled="locked" @click="forgot">{{ t('forgotPassword') }}</button><button v-if="state.ui.error==='ACCOUNT_NOT_FOUND'" type="button" class="ac-link" :disabled="locked" @click="newAccount">{{ t('ac.createInstead') }}</button></div><p v-if="phase==='bioEdit'" class="ac-hint">{{ textLength(field) }}/300</p>
    </template>
    <button v-if="phase.startsWith('reset')&&!editing" type="button" class="ac-link ac-reset-cancel" :disabled="busy" @click="cancelReset">{{ t('ac.cancelReset') }}</button>
   </form>
  </footer>
 </section>
</template>

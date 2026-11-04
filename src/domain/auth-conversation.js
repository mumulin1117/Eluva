import { invariant } from './errors.js'
import { conversationPolicy,quizQuestions } from '../data/auth-conversation.js'
export function validateOnboarding(raw){
 invariant(raw?.version===conversationPolicy.version&&conversationPolicy.themes.includes(raw.theme),'INVALID_PROFILE')
 invariant(Array.isArray(raw.answers)&&raw.answers.length===quizQuestions.length,'INVALID_PROFILE')
 const answers=conversationPolicy.questions.map((q,i)=>{
  const a=raw.answers[i]
  invariant(a?.questionId===q.id&&['answered','skipped','timeout'].includes(a.status),'INVALID_PROFILE')
  invariant(Number.isFinite(a.elapsedMs)&&a.elapsedMs>=0&&a.elapsedMs<=60000,'INVALID_PROFILE')
  invariant(a.status==='answered'?q.optionIds.includes(a.optionId):a.optionId===null,'INVALID_PROFILE')
  return {questionId:q.id,status:a.status,optionId:a.optionId,elapsedMs:Math.round(a.elapsedMs)}
 })
 return {version:conversationPolicy.version,theme:raw.theme,answers}
}
export function suggestedBio(answers,locale){
 const a=id=>answers.find(x=>x.questionId===id&&x.status==='answered')?.optionId,de=locale==='de',parts=[]
 const social=a('quick-quiz-01'),pace=a('quick-quiz-04'),choice=a('quick-quiz-05'),free=a('quick-quiz-06'),trip=a('quick-quiz-09'),mbti=a('quick-quiz-10')
 if(social)parts.push(de?(social==='introvert'?'Im Herzen introvertiert.':'Im Herzen extrovertiert.'):(social==='introvert'?'An introvert at heart.':'An extrovert at heart.'))
 if(pace==='slow-warmup')parts.push(de?'Ich brauche etwas Zeit, um mich zu öffnen.':'I take my time to open up.')
 if(choice)parts.push(de?(choice==='intuition'?'Ich vertraue meiner Intuition.':'Ich denke Entscheidungen gern logisch durch.'):(choice==='intuition'?'I trust my intuition.':'I like thinking things through.'))
 if(free)parts.push(de?(free==='alone'?'Ich genieße ruhige Zeit für mich.':'Ich verbringe gern Zeit mit Freunden.'):(free==='alone'?'I enjoy quiet time to myself.':'I enjoy spending time with friends.'))
 if(trip)parts.push(de?(trip==='planner'?'Ich plane Reisen gern im Voraus.':'Auf Reisen lasse ich mich gern treiben.'):(trip==='planner'?'I like planning my trips.':'On trips, I go with the flow.'))
 if(mbti)parts.push('MBTI: '+mbti+'.')
 return parts.join(' ')
}
export const answeredLabel=(answer,locale)=>quizQuestions.find(q=>q.id===answer.questionId)?.options.find(x=>x.id===answer.optionId)?.[locale]||''

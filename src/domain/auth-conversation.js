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
 const a=id=>answers.find(x=>x.questionId===id&&x.status==='answered')?.optionId,fr=locale==='fr',parts=[]
 const social=a('quick-quiz-01'),pace=a('quick-quiz-04'),choice=a('quick-quiz-05'),free=a('quick-quiz-06'),trip=a('quick-quiz-09'),mbti=a('quick-quiz-10')
 if(social)parts.push(fr?(social==='introvert'?'Plutôt introverti.':'Plutôt extraverti.'):(social==='introvert'?'An introvert at heart.':'An extrovert at heart.'))
 if(pace==='slow-warmup')parts.push(fr?'Je prends mon temps pour m’ouvrir.':'I take my time to open up.')
 if(choice)parts.push(fr?(choice==='intuition'?'Je suis mon intuition.':'J’aime réfléchir avec logique.'):(choice==='intuition'?'I trust my intuition.':'I like thinking things through.'))
 if(free)parts.push(fr?(free==='alone'?'J’apprécie les moments tranquilles.':'J’aime passer du temps avec mes amis.'):(free==='alone'?'I enjoy quiet time to myself.':'I enjoy spending time with friends.'))
 if(trip)parts.push(fr?(trip==='planner'?'J’aime préparer mes voyages.':'En voyage, je suis mes envies.'):(trip==='planner'?'I like planning my trips.':'On trips, I go with the flow.'))
 if(mbti)parts.push('MBTI: '+mbti+'.')
 return parts.join(' ')
}
export const answeredLabel=(answer,locale)=>quizQuestions.find(q=>q.id===answer.questionId)?.options.find(x=>x.id===answer.optionId)?.[locale]||''

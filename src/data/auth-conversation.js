// Lanhu positions 2/3 intentionally preserve the duplicate source prompt.
export const conversationVersion='lanhu-conversation-v1'
const o=(id,en,fr)=>({id,en,fr}),yesNo=[o('yes','Yep','Oui'),o('no','Nope','Non')]
export const quizQuestions=[
 {id:'quick-quiz-01',en:'Are you an Introvert or Extrovert?',fr:'Êtes-vous plutôt introverti ou extraverti ?',options:[o('introvert','Introvert','Introverti'),o('extrovert','Extrovert','Extraverti')]},
 {id:'quick-quiz-02',en:'Do you share your deep thoughts with AI?',fr:'Confiez-vous vos pensées profondes à une IA ?',options:yesNo},
 {id:'quick-quiz-03',en:'Do you share your deep thoughts with AI?',fr:'Confiez-vous vos pensées profondes à une IA ?',options:yesNo},
 {id:'quick-quiz-04',en:'Do you lose interest fast, or take time to warm up to things?',fr:'Vous lassez-vous vite ou prenez-vous du temps pour vous intéresser aux choses ?',options:[o('quick-interest','Quick to lose interest','Vite lassé'),o('slow-warmup','Slow to warm up','Lent à s’ouvrir')]},
 {id:'quick-quiz-05',en:'When making choices, do you trust your gut or logic?',fr:'Pour décider, suivez-vous votre intuition ou la logique ?',options:[o('intuition','Trust my gut','Mon intuition'),o('logic','Use logic','La logique')]},
 {id:'quick-quiz-06',en:'In your free time, do you prefer alone time or hanging out with friends?',fr:'Pendant votre temps libre, préférez-vous être seul ou retrouver des amis ?',options:[o('alone','Alone time','Du temps seul'),o('friends','Hang with friends','Voir des amis')]},
 {id:'quick-quiz-07',en:'Do you easily start conversations with new people?',fr:'Engagez-vous facilement la conversation avec de nouvelles personnes ?',options:yesNo},
 {id:'quick-quiz-08',en:'Do you prefer thrilling content or calm, cozy content?',fr:'Préférez-vous les contenus intenses ou calmes et chaleureux ?',options:[o('thrilling','Thrilling content','Intenses'),o('cozy','Cozy calm content','Calmes et doux')]},
 {id:'quick-quiz-09',en:'For trips, are you a planner or go-with-the-flow?',fr:'En voyage, préférez-vous tout prévoir ou suivre vos envies ?',options:[o('planner','Planner','Tout prévoir'),o('flow','Go with the flow','Au gré des envies')]},
 {id:'quick-quiz-10',en:'Do you know your MBTI personality type?',fr:'Connaissez-vous votre type de personnalité MBTI ?',options:['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'].map(x=>o(x,x,x))},
]
export const conversationPolicy={version:conversationVersion,questionSeconds:5,themes:['purple','pink','orange','cyan'],questions:quizQuestions.map(q=>({id:q.id,optionIds:q.options.map(x=>x.id)}))}

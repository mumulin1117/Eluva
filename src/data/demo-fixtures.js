// Device-local fictional personas; the supplied post text stays original in both UI languages.
export const demoFixtureVersion = 4
export const demoScope = 'eluva-test-user-v1'
export const presentationFixture = {version:5,accountName:'Alex Morgan',greeting:{en:'Hey! How has your day been?',de:'Hallo! Wie war dein Tag?'}}
const female = [
 ['Maya Brooks',22,'A slower day, a good film, and room to breathe.','Ein ruhigerer Tag, ein guter Film und Zeit zum Durchatmen.',['film','music','coffee'],'arts'],
 ['Chloe Martin',23,'Finding time for little conversations between busy days.','Zeit für kleine Gespräche zwischen hektischen Tagen finden.',['books','coffee','music'],'social'],
 ['Emma Laurent',21,'Making new plans, even when the old ones change.','Neue Pläne schmieden, auch wenn sich die alten ändern.',['photos','art','travel'],'arts'],
 ['Sofia Reed',24,'Curious about people, stories and new perspectives.','Neugierig auf Menschen, Geschichten und neue Perspektiven.',['photos','books','travel'],'social'],
 ['Lily Bennett',22,'Evening walks and small moments worth keeping.','Abendspaziergänge und kleine Momente, die man bewahren möchte.',['nature','photos','music'],'science'],
 ['Nora Ellis',21,'A campus walk is better with a little company.','Ein Spaziergang über den Campus ist mit etwas Gesellschaft schöner.',['nature','sport','coffee'],'health'],
 ['Amelia Ross',23,'Art, playlists and a notebook full of ideas.','Kunst, Playlists und ein Notizbuch voller Ideen.',['art','music','books'],'arts'],
 ['Zoe Parker',22,'Always happy to swap a book recommendation.','Immer bereit, Buchempfehlungen auszutauschen.',['books','film','coffee'],'social'],
 ['Clara Mason',24,'Trying new recipes and cheering on my friends.','Neue Rezepte ausprobieren und meine Freunde anfeuern.',['cooking','sport','volunteer'],'business'],
 ['Eva Morgan',21,'Good conversations can start with the smallest hello.','Gute Gespräche können mit dem kleinsten Hallo beginnen.',['music','photos','coffee'],'computing'],
]
const male = [
 ['Liam Carter',22,'Coffee breaks, new music and a little curiosity.','Kaffeepausen, neue Musik und ein wenig Neugier.',['coffee','music','books'],'computing'],
 ['Noah Bennett',23,'A good film and a conversation afterwards.','Ein guter Film und danach ein Gespräch darüber.',['film','art','coffee'],'arts'],
 ['Ethan Miles',21,'Learning something new, one day at a time.','Jeden Tag etwas Neues lernen.',['sport','books','nature'],'engineering'],
 ['Oliver Hayes',24,'Weekend trails and photos from the journey.','Wanderwege am Wochenende und Fotos von unterwegs.',['nature','travel','photos'],'science'],
 ['Lucas Reed',22,'Making space for friends, games and everyday stories.','Zeit für Freunde, Spiele und Geschichten aus dem Alltag.',['games','music','cooking'],'business'],
 ['Leo Martin',23,'Quiet corners, open books and taking things slowly.','Ruhige Ecken, offene Bücher und alles langsam angehen.',['books','nature','coffee'],'social'],
 ['Theo Brooks',24,'Learning to listen, and to be a little kinder to myself.','Lernen zuzuhören und etwas freundlicher zu mir selbst zu sein.',['music','books','art'],'health'],
 ['Adam Ellis',22,'Long conversations and the friends who make them easy.','Lange Gespräche und Freunde, mit denen sie ganz leicht werden.',['coffee','sport','books'],'business'],
 ['Hugo Parker',21,'Some days call for a walk and a fresh perspective.','An manchen Tagen helfen ein Spaziergang und eine neue Perspektive.',['nature','photos','travel'],'science'],
 ['Finn Morgan',24,'Real feelings, good food and time with friends.','Echte Gefühle, gutes Essen und Zeit mit Freunden.',['cooking','music','volunteer'],'engineering'],
]
const legacy={'female-01':'demo-friend-echo','male-06':'demo-friend-notes','female-02':'demo-requester','male-07':'demo-recipient','female-03':'demo-stranger','male-08':'demo-blocked-user'}
export const demoPeople=[['female',female],['male',male]].flatMap(([gender,people])=>people.map(([displayName,age,about,de,interestIds,major],index)=>{
 const number=index+1,key=gender+'-'+String(number).padStart(2,'0')
 return {id:legacy[key]||'demo-person-'+key,fixtureGender:gender,fixtureNumber:number,displayName,age,gender:gender==='female'?'woman':'man',about,aboutTranslations:{de},interestIds,major,university:'',photos:[{id:'demo-avatar-'+key,asset:'images/demo-users/'+key+'-avatar.png'}]}
}))
const postSpecs=[
 ['female',1,1,'Not feeling like doing anything today, just wanna zone out.',['film','coffee']],
 ['female',2,2,'Been super busy, but still feel lonely for no reason.',['music','books']],
 ['female',3,1,'Ugh, all my plans got messed up again.',['travel','art']],
 ['female',4,2,'Sometimes I wonder how I look to other people.',['photos','travel']],
 ['female',5,3,'Little happy moment — the evening breeze feels so nice.',['nature','photos']],
 ['male',6,2,'Stuck in overthinking, wish I could quiet my mind.',['books','nature']],
 ['male',7,2,'Not everyone gets how you feel. Learning to accept it.',['music','art']],
 ['male',8,2,'Had a long chat with a friend today, feels like a weight lifted off.',['coffee','books']],
 ['male',9,1,'Waited for something for so long, but it turned out underwhelming.',['nature','travel']],
 ['male',10,3,'No need to stay positive all the time. It’s okay to feel low.',['music','cooking']],
]
export const demoPosts=postSpecs.map(([gender,number,count,body,tagIds],index)=>{
 const person=demoPeople.find(p=>p.fixtureGender===gender&&p.fixtureNumber===number),key=String(number).padStart(2,'0')
 return {id:number===1?'demo-post-campus-v1':number===6?'demo-post-question-v1':'demo-post-'+gender+'-'+key+'-v2',authorId:person.id,demoName:person.displayName,fixtureNumber:number,body,
 media:Array.from({length:count},(_,i)=>({id:'demo-post-media-'+key+'-'+(i+1),kind:'image',asset:'images/demo-users/post-'+key+'-'+String(i+1).padStart(2,'0')+'.png'})),
 visibility:{private:false,audience:'everyone',discover:true,profile:true},audienceFilter:'any',tagIds,createdAt:new Date(Date.UTC(2026,9,18,12,-index*10)).toISOString()}
})
export const demoConversations=[
 {peerId:'demo-person-female-06',threadId:'demo-thread-nora',messageId:'echo-context-v2',legacyPeerId:'demo-friend-echo',legacyThreadId:'demo-thread-echo',legacyBody:'Taking a quiet evening after that post. Thanks for checking in — what helps you unwind?',greetingId:'echo-text',createdAt:'2026-10-18T12:30:00.000Z',text:{en:'Taking a quiet evening today. What helps you unwind?',de:'Ich verbringe heute einen ruhigen Abend. Was hilft dir beim Abschalten?'}},
 {peerId:'demo-person-male-01',threadId:'demo-thread-liam',messageId:'notes-context-v2',legacyPeerId:'demo-friend-notes',legacyThreadId:'demo-thread-notes',legacyBody:'A walk and a few pages helped me slow down. Do you have a favourite quiet spot?',greetingId:'notes-text',createdAt:'2026-10-18T12:20:00.000Z',text:{en:'A coffee break and some music helped me slow down. What are you listening to lately?',de:'Eine Kaffeepause und etwas Musik haben mir geholfen, zur Ruhe zu kommen. Was hörst du gerade?'}},
]
export const demoRequestText={
 'demo-request-in':'Busy days can still feel lonely. Would you like to say hello?',
 'demo-request-out':'I connected with your post about being understood. Happy to start with a hello.',
}

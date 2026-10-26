// Device-local fictional personas; the supplied post text stays original in both UI languages.
export const demoFixtureVersion = 3
export const demoScope = 'eluva-test-user-v1'
export const presentationFixture = {version:4,accountName:'Alex Morgan',greeting:{en:'Hey! How has your day been?',fr:'Salut ! Comment s’est passée ta journée ?'}}
const female = [
 ['Maya Brooks',22,'A slower day, a good film, and room to breathe.','Une journée tranquille, un bon film et le temps de respirer.',['film','music','coffee'],'arts'],
 ['Chloe Martin',23,'Finding time for little conversations between busy days.','Trouver du temps pour échanger entre deux journées chargées.',['books','coffee','music'],'social'],
 ['Emma Laurent',21,'Making new plans, even when the old ones change.','Imaginer de nouveaux projets quand les anciens changent.',['photos','art','travel'],'arts'],
 ['Sofia Reed',24,'Curious about people, stories and new perspectives.','Curieuse des gens, des histoires et de nouveaux points de vue.',['photos','books','travel'],'social'],
 ['Lily Bennett',22,'Evening walks and small moments worth keeping.','Des balades du soir et de petits instants à garder.',['nature','photos','music'],'science'],
 ['Nora Ellis',21,'A campus walk is better with a little company.','Une promenade sur le campus est plus agréable à plusieurs.',['nature','sport','coffee'],'health'],
 ['Amelia Ross',23,'Art, playlists and a notebook full of ideas.','De l’art, des playlists et un carnet rempli d’idées.',['art','music','books'],'arts'],
 ['Zoe Parker',22,'Always happy to swap a book recommendation.','Toujours partante pour échanger des idées de lecture.',['books','film','coffee'],'social'],
 ['Clara Mason',24,'Trying new recipes and cheering on my friends.','Tester de nouvelles recettes et encourager mes amis.',['cooking','sport','volunteer'],'business'],
 ['Eva Morgan',21,'Good conversations can start with the smallest hello.','Une belle conversation peut commencer par un simple bonjour.',['music','photos','coffee'],'computing'],
]
const male = [
 ['Liam Carter',22,'Coffee breaks, new music and a little curiosity.','Des pauses café, de nouvelles musiques et un peu de curiosité.',['coffee','music','books'],'computing'],
 ['Noah Bennett',23,'A good film and a conversation afterwards.','Un bon film et une conversation pour en parler.',['film','art','coffee'],'arts'],
 ['Ethan Miles',21,'Learning something new, one day at a time.','Apprendre quelque chose de nouveau, un jour après l’autre.',['sport','books','nature'],'engineering'],
 ['Oliver Hayes',24,'Weekend trails and photos from the journey.','Des sentiers le week-end et des photos du voyage.',['nature','travel','photos'],'science'],
 ['Lucas Reed',22,'Making space for friends, games and everyday stories.','Faire une place aux amis, aux jeux et aux histoires du quotidien.',['games','music','cooking'],'business'],
 ['Leo Martin',23,'Quiet corners, open books and taking things slowly.','Des coins tranquilles, des livres ouverts et le temps de ralentir.',['books','nature','coffee'],'social'],
 ['Theo Brooks',24,'Learning to listen, and to be a little kinder to myself.','Apprendre à écouter et à être plus bienveillant envers moi-même.',['music','books','art'],'health'],
 ['Adam Ellis',22,'Long conversations and the friends who make them easy.','De longues conversations avec les amis qui les rendent faciles.',['coffee','sport','books'],'business'],
 ['Hugo Parker',21,'Some days call for a walk and a fresh perspective.','Certains jours invitent à marcher et à changer de perspective.',['nature','photos','travel'],'science'],
 ['Finn Morgan',24,'Real feelings, good food and time with friends.','Des émotions sincères, de bons repas et du temps entre amis.',['cooking','music','volunteer'],'engineering'],
]
const legacy={'female-01':'demo-friend-echo','male-06':'demo-friend-notes','female-02':'demo-requester','male-07':'demo-recipient','female-03':'demo-stranger','male-08':'demo-blocked-user'}
export const demoPeople=[['female',female],['male',male]].flatMap(([gender,people])=>people.map(([displayName,age,about,fr,interestIds,major],index)=>{
 const number=index+1,key=gender+'-'+String(number).padStart(2,'0')
 return {id:legacy[key]||'demo-person-'+key,fixtureGender:gender,fixtureNumber:number,displayName,age,gender:gender==='female'?'woman':'man',about,aboutTranslations:{fr},interestIds,major,university:'',photos:[{id:'demo-avatar-'+key,asset:'images/demo-users/'+key+'-avatar.png'}]}
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
 {peerId:'demo-person-female-06',threadId:'demo-thread-nora',messageId:'echo-context-v2',legacyPeerId:'demo-friend-echo',legacyThreadId:'demo-thread-echo',legacyBody:'Taking a quiet evening after that post. Thanks for checking in — what helps you unwind?',greetingId:'echo-text',createdAt:'2026-10-18T12:30:00.000Z',text:{en:'Taking a quiet evening today. What helps you unwind?',fr:'Je prends une soirée tranquille aujourd’hui. Qu’est-ce qui t’aide à décompresser ?'}},
 {peerId:'demo-person-male-01',threadId:'demo-thread-liam',messageId:'notes-context-v2',legacyPeerId:'demo-friend-notes',legacyThreadId:'demo-thread-notes',legacyBody:'A walk and a few pages helped me slow down. Do you have a favourite quiet spot?',greetingId:'notes-text',createdAt:'2026-10-18T12:20:00.000Z',text:{en:'A coffee break and some music helped me slow down. What are you listening to lately?',fr:'Une pause café et un peu de musique m’ont aidé à ralentir. Qu’est-ce que tu écoutes en ce moment ?'}},
]
export const demoRequestText={
 'demo-request-in':'Busy days can still feel lonely. Would you like to say hello?',
 'demo-request-out':'I connected with your post about being understood. Happy to start with a hello.',
}

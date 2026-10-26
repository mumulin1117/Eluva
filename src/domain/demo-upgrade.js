import { demoFixtureVersion,demoScope,demoPeople,demoPosts,demoConversations,demoRequestText,presentationFixture } from '../data/demo-fixtures.js'

// Migrate only exact shipped copy, never arbitrary text containing a keyword.
export function upgradePresentation(root) {
  if((root.presentationVersion||0)>=presentationFixture.version)return
  const migrateCopy=(root.presentationVersion||0)<1
  const account=root.accounts?.[demoScope]
  if(migrateCopy&&account?.isTest&&account.profile?.displayName==='Eluva Demo')account.profile.displayName=presentationFixture.accountName
  const old='A small hello from the local demo.'
  for(const name of ['echo','notes']){
    const voiceId=demoScope+':'+name+'-voice',voice=root.social?.messages?.[voiceId]
    // Retire only the exact shipped history, never a user's recorded message.
    if(voice?.demo===true&&voice.kind==='voice'&&!voice.mediaId&&voice.asset==='demo/local-voice.wav'&&voice.threadId==='demo-thread-'+name&&voice.senderId===demoScope&&voice.recipientId==='demo-friend-'+name)delete root.social.messages[voiceId]
    const message=root.social?.messages?.[demoScope+':'+name+'-text']
    if(migrateCopy&&message?.demo&&message.body===old){message.body=presentationFixture.greeting.en;message.translations={...presentationFixture.greeting}}
  }
  const request=root.social?.requests?.['demo-request-in']
  if(migrateCopy&&request?.demo&&request.body==='Your quiet-day post resonated with me. Would you like to say hello?')request.body=demoRequestText['demo-request-in']
  for(const thread of root.fixtures?.[demoScope]?.threads||[]){
    const name=['echo','notes'].find(name=>thread.id==='demo-thread-'+name&&thread.participantId==='demo-friend-'+name)
    if(name)thread.messages=(thread.messages||[]).filter(m=>!(m.id===name+'-voice'&&m.kind==='voice'&&!m.mediaId&&m.asset==='demo/local-voice.wav'&&m.sentByMe===true))
    const peer=demoPeople.find(p=>p.id===thread.participantId)
    if(migrateCopy&&peer&&thread.title?.en?.startsWith('Local demo '))thread.title={en:peer.displayName,fr:peer.displayName}
    for(const message of thread.messages||[])if(migrateCopy&&message.kind==='text'&&message.body?.en===old)message.body={...presentationFixture.greeting}
  }
  upgradeDemoChatPeers(root)
  root.presentationVersion=presentationFixture.version
}

// Only the fixed account's shipped chat fixtures move. Persona identities,
// posts, blocks and conversations created by the user keep their owners.
function upgradeDemoChatPeers(root) {
  if(root.accounts?.[demoScope]?.isTest!==true)return
  const fixture=root.fixtures?.[demoScope],social=root.social,stamp='2026-10-17T08:00:00.000Z'
  const pair=(a,b)=>[a,b].sort().join('|')
  for(const item of demoConversations){
    const oldPeer=item.legacyPeerId,peer=item.peerId,oldPair=pair(demoScope,oldPeer),newPair=pair(demoScope,peer)
    if(fixture){
      fixture.friends=[...new Set((fixture.friends||[]).map(id=>id===oldPeer?peer:id))]
      for(const thread of fixture.threads||[])if(thread.id===item.legacyThreadId&&thread.participantId===oldPeer){
        thread.id=item.threadId;thread.participantId=peer
        const name=demoPeople.find(p=>p.id===peer).displayName;thread.title={en:name,fr:name}
      }
    }
    const oldThread=social?.threads?.[item.legacyThreadId]
    if(!oldThread||oldThread.createdAt!==stamp||oldThread.users?.length!==2||!oldThread.users.includes(demoScope)||!oldThread.users.includes(oldPeer))continue
    const rows=Object.values(social.messages).filter(m=>m.threadId===oldThread.id)
    const shipped=rows.filter(m=>m.demo===true&&m.kind==='text'&&!m.mediaId&&m.senderId===oldPeer&&m.recipientId===demoScope&&(
      (m.id===demoScope+':'+item.greetingId&&m.createdAt===stamp&&m.body===presentationFixture.greeting.en)||
      (m.id===demoScope+':'+item.messageId&&m.createdAt===item.createdAt&&m.body===item.legacyBody)
    ))
    const hasUserHistory=rows.length!==shipped.length||!!social.connections?.[oldPair]||Object.values(social.requests).some(r=>r.pair===oldPair)||Object.values(root.realtime?.calls||{}).some(c=>[c.ownerId,c.peerId].includes(demoScope)&&[c.ownerId,c.peerId].includes(oldPeer))
    const existing=Object.values(social.threads).find(t=>t.pair===newPair)
    const targetHasRelationship=!!(existing||social.friendships[newPair]||social.follows[demoScope+':'+peer]||social.follows[peer+':'+demoScope]||social.connections?.[newPair]||Object.values(social.requests).some(r=>r.pair===newPair))
    const thread=existing||{...oldThread,id:item.threadId,pair:newPair,users:[demoScope,peer]}
    social.threads[thread.id]=thread
    for(const message of shipped){
      message.threadId=thread.id;message.senderId=peer
      if(message.id===demoScope+':'+item.messageId){message.body=item.text.en;message.translations={...item.text}}
    }
    if(!hasUserHistory){
      delete social.threads[oldThread.id]
      const friendship=social.friendships[oldPair]
      if(friendship?.createdAt===stamp){
        if(!targetHasRelationship)social.friendships[newPair]={...friendship,id:newPair,users:[demoScope,peer]}
        delete social.friendships[oldPair]
      }
      for(const [a,b]of [[demoScope,oldPeer],[oldPeer,demoScope]]){
        const key=a+':'+b,follow=social.follows[key],sender=a===oldPeer?peer:a,recipient=b===oldPeer?peer:b
        if(follow?.createdAt===stamp){
          if(!targetHasRelationship)social.follows[sender+':'+recipient]={...follow,senderId:sender,recipientId:recipient}
          delete social.follows[key]
        }
      }
    } else if(!targetHasRelationship){
      // Existing real exchanges stay with their original participant and permissions.
      social.friendships[newPair]={id:newPair,users:[demoScope,peer],createdAt:stamp}
      for(const [a,b]of [[demoScope,peer],[peer,demoScope]])social.follows[a+':'+b]={senderId:a,recipientId:b,createdAt:stamp}
    }
  }
}

// Update shipped fixture records only. User-authored posts, relationships,
// comments, light records, read markers, blocks and preferences keep their IDs.
export function upgradeDemoContent(content) {
  if((content.fixtureVersion||0)>=demoFixtureVersion)return
  for(const post of demoPosts){
    const old=content.posts[post.id]
    if(!old||old.demoScope===demoScope)content.posts[post.id]={...structuredClone(post),...(old?.deletedAt?{deletedAt:old.deletedAt}:{})}
  }
  content.fixtureVersion=demoFixtureVersion
}
export function upgradeDemoSocial(social,root) {
  if((social.fixtureVersion||0)>=demoFixtureVersion)return
  for(const person of demoPeople){
    const old=social.profiles[person.id]
    if(!old||old.demo===true)social.profiles[person.id]={...structuredClone(person),demo:true}
  }
  const blocks=root.content?.blocks||{}
  for(const item of demoConversations){
    const thread=social.threads[item.threadId],id=demoScope+':'+item.messageId
    if(!thread?.users?.includes(demoScope)||!thread.users.includes(item.peerId)||social.messages[id])continue
    if(blocks[demoScope+':'+item.peerId]||blocks[item.peerId+':'+demoScope])continue
    social.messages[id]={id,threadId:thread.id,senderId:item.peerId,recipientId:demoScope,kind:'text',body:item.text.en,translations:{...item.text},createdAt:item.createdAt,readAt:null,demo:true}
  }
  const oldText={'demo-request-in':'A hello from the local request demo.','demo-request-out':'A local introduction waiting for a decision.'}
  for(const [id,body]of Object.entries(demoRequestText))if(social.requests[id]?.demo&&social.requests[id].body===oldText[id])social.requests[id].body=body
  social.fixtureVersion=demoFixtureVersion
}
export function demoPhotoAsset(peerId,photoId){return demoPeople.find(p=>p.id===peerId)?.photos.find(p=>p.id===photoId)?.asset}

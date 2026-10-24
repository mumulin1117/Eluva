export const scrollPositions = new Map()
export const scrollKey = (path,ownerId) => (ownerId||'guest')+':'+path
export function allowedReturnPath(value,{fallback,exact=[],prefix=[]}) {
  const path=typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')?value.split('?')[0]:''
  return path&&(exact.includes(path)||prefix.some(p=>path.startsWith(p)))?value:fallback
}

// Walk the recorded source chain instead of returning to content just blocked.
// Only known app destinations are accepted; history length is not a trust signal.
export function blockedReturnPath(value,{blockedPeerIds=[],posts=[]}={}) {
  const blocked=new Set(blockedPeerIds),seen=new Set()
  let candidate=value
  for(let depth=0;depth<8;depth++){
    const allowed=allowedReturnPath(candidate,{fallback:'',exact:['/home','/mine','/chats','/chats/lights','/friends','/friend-requests'],prefix:['/post/','/conversation/','/profile/']})
    if(!allowed||seen.has(allowed))break
    seen.add(allowed)
    const url=new URL(allowed,'https://eluva.invalid'),parts=url.pathname.split('/').filter(Boolean)
    let id
    try{id=decodeURIComponent(parts[1]||'')}catch{break}
    if(parts[0]==='conversation'&&blocked.has(id))return '/chats'
    if(parts[0]==='post'&&!posts.some(p=>p.id===id&&!blocked.has(p.authorId))||parts[0]==='profile'&&blocked.has(id))candidate=url.searchParams.get('from')
    else return allowed
  }
  return '/home'
}

// Presentation-only time: blocked/background intervals never consume the handoff.
// The existing conversation timer drives this; there is no extra loading delay.
export function createWelcomeRelay({duration=320}={}) {
 let phase='waiting',elapsed=0,last=null,blockedBefore=true
 return {
  update({prepared=false,covered=false,hidden=false,modal=false,reduced=false,style='brief',eligible=true}={},now=0){
   const blocked=!prepared||covered||hidden||modal
   const delta=last===null||blockedBefore||blocked?0:Math.max(0,now-last)
   last=now;blockedBefore=blocked
   if(!eligible)phase='done'
   if(phase!=='done'&&!blocked){
    if(reduced||style!=='full')phase='done'
    else if(phase==='waiting')phase='receiving'
    else{elapsed+=delta;if(elapsed>=duration)phase='done'}
   }
   return {phase,paused:blocked,held:blocked||phase!=='done',elapsed:Math.min(duration,elapsed)}
  },
 }
}

import { newId } from '../domain/id.js'

// One gesture owns one capture. A cancelled or superseded gesture can never send.
export class VoiceHold {
 constructor({call,changed,media,error}){Object.assign(this,{call,changed,media,error});this.phase='idle';this.generation=0;this.armed=false}
 emit(extra={}){this.changed?.({phase:this.phase,cancelArmed:this.armed,...extra})}
 cancelNative(recordingId,reason){return this.call('realtime','cancel',{reason,recordingId}).catch(()=>{})}
 discardStaged(media,context){if(media?.id&&context?.draftId)this.call('media','remove',{id:media.id,draftId:context.draftId}).catch(()=>{})}
 async start(context){
  if(this.phase!=='idle')return
  const generation=++this.generation,recordingId=newId();this.id=recordingId;this.context={...context};this.controller=new AbortController();this.pendingSend=false;this.phase='starting';this.armed=false;this.emit({duration:0,level:0,reason:''})
  try{
   await this.call('realtime','recordStart',{...context,recordingId},{signal:this.controller.signal})
   if(generation!==this.generation||this.phase!=='starting'){
    // A bridge implementation may finish after its AbortSignal. Address the old
    // recording explicitly, never the capture belonging to the next gesture.
    await this.cancelNative(recordingId,'cancelled');return
   }
   this.phase='recording';this.emit();this.poll(generation)
  }catch(e){if(generation===this.generation){this.phase='idle';this.emit();if(e.code!=='CANCELLED')this.error?.(e)}}
 }
 async poll(generation){
  if(generation!==this.generation||this.phase!=='recording')return
  try{
   const status=await this.call('realtime','recordStatus',{recordingId:this.id},{signal:this.controller.signal})
   if(generation!==this.generation||this.phase!=='recording')return
   const duration=Number.isFinite(status.duration)?Math.max(0,status.duration):0,level=Number.isFinite(status.level)?Math.min(1,Math.max(0,status.level)):0
   this.emit({duration,level})
   if(status.state==='limit'){if(this.armed)this.cancel('cancelled');else await this.finish(false);return}
   if(!status.recording){this.cancel(status.reason||'interrupted');this.error?.({code:'RECORDING_INTERRUPTED'});return}
  }catch(e){if(generation===this.generation&&e.code!=='CANCELLED'){this.error?.(e);this.cancel('interrupted')}return}
  if(generation===this.generation&&this.phase==='recording')this.timer=setTimeout(()=>this.poll(generation),200)
 }
 arm(value){if(['starting','recording'].includes(this.phase)){this.armed=!!value;this.emit()}}
 release(){if(this.phase==='starting'||this.armed){this.cancel('cancelled');return}if(this.phase==='recording')return this.finish(true)}
 async finish(send){
  if(!['recording','retry'].includes(this.phase))return
  clearTimeout(this.timer);const generation=this.generation,context=this.context
  // A limit creates a review draft. Retrying its staging must keep that intent.
  if(send!==undefined)this.pendingSend=!!send
  const shouldSend=this.pendingSend;this.phase='stopping';this.armed=false;this.emit()
  try{
   const media=await this.call('realtime','recordStop',{recordingId:this.id},{signal:this.controller.signal})
   if(generation!==this.generation){this.discardStaged(media,context);return}
   this.phase='idle';this.emit();await this.media?.(media,{send:shouldSend})
  }catch(e){if(generation===this.generation){this.phase=e.code==='STORAGE_FAILED'?'retry':'idle';this.emit();if(e.code!=='CANCELLED')this.error?.(e)}}
 }
 cancel(reason='left'){
  const active=this.phase!=='idle',recordingId=this.id;this.generation++;clearTimeout(this.timer);this.controller?.abort();this.phase='idle';this.armed=false;this.emit({duration:0,level:0,reason})
  if(active)this.cancelNative(recordingId,reason)
 }
}

import { invariant } from './errors.js'
import { characterCount } from './content.js'
import { stickerIds } from '../data/social-demo.js'

const stickers=new Set(stickerIds)
export function normalizeMessageParts(parts){
 invariant(Array.isArray(parts)&&parts.length<=2000,'INVALID_MESSAGE')
 const result=[]
 for(const part of parts){
  invariant(part&&typeof part==='object'&&!Array.isArray(part),'INVALID_MESSAGE')
  if(part.type==='text'){
   invariant(Object.keys(part).every(k=>['type','text'].includes(k))&&typeof part.text==='string','INVALID_MESSAGE')
   if(!part.text)continue
   if(result.at(-1)?.type==='text')result.at(-1).text+=part.text
   else result.push({type:'text',text:part.text})
  }else{
   invariant(part.type==='sticker'&&Object.keys(part).every(k=>['type','stickerId'].includes(k))&&stickers.has(part.stickerId),'INVALID_MESSAGE')
   result.push({type:'sticker',stickerId:part.stickerId})
  }
 }
 invariant(messagePartCount(result)<=2000,'INVALID_MESSAGE')
 return result
}
export const messagePartText=parts=>parts.filter(x=>x.type==='text').map(x=>x.text).join('')
export const messagePartCount=parts=>parts.reduce((n,x)=>n+(x.type==='sticker'?1:characterCount(x.text)),0)
export const hasMessageParts=parts=>parts.some(x=>x.type==='sticker'||x.text.trim())
export function validateMessageParts(parts,body){
 const normalized=normalizeMessageParts(parts)
 invariant(hasMessageParts(normalized)&&messagePartText(normalized).trim()===body,'INVALID_MESSAGE')
 return normalized
}
export function displayMessageParts(message){
 if(Array.isArray(message.parts))try{return normalizeMessageParts(message.parts)}catch{/* Older or damaged optional data falls back to its original text. */}
 return message.body?[{type:'text',text:message.body}]:[]
}
export const messagePartUnits=parts=>parts.reduce((n,x)=>n+(x.type==='text'?x.text.length:1),0)
export function replaceMessageRange(parts,start,end,insert=[]){
 const size=messagePartUnits(parts);start=Math.max(0,Math.min(size,start));end=Math.max(start,Math.min(size,end))
 const before=[],after=[];let offset=0
 for(const part of parts){
  const length=part.type==='text'?part.text.length:1
  if(offset+length<=start)before.push(part)
  else if(offset<start&&part.type==='text')before.push({type:'text',text:part.text.slice(0,start-offset)})
  if(offset>=end)after.push(part)
  else if(offset+length>end&&part.type==='text')after.push({type:'text',text:part.text.slice(end-offset)})
  offset+=length
 }
 return normalizeMessageParts([...before,...insert,...after])
}
export function previousMessageUnit(parts,position){
 const prefix=[];let offset=0
 for(const part of parts){const length=part.type==='text'?part.text.length:1;if(offset>=position)break;prefix.push(part.type==='text'?{type:'text',text:part.text.slice(0,position-offset)}:part);offset+=length}
 const last=prefix.at(-1);if(!last)return position
 if(last.type==='sticker')return position-1
 const segments=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(last.text)]
 return position-(segments.at(-1)?.segment.length||0)
}

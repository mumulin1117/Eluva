import { AppError } from '../domain/errors.js'
import { invariant } from '../domain/errors.js'
import { contentPolicy } from '../domain/content.js'
export function readBase64(file,signal) {
 return new Promise((resolve,reject)=>{const reader=new FileReader(),abort=()=>reader.abort(),cleanup=()=>signal?.removeEventListener('abort',abort);signal?.addEventListener('abort',abort,{once:true});reader.onload=()=>{cleanup();resolve(String(reader.result).split(',')[1])};reader.onerror=()=>{cleanup();reject(new AppError('MEDIA_UNSUPPORTED'))};reader.onabort=()=>{cleanup();reject(new AppError('CANCELLED'))};if(signal?.aborted)return reject(new AppError('CANCELLED'));reader.readAsDataURL(file)})
}
export async function validateMediaFile(file,signal,{imagesOnly=false}={}) {
 const video=['video/mp4','video/quicktime'].includes(file.type)
 invariant(['image/jpeg','image/png','image/webp',...(!imagesOnly?['video/mp4','video/quicktime']:[])].includes(file.type),'MEDIA_UNSUPPORTED')
 invariant(file.size<=(video?contentPolicy.videoBytes:20*1024*1024),'MEDIA_TOO_LARGE')
 if(video)await new Promise((resolve,reject)=>{const element=document.createElement('video'),url=URL.createObjectURL(file),cleanup=()=>{signal?.removeEventListener('abort',abort);element.removeAttribute('src');element.load();URL.revokeObjectURL(url)},finish=error=>{cleanup();error?reject(error):resolve()},abort=()=>finish(new AppError('CANCELLED'));signal?.addEventListener('abort',abort,{once:true});element.preload='metadata';element.onloadedmetadata=()=>{const valid=Number.isFinite(element.duration)&&element.duration>0&&element.duration<=contentPolicy.videoSeconds;finish(valid?null:new AppError('INVALID_VIDEO'))};element.onerror=()=>finish(new AppError('INVALID_VIDEO'));if(signal?.aborted)return abort();element.src=url})
 return video?'video':'image'
}

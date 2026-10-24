// Keep vertical scrolling, pull-to-refresh and horizontal paging mutually exclusive.
export function gestureAxis(dx,dy,threshold=9){
 if(Math.max(Math.abs(dx),Math.abs(dy))<threshold)return ''
 if(Math.abs(dx)>Math.abs(dy)*1.15)return 'horizontal'
 if(Math.abs(dy)>Math.abs(dx)*1.15)return 'vertical'
 return ''
}
export function pullDistance(dy){return Math.min(92,Math.max(0,dy)*.48)}
export function swipeCategory(current,dx,{width,elapsed=Infinity}={}){
 const distance=Math.abs(dx),threshold=Math.max(48,Math.min(96,(width||320)*.22))
 const committed=distance>=threshold||distance>=32&&distance/Math.max(elapsed,1)>.48
 if(!committed)return current
 return dx<0&&current==='all'?'following':dx>0&&current==='following'?'all':current
}
export const chatsScrollPath=category=>'/chats#'+(category==='following'?'following':'all')

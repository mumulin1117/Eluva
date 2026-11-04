import { socialMessages } from '../data/social-messages.js'

export const HELP_REPLY_DELAY_MS=5000
const normalized=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase()
// Match the message itself, including either UI language. Editing a preset
// must not keep the old topic and produce an unrelated answer.
export function helpTopic(body){
 const value=normalized(body)
 for(const topic of ['how','posting','privacy'])for(const locale of ['en','de'])if(value===normalized(socialMessages[locale][topic]))return topic
 return 'feedback'
}
export function helpReplyDue(item){
 const created=Date.parse(item.createdAt)
 return item.topic==='feedback'&&Number.isFinite(created)?created+HELP_REPLY_DELAY_MS:0
}
export const helpReplyPending=(item,now=Date.now())=>helpReplyDue(item)>now
export const helpAnswer=topic=>'s.'+({how:'helpHow',posting:'helpPosting',privacy:'helpPrivacy',feedback:'helpFeedback'}[topic]||'helpFeedback')

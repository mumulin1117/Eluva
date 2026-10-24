import test from 'node:test'
import assert from 'node:assert/strict'
import { helpTopic,helpReplyDue,helpReplyPending,HELP_REPLY_DELAY_MS } from '../src/domain/help-buddy.js'
import { socialMessages } from '../src/data/social-messages.js'

test('Help Buddy recognizes both languages by body, and edited presets use the fallback',()=>{
 for(const locale of ['en','fr'])for(const topic of ['how','posting','privacy'])assert.equal(helpTopic('  '+socialMessages[locale][topic]+'  '),topic)
 assert.equal(helpTopic(socialMessages.en.how+' I have another question.'),'feedback')
 assert.equal(helpTopic('Where is my missing draft?'),'feedback')
})
test('fallback has one five-second deadline from the saved message, including return and reload',()=>{
 const start=Date.parse('2026-10-22T00:00:00Z'),item={topic:'feedback',createdAt:new Date(start).toISOString()}
 assert.equal(HELP_REPLY_DELAY_MS,5000)
 assert.equal(helpReplyDue(item),start+5000)
 assert.equal(helpReplyPending(item,start+4999),true)
 assert.equal(helpReplyPending(JSON.parse(JSON.stringify(item)),start+5000),false)
 assert.equal(helpReplyPending(item,start+60000),false)
 for(const topic of ['how','posting','privacy'])assert.equal(helpReplyPending({...item,topic},start),false)
 assert.equal(helpReplyPending({topic:'feedback',createdAt:'legacy-invalid'}),false)
})

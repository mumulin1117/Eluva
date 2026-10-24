import test from 'node:test'
import assert from 'node:assert/strict'
import { indexedDB } from 'fake-indexeddb'
import { BrowserRepository } from '../src/services/browser-repository.js'
import { LEGAL_VERSION } from '../src/domain/validation.js'
import { normalizeMessageParts,validateMessageParts,messagePartText,messagePartCount,replaceMessageRange,previousMessageUnit,displayMessageParts } from '../src/domain/message-parts.js'
const text=text=>({type:'text',text}),sticker=(stickerId='sticker-01')=>({type:'sticker',stickerId})
const call=(r,key,p={})=>{const [s,m]=key.split('.');return r.execute(s,m,p)}
async function make(t){const r=new BrowserRepository({indexedDB,dbName:'inline-message-'+crypto.randomUUID()});t.after(()=>r.close());await call(r,'app.bootstrap');await call(r,'preferences.consent',{accepted:true,version:LEGAL_VERSION});await call(r,'auth.login',{email:'eluva@gmail.com',password:'123qweasd'});await call(r,'social.snapshot');return r}

test('inline expressions preserve text on both sides, selected replacement and multiple image order',()=>{
 const parts=replaceMessageRange([text('Hello there')],5,5,[sticker()])
 assert.deepEqual(parts,[text('Hello'),sticker(),text(' there')])
 assert.deepEqual(replaceMessageRange(parts,6,7,[text(' dear '),sticker('sticker-28')]),[text('Hello'),sticker(),text(' dear '),sticker('sticker-28'),text('there')])
 assert.deepEqual(replaceMessageRange(parts,0,6,[text('Salut')]),[text('Salut there')])
})
test('backspace counts a PNG as one and preserves compound emoji graphemes',()=>{
 const family='👨‍👩‍👧‍👦',parts=[text('A'+family),sticker(),text('é')]
 assert.equal(previousMessageUnit(parts,1+family.length),1)
 assert.equal(previousMessageUnit(parts,2+family.length),1+family.length)
 assert.deepEqual(replaceMessageRange(parts,1+family.length,2+family.length),[text('A'+family+'é')])
})
test('wire validation permits actual plain text and rejects HTML fields, URLs, unknown ids and mismatched body',()=>{
 assert.deepEqual(validateMessageParts([text(' <script> is text '),sticker()],'<script> is text'),[text(' <script> is text '),sticker()])
 for(const parts of [[{type:'html',html:'<b>x</b>'}],[{type:'sticker',stickerId:'https://example.com/a.png'}],[{type:'sticker',stickerId:'sticker-99'}],[{type:'text',text:12}],[{type:'text',text:'x',html:'x'}],[]])assert.throws(()=>validateMessageParts(parts,'x'),{code:'INVALID_MESSAGE'})
 assert.throws(()=>validateMessageParts([text('real'),sticker()],'other'),{code:'INVALID_MESSAGE'})
})
test('visible length is grapheme text plus one per expression with a 2000 limit',()=>{
 const parts=[text('é'.repeat(1999)),sticker()];assert.equal(messagePartCount(normalizeMessageParts(parts)),2000)
 assert.throws(()=>normalizeMessageParts([...parts,sticker()]),{code:'INVALID_MESSAGE'})
 assert.equal(messagePartCount([text('👩🏽‍🚀')]),1)
 assert.deepEqual(displayMessageParts({body:'old plain message'}),[text('old plain message')])
})
test('mixed text and original expressions persist as one message; failed retry is idempotent',async t=>{
 const r=await make(t),parts=[text('Hi '),sticker('sticker-05'),text(' nice to see you')],payload={peerId:'demo-friend-echo',kind:'text',body:messagePartText(parts),parts,commitId:crypto.randomUUID()}
 await call(r,'social.simulateFailure',{operation:'send'});await assert.rejects(call(r,'social.send',payload),{code:'STORAGE_FAILED'})
 const a=await call(r,'social.send',payload),b=await call(r,'social.send',payload);assert.equal(a.resultId,b.resultId)
 const saved=b.threads.flatMap(x=>x.messages).filter(x=>x.id===a.resultId);assert.equal(saved.length,1);assert.deepEqual(saved[0].parts,parts);assert.equal(saved[0].kind,'text')
 await assert.rejects(call(r,'social.send',{...payload,parts:[text('different')]}),{code:'COMMIT_CONFLICT'})
})
test('expression-only messages use the same send service; old sticker messages remain compatible',async t=>{
 const r=await make(t),a=await call(r,'social.send',{peerId:'demo-friend-echo',kind:'text',body:'',parts:[sticker()],commitId:crypto.randomUUID()})
 assert.deepEqual(a.threads.flatMap(x=>x.messages).find(x=>x.id===a.resultId).parts,[sticker()])
 const b=await call(r,'social.send',{peerId:'demo-friend-echo',kind:'sticker',body:'',stickerId:'sticker-02',commitId:crypto.randomUUID()});assert.equal(b.threads.flatMap(x=>x.messages).find(x=>x.id===b.resultId).stickerId,'sticker-02')
})
test('invalid mixed messages are not saved and block rules still override valid parts',async t=>{
 const r=await make(t),base={peerId:'demo-friend-echo',kind:'text',body:'',parts:[sticker()]}
 await assert.rejects(call(r,'social.send',{...base,kind:'image',commitId:crypto.randomUUID()}),{code:'INVALID_MESSAGE'})
 await assert.rejects(call(r,'social.send',{...base,parts:[{type:'sticker',stickerId:'sticker-99'}],commitId:crypto.randomUUID()}),{code:'INVALID_MESSAGE'})
 await call(r,'social.block',{peerId:base.peerId,blocked:true,commitId:crypto.randomUUID()});await assert.rejects(call(r,'social.send',{...base,commitId:crypto.randomUUID()}),{code:'USER_BLOCKED'})
})

test('legacy seconds and new fractional message times sort chronologically with stable ties',async()=>{
 const {compareSocialMessages}=await import('../src/domain/social.js')
 const rows=[{id:'new-late',createdAt:'2026-10-24T10:00:00.900Z'},{id:'same-b',createdAt:'2026-10-24T10:00:00.100Z'},{id:'legacy',createdAt:'2026-10-24T10:00:00Z'},{id:'same-a',createdAt:'2026-10-24T10:00:00.100Z'}]
 assert.deepEqual(rows.sort(compareSocialMessages).map(x=>x.id),['legacy','same-a','same-b','new-late'])
})

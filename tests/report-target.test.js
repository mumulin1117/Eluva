import test from 'node:test'
import assert from 'node:assert/strict'
import { indexedDB } from 'fake-indexeddb'
import { BrowserRepository } from '../src/services/browser-repository.js'
import { LEGAL_VERSION } from '../src/domain/validation.js'

test('post reports reject author IDs and keep one exact post target on retry',async t=>{
 const repo=new BrowserRepository({indexedDB,dbName:'report-target-'+crypto.randomUUID()});t.after(()=>repo.close())
 await repo.execute('app','bootstrap');await repo.execute('preferences','consent',{accepted:true,version:LEGAL_VERSION})
 await repo.execute('auth','login',{email:'eluva@gmail.com',password:'123qweasd'})
 const snapshot=await repo.execute('content','snapshot'),post=snapshot.posts.find(p=>p.id==='demo-post-female-02-v2')
 const payload={postId:post.id,reason:'spam',details:'Unwanted promotional content.',commitId:crypto.randomUUID()}
 await assert.rejects(repo.execute('content','report',{...payload,postId:post.authorId}),{code:'POST_UNAVAILABLE'})
 const first=await repo.execute('content','report',payload),retry=await repo.execute('content','report',payload)
 assert.equal(first.resultId,retry.resultId)
 const stored=await repo.read(),reports=Object.values(stored.content.reports)
 assert.equal(reports.length,1);assert.equal(reports[0].postId,post.id);assert.equal(reports[0].ownerId,snapshot.ownerId)
 assert.equal(Object.keys(stored.social?.reports||{}).length,0)
 await assert.rejects(repo.execute('content','report',{...payload,postId:snapshot.posts.find(p=>p.id!==post.id).id}),{code:'COMMIT_CONFLICT'})
})

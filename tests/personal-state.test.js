import test from 'node:test'
import assert from 'node:assert/strict'
import { computed,isReactive,nextTick,watch } from 'vue'

// No DOM or storage calls: exercise the same first-open drafts used by both editors.
globalThis.window={}
const {feedbackDraft,collectionDraft,resetPersonal}=await import('../src/personal-state.js')
test('P5 first-open collection covers and feedback inputs remain reactive, including after reset',async()=>{
 for(let i=0;i<2;i++){
  resetPersonal();const collection=collectionDraft(),feedback=feedbackDraft(),photos=computed(()=>collection.cover?[collection.cover]:[]),enabled=computed(()=>!!feedback.body.trim());let changes=0
  const stop=watch([photos,enabled],()=>changes++)
  assert.equal(isReactive(collection),true);assert.equal(isReactive(feedback),true);assert.deepEqual(photos.value,[]);assert.equal(enabled.value,false)
  collection.cover={id:'local-cover'};feedback.body='A local issue';await nextTick();assert.equal(photos.value[0].id,'local-cover');assert.equal(enabled.value,true);assert.equal(changes,1);assert.equal(collectionDraft(),collection);assert.equal(feedbackDraft(),feedback);stop()
 }
})

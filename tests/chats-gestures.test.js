import test from 'node:test'
import assert from 'node:assert/strict'
import { gestureAxis,pullDistance,swipeCategory,chatsScrollPath } from '../src/domain/chats-gestures.js'
import { scrollKey } from '../src/domain/navigation.js'

test('Chats gestures choose a clear axis without turning a vertical pull into paging',()=>{
 assert.equal(gestureAxis(4,6),'')
 assert.equal(gestureAxis(15,80),'vertical')
 assert.equal(gestureAxis(-90,13),'horizontal')
 assert.equal(gestureAxis(10,10),'')
 assert.equal(gestureAxis(60,-8),'horizontal')
 assert.equal(gestureAxis(2,-30),'vertical')
})

test('pull-to-refresh resists distance and arms only after a deliberate downward pull',()=>{
 assert.equal(pullDistance(-200),0)
 assert.ok(pullDistance(100)<56)
 assert.ok(pullDistance(120)>=56)
 assert.equal(pullDistance(800),92)
})

test('Chats paging needs deliberate distance or a real flick and respects both edges',()=>{
 assert.equal(swipeCategory('all',-12,{width:390,elapsed:10}),'all')
 assert.equal(swipeCategory('all',-45,{width:390,elapsed:200}),'all')
 assert.equal(swipeCategory('all',-100,{width:390,elapsed:600}),'following')
 assert.equal(swipeCategory('all',-40,{width:390,elapsed:60}),'following')
 assert.equal(swipeCategory('following',100,{width:320,elapsed:400}),'all')
 assert.equal(swipeCategory('all',150,{width:390}),'all')
 assert.equal(swipeCategory('following',-150,{width:390}),'following')
})

test('All and Follow scroll restoration keys stay separate for every account',()=>{
 const keys=['one','two'].flatMap(owner=>['all','following'].map(category=>scrollKey(chatsScrollPath(category),owner)))
 assert.equal(new Set(keys).size,4)
 assert.equal(chatsScrollPath('lights'),chatsScrollPath('all'))
})

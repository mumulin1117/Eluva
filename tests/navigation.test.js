import test from 'node:test'
import assert from 'node:assert/strict'
import {allowedReturnPath,blockedReturnPath,scrollKey} from '../src/domain/navigation.js'
test('P5 Mine → friends → profile or conversation returns retain the parent query and isolated scroll key',()=>{
 const policy={fallback:'/home',exact:['/mine','/friends','/friend-requests'],prefix:['/profile/','/conversation/']}
 for(const path of ['/friends?from=/mine','/friend-requests?from=/friends?from=/mine','/profile/local-echo?from=/friends?from=/mine'])assert.equal(allowedReturnPath(path,policy),path)
 for(const path of ['//external.example','https://example.com','/friends-extra','/settings',null,['/friends']])assert.equal(allowedReturnPath(path,policy),'/home')
 assert.notEqual(scrollKey('/friends?from=/mine','one'),scrollKey('/friends?from=/mine','two'))
})
test('blocking skips unavailable sources while retaining safe parent queries',()=>{
 const policy={blockedPeerIds:['blocked'],posts:[{id:'safe-post',authorId:'other'}]}
 assert.equal(blockedReturnPath('/friends?from=/mine',policy),'/friends?from=/mine')
 assert.equal(blockedReturnPath('/conversation/blocked?from=/friends',policy),'/chats')
 assert.equal(blockedReturnPath('/conversation/other',policy),'/conversation/other')
 assert.equal(blockedReturnPath('/post/blocked-post?from='+encodeURIComponent('/friend-requests?direction=sent&from=/friends'),policy),'/friend-requests?direction=sent&from=/friends')
 assert.equal(blockedReturnPath('/post/safe-post',policy),'/post/safe-post')
 assert.equal(blockedReturnPath('/profile/blocked?from='+encodeURIComponent('/conversation/blocked'),policy),'/chats')
 for(const value of [null,['/home'],'//outside.example','https://outside.example','/post/unavailable','/profile/%XX'])assert.equal(blockedReturnPath(value,policy),'/home')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { localResource } from '../scripts/resource-reference.mjs'

test('production references detect case errors even on a case-insensitive development volume',()=>{
  const files=new Set(['index.html','assets/app.js','images/profile-photo.png','images/café photo.png','fonts/poppins-regular.ttf'])
  assert.equal(localResource('../images/profile-photo.png','assets/app.css',files),'images/profile-photo.png')
  assert.equal(localResource('/images/caf%C3%A9%20photo.png?v=2','index.html',files),'images/café photo.png')
  assert.equal(localResource('./assets/app.js','index.html',files),'assets/app.js')
  assert.equal(localResource('data:image/svg+xml,test','index.html',files),null)
  assert.equal(localResource('#mask','index.html',files),null)
  for(const path of ['/Images/profile-photo.png','/images/Profile-Photo.png','/images/missing.png','//example.com/a.png','https://example.com/a.png','../../private.png','/%252e%252e/private.png','/images/%ZZ.png','/images/%00.png','/images/a\\b.png']){
    assert.throws(()=>localResource(path,'index.html',files),Error,path)
  }
})

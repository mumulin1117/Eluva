import test from 'node:test'
import assert from 'node:assert/strict'
import { messages, translate } from '../src/i18n.js'
import { choices } from '../src/data/choices.js'
import { legal } from '../src/data/legal.js'
const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key,value]) => typeof value === 'object' ? flatten(value,prefix+key+'.') : [[prefix+key,value]])
test('every interface key, error and interpolation has matching English and French text', () => {
  const en = new Map(flatten(messages.en)), fr = new Map(flatten(messages.fr))
  assert.deepEqual([...en.keys()].sort(), [...fr.keys()].sort())
  for (const [key,value] of en) {
    assert.ok(fr.get(key)?.length, key)
    assert.deepEqual([...value.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(), [...fr.get(key).matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(),key)
    assert.notEqual(translate('fr',key),key)
  }
  for (const group of Object.values(choices)) {
    assert.equal(new Set(group.map(x=>x.id)).size, group.length)
    for (const item of group) assert.ok(item.en && item.fr && item.id)
  }
  assert.deepEqual(Object.keys(legal.en).sort(),Object.keys(legal.fr).sort())
})
test('each locked audience choice has its own translated caption, without exposing a translation key',()=>{
  for(const lang of ['en','fr'])for(const id of ['men','women','excludeMen','excludeWomen'])assert.notEqual(translate(lang,'p2.'+id+'Hint'),'p2.'+id+'Hint')
  assert.notEqual(translate('en','p2.menHint'),translate('en','p2.womenHint'))
})

test('the navigation guide names the same three destinations as the actual tabs',()=>{
  for(const locale of ['en','fr'])for(const key of ['chats','home','mine']){
    assert.ok(translate(locale,'p2.guide3').includes(translate(locale,key)),locale+':'+key)
  }
})

test('all literal UI translation keys resolve in both interface languages',async()=>{
  const {readdir,readFile}=await import('node:fs/promises')
  for(const folder of ['views','components'])for(const file of await readdir(new URL('../src/'+folder+'/',import.meta.url))){
    if(!file.endsWith('.vue'))continue
    const source=await readFile(new URL('../src/'+folder+'/'+file,import.meta.url),'utf8')
    for(const [,key]of source.matchAll(/\bt\(\s*'([A-Za-z][\w.]*)'\s*[,)]/g)){
      for(const locale of ['en','fr'])assert.equal(typeof key.split('.').reduce((node,part)=>node?.[part],messages[locale]),'string',file+':'+key)
    }
  }
})

 test('P3 actual view keys and safety reason captions resolve in both languages', async()=>{
  const {readFile}=await import('node:fs/promises');
  for(const file of ['ChatsView','ProfileView','FriendsView','ConversationView','HelpView']){const source=await readFile(new URL('../src/views/'+file+'.vue',import.meta.url),'utf8');for(const [,key] of source.matchAll(/'(s\.[a-zA-Z][a-zA-Z0-9]*)'/g))for(const locale of ['en','fr'])assert.notEqual(translate(locale,key),key,file+':'+key)}
  for(const id of ['harassment','hate','sexual','violence','spam','impersonation','misinformation'])for(const locale of ['en','fr'])assert.notEqual(translate(locale,'p2.'+id),'p2.'+id)
 })

test('P4 actual media views and controls resolve in both interface languages',async()=>{
 const {readFile}=await import('node:fs/promises')
 for(const [folder,name] of [['views','VideoCallView'],['components','VoiceRecorder'],['components','VoiceMessage'],['components','IncomingVideoBanner']]){
  const source=await readFile(new URL('../src/'+folder+'/'+name+'.vue',import.meta.url),'utf8')
  for(const [,key] of source.matchAll(/'(p4\.[a-zA-Z][a-zA-Z0-9]*)'/g))for(const lang of ['en','fr'])assert.notEqual(translate(lang,key),key,name+':'+key)
 }
})

test('P5 actual account/collection/settings views resolve EN/FR including dynamic settings states',async()=>{
 const {readFile}=await import('node:fs/promises')
 for(const [folder,name]of [['views','MainView'],['views','ProfileEditView'],['views','CollectionsView'],['views','SettingsView'],['views','FeedbackView'],['components','CollectionEditor'],['components','DeletePostDialog']]){
  const source=await readFile(new URL('../src/'+folder+'/'+name+'.vue',import.meta.url),'utf8')
  for(const[,key]of source.matchAll(/'(p5\.[a-zA-Z][a-zA-Z0-9_]*)'/g))if(!key.endsWith('_'))for(const locale of ['en','fr'])assert.notEqual(translate(locale,key),key,name+':'+key)
 }
 for(const prefix of ['notification_','theme_','topic_'])for(const suffix of {notification_:['loading','notDetermined','authorized','provisional','ephemeral','denied','unsupported'],theme_:['pink','purple','orange','cyan'],topic_:['lag','crash','payment','other']}[prefix])for(const locale of ['en','fr'])assert.notEqual(translate(locale,'p5.'+prefix+suffix),'p5.'+prefix+suffix)
})

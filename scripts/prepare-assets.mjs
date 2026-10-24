import { mkdir, writeFile, access, copyFile } from 'node:fs/promises'
import { conversationPolicy } from '../src/data/auth-conversation.js'
import { commercePolicy } from '../src/domain/commerce.js'
import { choices } from '../src/data/choices.js'
import { contentPolicy } from '../src/domain/content.js'
import { contentDemo } from '../src/data/content-demo.js'
import { personalPolicy } from '../src/domain/personal.js'
import { realtimePolicy } from '../src/domain/realtime.js'
import { socialDemo } from '../src/data/social-demo.js'
import { demoFixtureVersion,demoConversations,demoRequestText,presentationFixture } from '../src/data/demo-fixtures.js'
await mkdir('public/config', { recursive: true })
await writeFile('public/config/auth-conversation.json',JSON.stringify(conversationPolicy))
await writeFile('public/config/commerce-policy.json', JSON.stringify(commercePolicy))
await writeFile('public/config/choices.json', JSON.stringify(choices))
await writeFile('public/config/content-policy.json', JSON.stringify(contentPolicy))
await writeFile('public/config/content-demo.json', JSON.stringify(contentDemo))
await writeFile('public/config/social-demo.json', JSON.stringify(socialDemo))
await writeFile('public/config/demo-fixtures.json', JSON.stringify({version:demoFixtureVersion,conversations:demoConversations,requestText:demoRequestText,presentation:presentationFixture}))
await writeFile('public/config/personal-policy.json', JSON.stringify(personalPolicy))
await writeFile('public/config/realtime-policy.json', JSON.stringify(realtimePolicy))
await copyFile('ios/Eluva/Assets.xcassets/launchIcong.imageset/launchIcong@3x.png','public/images/launch-logo.png')
for (const file of ['public/images/auth-background.png','public/images/launch-logo.png','public/images/form-background.png','public/fonts/poppins-regular.ttf','public/fonts/plusjakartasans-variable.ttf','public/fonts/plusjakartasans-extrabold.ttf','public/demo/local-voice.wav']) await access(file)

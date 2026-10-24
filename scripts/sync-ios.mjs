import { mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
const root = resolve('ios/Eluva/Web')
const evidenceRoot = process.env.ELUVA_EVIDENCE_DIR || '.build/evidence'
const current = JSON.parse(await readFile(join(evidenceRoot,'build-manifest.json'),'utf8')).files.map(x=>x.file)
let previous=[]
try { previous=JSON.parse(await readFile(join(root,'.generated-files.json'),'utf8')) } catch { /* first sync */ }
// Web is a generated bundle, never an account-data directory. Remove stale hash assets
// even when an older manifest did not record them; never touch Application Support.
async function generatedFiles(dir,prefix=''){const list=[];try{for(const entry of await readdir(dir,{withFileTypes:true})){const name=join(prefix,entry.name);if(entry.isDirectory())list.push(...await generatedFiles(join(dir,entry.name),name));else if(name!=='.generated-files.json')list.push(name)}}catch(error){if(error.code!=='ENOENT')throw error}return list}
previous=[...new Set([...previous,...await generatedFiles(root)])]
for(const file of previous){const path=resolve(root,file);if(!path.startsWith(root+'/'))throw Error('Unsafe generated asset path');if(!current.includes(file))await rm(path,{force:true})}
await mkdir(root,{recursive:true});await cp('dist',root,{recursive:true});await writeFile(join(root,'.generated-files.json'),JSON.stringify(current))
const imageRoot='ios/Eluva/Assets.xcassets/LaunchBackground.imageset'
await mkdir(imageRoot,{recursive:true});await cp('public/images/auth-background.png',join(imageRoot,'background@2x.png'))
await writeFile(join(imageRoot,'Contents.json'),JSON.stringify({images:[{filename:'background@2x.png',idiom:'universal',scale:'2x'}],info:{version:1,author:'xcode'}}))
await mkdir('ios/Eluva/Assets.xcassets',{recursive:true});await writeFile('ios/Eluva/Assets.xcassets/Contents.json',JSON.stringify({info:{version:1,author:'xcode'}}))
console.log('Synchronized '+current.length+' production resources to iOS')

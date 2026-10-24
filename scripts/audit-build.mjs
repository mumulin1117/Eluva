import { readdir, readFile, writeFile, stat, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { localResource } from './resource-reference.mjs'
async function files(root, prefix = '') { const result = []; for (const entry of await readdir(root, { withFileTypes: true })) { const path = join(prefix, entry.name); if (entry.isDirectory()) result.push(...await files(join(root, entry.name), path)); else result.push(path) } return result }
const paths = await files('dist'), manifest = []
const pathSet = new Set(paths)
if (new Set(paths.map(path => path.toLowerCase())).size !== paths.length) throw Error('Case-colliding bundle paths')
for (const file of paths) {
  const content = await readFile(join('dist',file))
  if (/\.(html|css|js)$/.test(file)) {
    const text = content.toString()
    if (/lanhuapp\.com|lanhu-oss-|alipic\.lanhu|\/Users\/|127\.0\.0\.1:5173|localhost:5173/.test(text)) throw Error('Forbidden production reference: '+file)
    if (/\.(html|css)$/.test(file)) {
      const resources = [...text.matchAll(/(?:src|href)=["']([^"']+)["']|url\(["']?([^"')]+)["']?\)/g)].map(x=>x[1]||x[2])
      for (const resource of resources) localResource(resource,file,pathSet)
    }
    if (file.endsWith('.js')) {
      // Project media literals are relative to the HTML document, not the chunk.
      for (const [,resource] of text.matchAll(/["']((?:\.?\/)?(?:images|fonts|audio|video|config)\/[^"'\\\s]+\.(?:png|jpe?g|webp|svg|ttf|woff2?|wav|m4a|mp4|json))["']/g)) {
        if (resource.includes('${')) continue // Template branches are checked in rendered states.
        localResource(resource,'index.html',pathSet)
      }
    }
  }
  manifest.push({ file, bytes:(await stat(join('dist',file))).size, sha256:createHash('sha256').update(content).digest('hex') })
}
const evidenceRoot = process.env.ELUVA_EVIDENCE_DIR || '.build/evidence'
await mkdir(evidenceRoot,{recursive:true})
await writeFile(join(evidenceRoot,'build-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),files:manifest},null,2)+'\n')
console.log('Production resource audit passed: '+manifest.length+' local files')

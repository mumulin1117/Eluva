import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const root = 'docs/evidence/p1/'
const rows = JSON.parse(await readFile(root + 'final-viewport-checks.json', 'utf8'))
function dimensions(bytes) {
  if (bytes[0] === 137) return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
  let index = 2
  while (index < bytes.length) {
    while (bytes[index] === 255) index++
    const marker = bytes[index++]
    if ([216, 217].includes(marker)) continue
    const length = bytes.readUInt16BE(index); index += 2
    if ([192, 193, 194, 195].includes(marker)) return [bytes.readUInt16BE(index + 3), bytes.readUInt16BE(index + 1)]
    index += length - 2
  }
  throw Error('Missing screenshot dimensions')
}
assert.equal(rows.length, 276)
assert.equal(new Set(rows.map(row => [row.page, row.lang, row.width, row.height].join(':'))).size, 276)
assert.equal(new Set(rows.map(row => row.page)).size, 23)
for (const row of rows) {
  const file = `checked-${row.page}-${row.lang}-${row.width}x${row.height}.jpg`
  const bytes = await readFile(root + file)
  assert.deepEqual(dimensions(bytes), [row.width, row.height], file)
  assert.ok(!row.overflow && row.clipped.length === 0 && row.footerVisible && !row.tabBar, file)
  const expected = ({ 'signup-error': 'WEAK_PASSWORD', 'code-error': 'INVALID_VERIFICATION_CODE', 'reset-code-error': 'INVALID_VERIFICATION_CODE', 'login-error': 'WRONG_PASSWORD' })[row.page] || null
  assert.equal(row.error, expected, file)
  row.bitmap = { width: row.width, height: row.height }
  row.screenshot = file
  row.sha256 = createHash('sha256').update(bytes).digest('hex')
}
const manifest = JSON.parse(await readFile(root + 'build-manifest.json', 'utf8'))
for (const resource of manifest.files) {
  for (const prefix of ['dist/', 'ios/Eluva/Web/', '.build/ios/Build/Products/Debug-iphonesimulator/Eluva.app/Web/', '.build/device/Build/Products/Debug-iphoneos/Eluva.app/Web/']) {
    assert.equal(createHash('sha256').update(await readFile(prefix + resource.file)).digest('hex'), resource.sha256, prefix + resource.file)
  }
}
await writeFile(root + 'final-viewport-checks.json', JSON.stringify(rows, null, 2) + '\n')
console.log(`Evidence audit passed: ${rows.length} screenshots; 23 states; en/fr; 6 viewports; bitmap and CSS dimensions match; ${manifest.files.length} synchronized resources.`)

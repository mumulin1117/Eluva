import { mkdir, readFile, writeFile, cp, rm, readdir, lstat, rename } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, createCipheriv, createDecipheriv, randomBytes, randomInt } from 'node:crypto'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { resourceStringValue, swiftStringExpression } from './swift-string-codec.mjs'

// This is the only H5-to-iOS publication path. The iOS project contains the
// completed package and its matching key source, so Xcode never requires Node.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const iosRoot = join(projectRoot, 'ios/Eluva')
const sourceRoot = join(projectRoot, 'dist')
const packageRoot = join(iosRoot, 'PerceptualEluOpenness')
const packagePath = join(packageRoot, 'resources.eluva')
const keyPath = join(iosRoot, 'MoodAwarenessCoherence.swift')
const keyIdentifiers = { inner: 'tempoCalibration', outer: 'polyphonicLayer', packageSHA256: 'symphonicForm', manifestSHA256: 'pitchInterval', archiveBytes: 'hapticEnvelope' }
const evidenceRoot = resolve(projectRoot, process.env.ELUVA_EVIDENCE_DIR || '.build/evidence')
const limits = { files: 10_000, archive: 512 * 1024 * 1024, encrypted: 256 * 1024 * 1024, manifest: 4 * 1024 * 1024 }
const keyLength = 40
// Only WebViewController's native failure message and retry button need
// pre-registered fonts. H5 keeps its full font set inside the encrypted archive.
const nativeFonts = [
  { file: 'poppins-regular.ttf', license: 'poppins-ofl.txt', name: 'Poppins Regular' },
  { file: 'plusjakartasans-semibold.ttf', license: 'jakarta-ofl.txt', name: 'Plus Jakarta Sans SemiBold' },
]
const hash = value => createHash('sha256').update(value).digest('hex')

function safePath(file) {
  if (typeof file !== 'string' || !file || Buffer.byteLength(file) > 1024 || file.startsWith('/') || /[\\%\x00-\x1f\x7f]/.test(file) || file.split('/').some(part => !part || part === '.' || part === '..')) {
    throw Error('Unsafe production resource path')
  }
  return file
}

async function directoryFiles(directory, prefix = '') {
  const rootInfo = await lstat(directory)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw Error('Resource directory must not be a symlink')
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = safePath(prefix ? `${prefix}/${entry.name}` : entry.name)
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw Error(`Symlink in production resources: ${relative}`)
    if (entry.isDirectory()) files.push(...await directoryFiles(path, relative))
    else if (entry.isFile()) files.push(relative)
    else throw Error(`Unsupported production resource: ${relative}`)
    if (files.length > limits.files) throw Error('Too many production resources')
  }
  return files
}

function randomKey() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let value
  do { value = Array.from({ length: keyLength }, () => alphabet[randomInt(alphabet.length)]).join('') }
  while (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value))
  return value
}

function encrypt(bytes, secret, aad) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret, 'utf8').digest(), nonce)
  cipher.setAAD(aad)
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()])
  return Buffer.concat([nonce, encrypted, cipher.getAuthTag()])
}

function decrypt(combined, secret, aad) {
  if (combined.length < 28) throw Error('Incomplete encrypted resource package')
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret, 'utf8').digest(), combined.subarray(0, 12))
  decipher.setAAD(aad)
  decipher.setAuthTag(combined.subarray(-16))
  return Buffer.concat([decipher.update(combined.subarray(12, -16)), decipher.final()])
}

function validatePackage(packageBytes, keys, manifestBytes, records) {
  if (packageBytes.length > limits.encrypted || packageBytes.length < 72 || hash(packageBytes) !== keys.packageSHA256) throw Error('Resource package hash mismatch')
  const header = packageBytes.subarray(0, 16)
  if (header.subarray(0, 8).toString('ascii') !== 'ELUVA001' || header.readBigUInt64BE(8) !== BigInt(keys.archiveBytes)) throw Error('Resource package header mismatch')
  const inner = decrypt(packageBytes.subarray(16), keys.outer, Buffer.concat([header, Buffer.from([2])]))
  const compressed = decrypt(inner, keys.inner, Buffer.concat([header, Buffer.from([1])]))
  const archive = inflateRawSync(compressed, { maxOutputLength: limits.archive })
  if (archive.length !== keys.archiveBytes || archive.length < 4) throw Error('Resource archive length mismatch')
  const manifestLength = archive.readUInt32BE(0)
  if (manifestLength > limits.manifest || manifestLength !== manifestBytes.length || !archive.subarray(4, 4 + manifestLength).equals(manifestBytes)) throw Error('Resource manifest mismatch')
  if (hash(manifestBytes) !== keys.manifestSHA256) throw Error('Resource manifest hash mismatch')
  let offset = 4 + manifestLength
  for (const record of records) {
    const bytes = archive.subarray(offset, offset + record.bytes)
    if (bytes.length !== record.bytes || hash(bytes) !== record.sha256) throw Error(`Resource verification failed: ${record.file}`)
    offset += record.bytes
  }
  if (offset !== archive.length) throw Error('Unexpected trailing resource data')
  return { compressedBytes: compressed.length }
}

function readKeySource(source) {
  const result = {}
  for (const name of ['inner', 'outer', 'packageSHA256', 'manifestSHA256']) {
    const match = source.match(new RegExp(`static let ${keyIdentifiers[name]} = ([^\\r\\n]+)`))
    if (!match) throw Error('Incomplete generated resource key source')
    result[name] = resourceStringValue(match[1].trim())
  }
  const bytes = source.match(new RegExp(`static let ${keyIdentifiers.archiveBytes} = ([0-9]+)`))
  if (!bytes) throw Error('Missing resource archive size')
  result.archiveBytes = Number(bytes[1])
  if (!Number.isSafeInteger(result.archiveBytes) || result.archiveBytes < 4 || result.archiveBytes > limits.archive || !/^[a-f0-9]{64}$/.test(result.packageSHA256) || !/^[a-f0-9]{64}$/.test(result.manifestSHA256)) throw Error('Invalid generated resource metadata')
  if (![result.inner, result.outer].every(value => value.length === keyLength && /[A-Za-z]/.test(value) && /[0-9]/.test(value)) || result.inner === result.outer) throw Error('Invalid generated resource keys')
  return result
}

function swiftSource(keys) {
  return `enum visualCoherence {\n    static let ${keyIdentifiers.inner} = ${swiftStringExpression(keys.inner)}\n    static let ${keyIdentifiers.outer} = ${swiftStringExpression(keys.outer)}\n    static let ${keyIdentifiers.packageSHA256} = ${swiftStringExpression(keys.packageSHA256)}\n    static let ${keyIdentifiers.manifestSHA256} = ${swiftStringExpression(keys.manifestSHA256)}\n    static let ${keyIdentifiers.archiveBytes} = ${keys.archiveBytes}\n}\n`
}

async function removeLegacyGeneratedWeb() {
  const legacy = join(iosRoot, 'Web')
  let info
  try { info = await lstat(legacy) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Refusing to remove a non-generated Web directory')
  const generated = JSON.parse(await readFile(join(legacy, '.generated-files.json'), 'utf8'))
  if (!Array.isArray(generated)) throw Error('Invalid legacy generated resource manifest')
  const expected = new Set(generated.map(safePath))
  expected.add('.generated-files.json')
  if ((await directoryFiles(legacy)).some(file => !expected.has(file))) throw Error('Legacy Web contains unrecognized files; preserve them before migration')
  await rm(legacy, { recursive: true })
}

const audit = JSON.parse(await readFile(join(evidenceRoot, 'build-manifest.json'), 'utf8'))
if (!Array.isArray(audit.files) || !audit.files.length || audit.files.length > limits.files) throw Error('Invalid production build manifest')
const records = audit.files.map(record => {
  safePath(record.file)
  if (!Number.isSafeInteger(record.bytes) || record.bytes < 0 || !/^[a-f0-9]{64}$/.test(record.sha256)) throw Error('Invalid production resource metadata')
  return { file: record.file, bytes: record.bytes, sha256: record.sha256 }
}).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)
if (new Set(records.map(record => record.file.normalize('NFC').toLowerCase())).size !== records.length) throw Error('Case-colliding production resource paths')
const actual = (await directoryFiles(sourceRoot)).sort()
if (JSON.stringify(actual) !== JSON.stringify(records.map(record => record.file))) throw Error('Production build changed after audit')
if (!actual.includes('index.html')) throw Error('Production entry page is missing')
const manifestBytes = Buffer.from(JSON.stringify({ version: 1, files: records }), 'utf8')
if (manifestBytes.length > limits.manifest) throw Error('Resource manifest exceeds size limit')
const archiveBytes = 4 + manifestBytes.length + records.reduce((total, record) => total + record.bytes, 0)
if (!Number.isSafeInteger(archiveBytes) || archiveBytes > limits.archive) throw Error('Resource archive exceeds size limit')
const contents = []
for (const record of records) {
  const path = join(sourceRoot, record.file)
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink()) throw Error(`Production resource is not a regular file: ${record.file}`)
  const bytes = await readFile(path)
  if (bytes.length !== record.bytes || hash(bytes) !== record.sha256) throw Error(`Production resource changed after audit: ${record.file}`)
  contents.push(bytes)
}

let keys, packageBytes, verification, reused = false
try {
  keys = readKeySource(await readFile(keyPath, 'utf8'))
  if (keys.manifestSHA256 !== hash(manifestBytes) || keys.archiveBytes !== archiveBytes) throw Error('Resource content changed')
  packageBytes = await readFile(packagePath)
  verification = validatePackage(packageBytes, keys, manifestBytes, records)
  reused = true
} catch {
  keys = { inner: randomKey(), outer: randomKey(), manifestSHA256: hash(manifestBytes), archiveBytes }
  while (keys.outer === keys.inner) keys.outer = randomKey()
  const manifestLength = Buffer.alloc(4)
  manifestLength.writeUInt32BE(manifestBytes.length)
  const compressed = deflateRawSync(Buffer.concat([manifestLength, manifestBytes, ...contents], archiveBytes), { level: 9 })
  const header = Buffer.alloc(16)
  header.write('ELUVA001', 0, 'ascii')
  header.writeBigUInt64BE(BigInt(archiveBytes), 8)
  const inner = encrypt(compressed, keys.inner, Buffer.concat([header, Buffer.from([1])]))
  packageBytes = Buffer.concat([header, encrypt(inner, keys.outer, Buffer.concat([header, Buffer.from([2])]))])
  keys.packageSHA256 = hash(packageBytes)
  verification = validatePackage(packageBytes, keys, manifestBytes, records)
}

await mkdir(packageRoot, { recursive: true })
const staging = join(iosRoot, `.resource-sync-${process.pid}-${randomBytes(6).toString('hex')}`)
await mkdir(staging)
try {
  await mkdir(join(staging, 'NativeFonts'))
  let notices = 'Third-party notices for native fonts\n\n'
  for (const font of nativeFonts) {
    await cp(join(sourceRoot, 'fonts', font.file), join(staging, 'NativeFonts', font.file))
    // Keep each source notice complete, including its copyright and OFL text.
    notices += `=== ${font.name} ===\n\n${await readFile(join(sourceRoot, 'fonts', font.license), 'utf8')}\n`
  }
  await writeFile(join(staging, 'ThirdPartyNotices.txt'), notices)
  if (!reused) {
    await writeFile(join(staging, 'resources.eluva'), packageBytes)
    await writeFile(join(staging, 'MoodAwarenessCoherence.swift'), swiftSource(keys))
    // Each rename is atomic. If interrupted between the two, the embedded hash
    // fails closed, and the next build regenerates the mismatched pair.
    await rename(join(staging, 'resources.eluva'), packagePath)
    await rename(join(staging, 'MoodAwarenessCoherence.swift'), keyPath)
  }
  await mkdir(join(iosRoot, 'Licenses'), { recursive: true })
  await rename(join(staging, 'ThirdPartyNotices.txt'), join(iosRoot, 'Licenses', 'ThirdPartyNotices.txt'))
  await rm(join(iosRoot, 'NativeFonts'), { recursive: true, force: true })
  await rename(join(staging, 'NativeFonts'), join(iosRoot, 'NativeFonts'))
  const imageRoot = join(iosRoot, 'Assets.xcassets/LaunchBackground.imageset')
  await mkdir(imageRoot, { recursive: true })
  await cp(join(projectRoot, 'public/images/auth-background.png'), join(imageRoot, 'background@2x.png'))
  await writeFile(join(imageRoot, 'Contents.json'), JSON.stringify({ images: [{ filename: 'background@2x.png', idiom: 'universal', scale: '2x' }], info: { version: 1, author: 'xcode' } }))
  await writeFile(join(iosRoot, 'Assets.xcassets/Contents.json'), JSON.stringify({ info: { version: 1, author: 'xcode' } }))
  await removeLegacyGeneratedWeb()
  await mkdir(evidenceRoot, { recursive: true })
  await writeFile(join(evidenceRoot, 'resource-package.json'), JSON.stringify({
    format: 'ELUVA001', compression: 'raw-deflate', encryption: ['AES-256-GCM', 'AES-256-GCM'],
    keyLength, independentKeys: true, files: records.length,
    sourceBytes: records.reduce((total, record) => total + record.bytes, 0), manifestBytes: manifestBytes.length,
    archiveBytes, compressedBytes: verification.compressedBytes, packageBytes: packageBytes.length,
    packageSHA256: keys.packageSHA256, manifestSHA256: keys.manifestSHA256,
    verified: true, reused, createdAt: new Date().toISOString(),
  }, null, 2) + '\n')
} finally {
  await rm(staging, { recursive: true, force: true })
}
console.log(`Synchronized ${records.length} production resources into PerceptualEluOpenness (${packageBytes.length} encrypted bytes; ${reused ? 'verified existing package' : 'new package'})`)

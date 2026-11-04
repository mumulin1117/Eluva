import assert from 'node:assert/strict'
import { readFile, readdir, writeFile, mkdtemp, rm, mkdir, cp } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { interleaveString, restoreString, swiftStringExpression, resourceStringValue } from './swift-string-codec.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const nativeRoot = join(root, 'ios/Eluva')
const samples = ['', 'Eluva', 'Réessayer', 'e\u0301', '\u0301a', '👩🏽‍💻🇫🇷', '\u0000\n\r\t\\"', '#"\\(value)"#', '𠮷𐐀', '\r\n']
for (let code = 0; code < 128; code++) samples.push(String.fromCodePoint(code))
for (let index = 0; index < 256; index++) samples.push(samples[index % samples.length] + String.fromCodePoint(0x10000 + index * 101))
for (const value of samples) assert.equal(restoreString(interleaveString(value)), value)
const variants = new Set(Array.from({ length: 16 }, () => interleaveString('Eluva')))
assert(variants.size > 1, 'Filler characters must vary')
assert.equal(resourceStringValue(swiftStringExpression('abcXYZ0123456789')), 'abcXYZ0123456789')
assert.equal(resourceStringValue('"abcXYZ0123456789"'), 'abcXYZ0123456789')
assert.throws(() => resourceStringValue('LemanticEquivalence.resonantInterval("abc")'))
assert.throws(() => resourceStringValue('unrelated("abc")'))

const baseline = process.argv[2] ? JSON.parse(await readFile(resolve(process.argv[2]), 'utf8')) : null
const expectedByPayload = new Map(baseline?.map(row => [row.encoded, row.value]))
const nativeCases = []
for (const file of (await readdir(nativeRoot)).filter(name => name.endsWith('.swift')).sort()) {
  const source = await readFile(join(nativeRoot, file), 'utf8')
  const calls = source.matchAll(/LemanticEquivalence\.(?:eluva)?resonantInterval\("(?:[^"\\]|\\.)*"\)/g)
  for (const call of calls) {
    // Decode the Swift literal by compiling the exact source below. JSON is
    // only used for the baseline, never to interpret Swift escape sequences.
    nativeCases.push({ file, expression: call[0] })
  }
}
assert(nativeCases.length > 0, 'Native decoder expressions must be covered')
if (baseline) assert.equal(nativeCases.length, baseline.length, 'Native coverage changed')

function declaration(source, marker) {
  const start = source.indexOf(marker)
  assert(start >= 0, `Missing ${marker}`)
  const open = source.indexOf('{', start)
  let depth = 1, end = open + 1
  while (depth && end < source.length) {
    if (source[end] === '{') depth++
    if (source[end] === '}') depth--
    end++
  }
  assert.equal(depth, 0)
  return source.slice(start, end)
}

const webSource = await readFile(join(nativeRoot, 'ElunostalgiaSpectrumer.swift'), 'utf8')
const packageSource = await readFile(join(nativeRoot, 'CognitiveFlexibility.swift'), 'utf8')
const codecSource = await readFile(join(nativeRoot, 'ValenceCurve.swift'), 'utf8')
const nativeDeclarations = [
  declaration(codecSource, 'enum LemanticEquivalence'),
  declaration(webSource, 'enum delightContinuity:'),
  declaration(webSource, 'enum wonderSequence:'),
  declaration(packageSource, 'private struct spatialAwareness:').replace(/^private /, ''),
  declaration(packageSource, 'private struct kinestheticFluency:').replace(/^private /, ''),
].join('\n')
const directory = await mkdtemp(join(tmpdir(), 'eluva-string-tests-'))
try {
  const fixtures = baseline ?? []
  const data = {
    fixtures,
    samples,
    states: ['covering', 'revealing', 'visible', 'failed'],
    destinations: ['welcome', 'home', 'other'],
    manifest: { version: 1, files: [{ file: 'images/écho.png', bytes: 42, sha256: 'abc123' }] },
  }
  const checks = nativeCases.map((row, index) => `check(${row.expression}, at: ${index})`).join('\n')
  const sampleChecks = samples.map((value, index) => `expect(${swiftStringExpression(value)}, samples[${index}])`).join('\n')
  const main = `import Foundation
${nativeDeclarations}
let input = try JSONSerialization.jsonObject(with: FileHandle.standardInput.readDataToEndOfFile()) as! [String: Any]
let fixtures = input["fixtures"] as! [[String: Any]]
let samples = input["samples"] as! [String]
func expect(_ actual: String, _ expected: String) {
    precondition(Array(actual.utf8) == Array(expected.utf8), "UTF-8 value changed")
}
var checked = 0
func check(_ value: String, at index: Int) {
    if !fixtures.isEmpty {
        let expected = fixtures[index]["value"] as! String
        expect(value, expected)
    }
    checked += 1
}
${checks}
${sampleChecks}
let states = input["states"] as! [String]
let destinations = input["destinations"] as! [String]
let stateCases: [delightContinuity] = [.belongingRitual, .poeticDevice, .preferenceHierarchy, .coherenceScope]
let destinationCases: [wonderSequence] = [.interoceptiveAwareness, .rapportCalibration, .reminiscenceContour]
for (index, value) in stateCases.enumerated() { expect(value.rawValue, states[index]); precondition(delightContinuity(rawValue: states[index]) == value) }
for (index, value) in destinationCases.enumerated() { expect(value.rawValue, destinations[index]); precondition(wonderSequence(rawValue: destinations[index]) == value) }
precondition(delightContinuity(rawValue: "unknown") == nil && wonderSequence(rawValue: "unknown") == nil)
let manifest = try JSONSerialization.data(withJSONObject: input["manifest"]!)
let decoded = try JSONDecoder().decode(spatialAwareness.self, from: manifest)
precondition(decoded.lightnessScale == 1 && decoded.harmonicStructure.count == 1)
let file = decoded.harmonicStructure[0]
expect(file.frequencyContour, "images/écho.png")
precondition(file.tactileWarmth == 42)
expect(file.chordResolution, "abc123")
print("Validated \\(checked) native expressions, \\(samples.count) Unicode/escape cases, enum raw values and resource manifest decoding")
`
  // The baseline is emitted in syntax traversal order; source order differs
  // only for strings nested in interpolation. Match by exact encoded payload
  // and compile a payload-reading pass to build the ordered expectations.
  const payloadMain = 'import Foundation\nvar values: [String] = []\n' + nativeCases.map(row => `values.append(${row.expression.replace(/^LemanticEquivalence\.(?:eluva)?resonantInterval\(/, '').slice(0, -1)})`).join('\n') + '\nFileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: values))\n'
  const payloadPath = join(directory, 'payload.swift')
  const payloadBinary = join(directory, 'payloads')
  await writeFile(payloadPath, payloadMain)
  function run(command, args, options = {}) {
    const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    return result.stdout
  }
  run('xcrun', ['swiftc', '-module-cache-path', join(directory, 'cache'), payloadPath, '-o', payloadBinary])
  const payloads = JSON.parse(run(payloadBinary, []))
  data.fixtures = payloads.map(payload => {
    if (baseline) assert(expectedByPayload.has(payload), 'An expression is missing from the original inventory')
    assert.equal(Array.from(payload).length % 2, 0, 'Incomplete encoded scalar pair')
    return { encoded: payload, value: baseline ? expectedByPayload.get(payload) : restoreString(payload) }
  })
  const mainPath = join(directory, 'main.swift')
  await writeFile(mainPath, main)
  const binary = join(directory, 'checks')
  run('xcrun', ['swiftc', '-module-cache-path', join(directory, 'cache'), mainPath, '-o', binary])
  process.stdout.write(run(binary, [], { input: JSON.stringify(data) }))

  // Exercise both fresh generation and package reuse in an isolated, minimal
  // resource tree. No application resources or existing user data are changed.
  const fixtureRoot = join(directory, 'resource-pipeline')
  const evidence = join(fixtureRoot, '.build/evidence')
  await mkdir(join(fixtureRoot, 'scripts'), { recursive: true })
  await mkdir(join(fixtureRoot, 'dist/fonts'), { recursive: true })
  await mkdir(join(fixtureRoot, 'public/images'), { recursive: true })
  await mkdir(evidence, { recursive: true })
  for (const name of ['sync-ios.mjs', 'swift-string-codec.mjs']) await cp(join(root, 'scripts', name), join(fixtureRoot, 'scripts', name))
  const resourceFiles = {
    'index.html': '<!doctype html><html lang="en"><title>Eluva</title></html>',
    'fonts/poppins-regular.ttf': 'isolated font fixture',
    'fonts/poppins-ofl.txt': 'isolated license fixture',
    'fonts/plusjakartasans-semibold.ttf': 'isolated font fixture',
    'fonts/jakarta-ofl.txt': 'isolated license fixture',
  }
  const records = []
  for (const [file, value] of Object.entries(resourceFiles)) {
    const bytes = Buffer.from(value)
    await writeFile(join(fixtureRoot, 'dist', file), bytes)
    records.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  await writeFile(join(fixtureRoot, 'public/images/auth-background.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tWQAAAAASUVORK5CYII=', 'base64'))
  await writeFile(join(evidence, 'build-manifest.json'), JSON.stringify({ files: records }))
  const sync = () => run(process.execPath, [join(fixtureRoot, 'scripts/sync-ios.mjs')], { env: { ...process.env, ELUVA_EVIDENCE_DIR: evidence } })
  sync()
  const generatedSource = await readFile(join(fixtureRoot, 'ios/Eluva/MoodAwarenessCoherence.swift'), 'utf8')
  assert.equal([...generatedSource.matchAll(/= LemanticEquivalence\.eluvaresonantInterval\("[A-Za-z0-9]+"\)/g)].length, 4)
  const firstPackage = JSON.parse(await readFile(join(evidence, 'resource-package.json'), 'utf8'))
  assert.equal(firstPackage.reused, false)
  sync()
  const secondPackage = JSON.parse(await readFile(join(evidence, 'resource-package.json'), 'utf8'))
  assert.equal(secondPackage.reused, true)
  assert.equal(secondPackage.packageSHA256, firstPackage.packageSHA256)
  assert.equal(await readFile(join(fixtureRoot, 'ios/Eluva/MoodAwarenessCoherence.swift'), 'utf8'), generatedSource)
  process.stdout.write('Validated fresh resource-key generation and verified package reuse\n')
} finally {
  await rm(directory, { recursive: true, force: true })
}

import { randomInt } from 'node:crypto'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const swiftDecoder = 'LemanticEquivalence.eluvaresonantInterval'

// Array.from iterates Unicode scalars, matching the native decoder. Do not
// iterate UTF-16 code units: that would split supplementary-plane characters.
export function interleaveString(value) {
  return Array.from(value, scalar => scalar + alphabet[randomInt(alphabet.length)]).join('')
}

export function restoreString(value) {
  return Array.from(value).filter((_, index) => index % 2 === 0).join('')
}

export function swiftStringExpression(value) {
  const literal = Array.from(interleaveString(value), scalar => {
    const code = scalar.codePointAt(0)
    if (scalar === '"' || scalar === '\\') return '\\' + scalar
    return code >= 32 && code <= 126 ? scalar : `\\u{${code.toString(16)}}`
  }).join('')
  return `${swiftDecoder}("${literal}")`
}

// Resource keys and hashes use only ASCII letters and digits. Support the
// previous literal format so an older matching package can be reused safely.
export function resourceStringValue(expression) {
  const encoded = expression.match(/^LemanticEquivalence\.(?:eluva)?resonantInterval\("([A-Za-z0-9]+)"\)$/)
  if (encoded) {
    if (encoded[1].length % 2 !== 0) throw Error('Incomplete interleaved resource string')
    return restoreString(encoded[1])
  }
  const legacy = expression.match(/^"([A-Za-z0-9]+)"$/)
  if (legacy) return legacy[1]
  throw Error('Invalid generated resource string expression')
}

import { posix } from 'node:path'

// Compare canonical references with the enumerated bundle, rather than fs.access:
// a case-insensitive development volume can otherwise hide a broken iOS URL.
export function localResource(reference, source, files) {
  if (reference.startsWith('data:') || reference.startsWith('#')) return null
  if (reference.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(reference)) throw Error('Remote resource: ' + reference)
  let pathname
  try { pathname = decodeURIComponent(reference.split(/[?#]/)[0]) }
  catch { throw Error('Invalid resource encoding: ' + reference) }
  if (!pathname || /[\\\0%]/.test(pathname)) throw Error('Invalid resource path: ' + reference)
  const resolved = posix.normalize(pathname.startsWith('/') ? pathname.slice(1) : posix.join(posix.dirname(source), pathname))
  if (resolved === '..' || resolved.startsWith('../') || posix.isAbsolute(resolved)) throw Error('Resource escapes bundle: ' + reference)
  if (!files.has(resolved)) throw Error('Missing or case-mismatched resource: ' + source + ' → ' + reference)
  return resolved
}

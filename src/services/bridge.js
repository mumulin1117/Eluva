import { AppError } from '../domain/errors.js'
import { newId } from '../domain/id.js'

export class NativeBridge {
  constructor({ host = globalThis, adapter = null, timeout = 20000 } = {}) {
    this.host = host; this.adapter = adapter; this.timeout = timeout; this.pending = new Map()
    this.isNative = !!host.webkit?.messageHandlers?.eluva
    if (this.isNative) host.__eluvaReceive = response => this.receive(response)
  }
  receive(response) {
    const entry = this.pending.get(response?.requestId)
    if (!entry) return
    if (response.ok === true) entry.finish(null, response.data)
    else entry.finish(new AppError(response.error?.code || 'NATIVE_FAILED'))
  }
  call(service, method, params = {}, { signal, timeout = this.timeout } = {}) {
    if (signal?.aborted) return Promise.reject(new AppError('CANCELLED'))
    const requestId = newId()
    const operation = new AbortController()
    return new Promise((resolve, reject) => {
      const finish = (error, value) => {
        if (!this.pending.has(requestId)) return
        clearTimeout(timer); signal?.removeEventListener('abort', abort); this.pending.delete(requestId)
        if (error) reject(error); else resolve(value)
      }
      const cancel = code => { operation.abort(); if (this.isNative) this.host.webkit.messageHandlers.eluva.postMessage({ v: 1, requestId: newId(), service: 'system', method: 'cancel', params: { requestId } }); finish(new AppError(code)) }
      const abort = () => cancel('CANCELLED')
      const timer = setTimeout(() => cancel('TIMEOUT'), timeout)
      this.pending.set(requestId, { finish, abort }); signal?.addEventListener('abort', abort, { once: true })
      if (this.isNative) {
        try { this.host.webkit.messageHandlers.eluva.postMessage({ v: 1, requestId, service, method, params }) } catch { finish(new AppError('NATIVE_FAILED')) }
      } else if (this.adapter) Promise.resolve().then(() => this.adapter.execute(service, method, params, { signal: operation.signal })).then(value => finish(null, value), error => finish(error))
      else finish(new AppError('DEVICE_UNSUPPORTED'))
    })
  }
  dispose() { for (const entry of [...this.pending.values()]) entry.abort(); this.adapter?.close?.() }
}

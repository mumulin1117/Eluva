export class AppError extends Error {
  constructor(code, detail = '') { super(code); this.name = 'AppError'; this.code = code; this.detail = detail }
}
export function invariant(condition, code) { if (!condition) throw new AppError(code) }
export function asAppError(error) {
  if (error?.code && typeof error.code === 'string') return error
  return new AppError(error?.name === 'AbortError' ? 'CANCELLED' : 'STORAGE_FAILED')
}

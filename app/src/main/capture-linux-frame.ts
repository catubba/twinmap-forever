export const HEADER_BYTES = 24
export const TOP_ROWS = 129

export type FrameLayout = {
  width: number
  height: number
  topRows: number
  top: number
  bottom: number
  left: number
  right: number
  snapshot: number
  length: number
}

export function frameLayout(width: number, height: number, topRows: number): FrameLayout | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 16384 || height > 16384 || topRows !== Math.min(height, TOP_ROWS)) return null
  const top = HEADER_BYTES
  const bottom = top + topRows * width * 4
  const left = bottom + width * 4
  const right = left + height * 4
  const snapshot = right + height * 4
  const length = snapshot + height * width * 4
  if (!Number.isSafeInteger(length)) return null
  return { width, height, topRows, top, bottom, left, right, snapshot, length }
}

export type HelperMessage =
  | { layout: { width: number; height: number; topRows: number } }
  | { token: string | null }
  | { state: 'cancelled' | 'refused' | 'closed' | 'unsupported'; why?: string }

function hasKeys(value: object, keys: string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every(key => actual.includes(key))
}

export function parseHelperLine(line: string): HelperMessage | null {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const message = value as Record<string, unknown>
  if (hasKeys(message, ['layout'])) {
    const layout = message.layout
    if (typeof layout !== 'object' || layout === null || Array.isArray(layout) || !hasKeys(layout, ['width', 'height', 'topRows'])) return null
    const { width, height, topRows } = layout as Record<string, unknown>
    if (typeof width !== 'number' || typeof height !== 'number' || typeof topRows !== 'number' || !frameLayout(width, height, topRows)) return null
    return { layout: { width, height, topRows } }
  }
  if (hasKeys(message, ['token'])) {
    const token = message.token
    return token === null || (typeof token === 'string' && /^[\x21-\x7e]{1,512}$/.test(token)) ? { token } : null
  }
  const { state, why } = message
  if ((hasKeys(message, ['state']) || hasKeys(message, ['state', 'why'])) && (state === 'cancelled' || state === 'refused' || state === 'closed' || state === 'unsupported') && (!('why' in message) || typeof why === 'string')) {
    return typeof why === 'string' ? { state, why } : { state }
  }
  return null
}

export function inFrame(layout: { width: number; height: number }, x: number, y: number, width: number, height: number): boolean {
  return [x, y, width, height].every(Number.isInteger) && x >= 0 && y >= 0 && width >= 1 && height >= 1 && x + width <= layout.width && y + height <= layout.height
}

export function readHeader(b: Buffer): { frames: number; session: number; lastFrameMs: number; width: number; height: number } {
  return { frames: b.readUInt32LE(0), session: b.readUInt32LE(4), lastFrameMs: Number(b.readBigUInt64LE(8)), width: b.readUInt32LE(16), height: b.readUInt32LE(20) }
}

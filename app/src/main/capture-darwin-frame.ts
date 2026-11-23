import { decodeRow } from '../shared/strip'
import type { Rect } from '../shared/window'

export type WindowRecord = {
  id: number
  pid: number
  bounds: Rect
  layer: number
  onScreen: boolean
  title: string | null
}

/** CoreGraphics omits the title without permission and the on-screen key when the window is hidden. */
export function windowRecord(values: {
  id: number | null
  pid: number | null
  bounds: Rect | null
  layer: number | null
  onScreen?: boolean
  title?: string | null
}): WindowRecord | null {
  const { id, pid, bounds, layer, onScreen = false, title = null } = values
  if (!id || !pid || !bounds || layer === null || bounds.width <= 0 || bounds.height <= 0) return null
  return { id, pid, bounds, layer, onScreen, title }
}

export const FOREVER_PROGRAM = /\/_forever_\/World of Warcraft\.app\/Contents\/MacOS\/World of Warcraft$/

/** AppKit gives the standard title bar in points. A checked strip tells us exactly where the game
 * starts even if it uses a different title bar or a borderless window. */
export function contentTop(
  frame: { height: number; scale: number; titleBar: number },
  row: (y: number) => Buffer,
): { top: number; confirmed: boolean } {
  const expected = Math.min(frame.height - 1, Math.round(frame.titleBar * frame.scale))
  const last = Math.min(frame.height - 1, Math.max(expected, Math.ceil(64 * frame.scale)))
  for (const y of [expected, ...Array.from({ length: last + 1 }, (_, y) => y)]) {
    if (decodeRow(row(y)).kind === 'block') return { top: y, confirmed: true }
  }
  return { top: expected, confirmed: false }
}

export function inContent(frame: { width: number; height: number; top: number }, x: number, y: number, width: number, height: number): boolean {
  return [x, y, width, height].every(Number.isSafeInteger) && x >= 0 && y >= 0 && width > 0 && height > 0
    && x + width <= frame.width && y + height <= frame.height - frame.top
}

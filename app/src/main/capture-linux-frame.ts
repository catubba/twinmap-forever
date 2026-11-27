import { posix } from 'node:path'
import type { Rect } from '../shared/window'

const FOREVER_PROGRAM = /(?:^|[\\/])_forever_[\\/]Wow\.exe$/i
const FOREVER_FOLDER = /(?:^|[\\/])_forever_(?:[\\/]|$)/i
const WINE_LOADER = /(?:^|[\\/])(?:wine|wine64|wine-preloader|wine64-preloader|proton)$/i

// X11 setup bytes are copied once from XCB; traversal uses no native structs.
export function parseSetup(bytes: Buffer, screen: number): {
  root: number; rootVisual: number; rootDepth: number; imageByteOrder: number
  formatsByDepth: Map<number, { bits: number; pad: number }>
  visualsById: Map<number, { depth: number; trueColor: boolean }>
} {
  const requireBytes = (offset: number, length: number): void => {
    if (offset + length > bytes.length) throw new Error('the X11 setup is truncated')
  }
  requireBytes(0, 40)
  requireBytes(0, 8 + 4 * bytes.readUInt16LE(6))
  if (!Number.isInteger(screen) || screen < 0 || screen >= bytes[28]!) throw new Error('the X11 display has no screen')
  const formatsByDepth = new Map<number, { bits: number; pad: number }>()
  const visualsById = new Map<number, { depth: number; trueColor: boolean }>()
  const vendorLength = bytes.readUInt16LE(24)
  let offset = 40 + Math.ceil(vendorLength / 4) * 4
  requireBytes(40, offset - 40)
  for (let i = 0; i < bytes[29]!; i++, offset += 8) {
    requireBytes(offset, 8)
    formatsByDepth.set(bytes[offset]!, { bits: bytes[offset + 1]!, pad: bytes[offset + 2]! })
  }
  let root = 0, rootVisual = 0, rootDepth = 0
  for (let i = 0; i < bytes[28]!; i++) {
    requireBytes(offset, 40)
    if (i === screen) {
      root = bytes.readUInt32LE(offset)
      rootVisual = bytes.readUInt32LE(offset + 32)
      rootDepth = bytes[offset + 38]!
    }
    const depthCount = bytes[offset + 39]!
    offset += 40
    for (let j = 0; j < depthCount; j++) {
      requireBytes(offset, 8)
      const depth = bytes[offset]!, visualCount = bytes.readUInt16LE(offset + 2)
      offset += 8
      requireBytes(offset, visualCount * 24)
      for (let k = 0; k < visualCount; k++, offset += 24) {
        if (i === screen) visualsById.set(bytes.readUInt32LE(offset), {
          depth, trueColor: bytes[offset + 4] === 4 && bytes.readUInt32LE(offset + 8) === 0xff0000
            && bytes.readUInt32LE(offset + 12) === 0xff00 && bytes.readUInt32LE(offset + 16) === 0xff,
        })
      }
    }
  }
  return { root, rootVisual, rootDepth, imageByteOrder: bytes[30]!, formatsByDepth, visualsById }
}

export function commandLine(bytes: Buffer): string[] {
  return bytes.toString('utf8').split('\0').filter(Boolean).map((arg) => arg.replace(/^"(.*)"$/, '$1'))
}

export function clientPidFrom(reply: Buffer): number | null {
  if (reply.length < 32 || reply[0] !== 1 || reply.readUInt32LE(4) * 4 !== reply.length - 32) return null
  const count = reply.readUInt32LE(8)
  let offset = 32, pid: number | null = null
  for (let i = 0; i < count; i++) {
    if (offset + 12 > reply.length) return null
    const mask = reply.readUInt32LE(offset + 4), length = reply.readUInt32LE(offset + 8)
    offset += 12
    if (length % 4 || length > reply.length - offset) return null
    if (pid === null && (mask & 2) && length >= 4) {
      const value = reply.readUInt32LE(offset)
      if (!value || value > 0x7fffffff) return null
      pid = value
    }
    offset += length
  }
  return offset === reply.length ? pid : null
}

// RandR 1.5 records have a variable-length output list after each monitor.
export function monitorsFrom(reply: Buffer): Rect[] {
  if (reply.length < 32 || reply[0] !== 1 || reply.readUInt32LE(4) * 4 !== reply.length - 32) return []
  const count = reply.readUInt32LE(12), outputs = reply.readUInt32LE(16)
  const monitors: Rect[] = []
  let offset = 32, seenOutputs = 0
  for (let i = 0; i < count; i++) {
    if (offset + 24 > reply.length) return []
    const nOutput = reply.readUInt16LE(offset + 6)
    const monitor = {
      x: reply.readInt16LE(offset + 8), y: reply.readInt16LE(offset + 10),
      width: reply.readUInt16LE(offset + 12), height: reply.readUInt16LE(offset + 14),
    }
    offset += 24
    if (!monitor.width || !monitor.height || nOutput * 4 > reply.length - offset) return []
    monitors.push(monitor)
    seenOutputs += nOutput
    offset += nOutput * 4
  }
  return offset === reply.length && seenOutputs === outputs ? monitors : []
}

export function programFrom(args: string[], executable: string | null): string | null {
  const first = args[0] ?? executable
  const index = first && WINE_LOADER.test(first) ? 1 : 0
  let program = args[index] ?? (index === 0 ? executable : null)
  if (program && !/\.exe$/i.test(program) && /^[a-z]:[\\/]/i.test(program)) {
    for (let i = index + 1; i < args.length && i < index + 16; i++) {
      if (/^(?:-.|\/)/.test(args[i]!)) break
      program += ' ' + args[i]!
      if (/\.exe$/i.test(program)) return program
    }
  }
  return index === 1 && /\.exe$/i.test(args[1] ?? '') ? args[1]! : first
}

// Environment bytes belong to the game process, not Twinmap's launch environment.
export function wineProgramPath(program: string, environment: Buffer | null, resolveDrive: (path: string) => string): string {
  const windows = /^([a-z]):[\\/](.*)$/i.exec(program)
  if (!windows || !environment) return program
  const entries = environment.toString('utf8').split('\0')
  const value = (name: string): string | undefined => entries.find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1)
  const absolute = (name: string): string | undefined => {
    const path = value(name)
    return path && posix.isAbsolute(path) ? path : undefined
  }
  const compat = absolute('STEAM_COMPAT_DATA_PATH'), home = absolute('HOME')
  const prefix = absolute('WINEPREFIX') || (compat ? posix.join(compat, 'pfx') : home ? posix.join(home, '.wine') : undefined)
  if (!prefix) return program
  const drive = windows[1]!.toLowerCase(), path = windows[2]!.replace(/\\/g, '/')
  try {
    const root = drive === 'c' ? posix.join(prefix, 'drive_c') : resolveDrive(posix.join(prefix, 'dosdevices', `${drive}:`))
    return root ? posix.join(root, path) : program
  } catch { return program }
}

export function isGame(args: string[], executable: string | null, classes: string[]): boolean {
  const program = programFrom(args, executable) ?? ''
  return FOREVER_PROGRAM.test(program)
    || (/^wow\.exe$/i.test(program) && classes.some((name) => name.toLowerCase() === 'wow.exe') && args.some((arg) => FOREVER_FOLDER.test(arg)))
}

export function stateOf(mapState: number | null, states: number[], hidden: number): 'gone' | 'minimized' | 'open' {
  return mapState === null ? 'gone' : mapState !== 2 || states.includes(hidden) ? 'minimized' : 'open'
}

export function inWindow(width: number, height: number, x: number, y: number, w: number, h: number): boolean {
  return [x, y, w, h].every(Number.isSafeInteger) && x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height
}

// XWayland keeps fitting windows readable whole even when they hang off-screen.
function clipEdges(window: Rect, bounds: Rect): Rect | null {
  const x = window.width > bounds.width ? Math.max(0, bounds.x - window.x) : 0
  const y = window.height > bounds.height ? Math.max(0, bounds.y - window.y) : 0
  const width = window.width > bounds.width ? Math.min(window.width, bounds.x + bounds.width - window.x) - x : window.width
  const height = window.height > bounds.height ? Math.min(window.height, bounds.y + bounds.height - window.y) - y : window.height
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

export function edgeRect(window: Rect, rootWidth: number, rootHeight: number): Rect | null {
  return clipEdges(window, { x: 0, y: 0, width: rootWidth, height: rootHeight })
}

// Clip oversized axes to the bounding box of fully covered monitors, or the root if none are covered.
export function coveredMonitorEdgeRect(window: Rect, monitors: Rect[], rootWidth: number, rootHeight: number): Rect | null {
  let bounds: Rect | undefined
  for (const monitor of monitors) {
    if (monitor.x < window.x || monitor.y < window.y || monitor.x + monitor.width > window.x + window.width
      || monitor.y + monitor.height > window.y + window.height) continue
    if (!bounds) bounds = { ...monitor }
    else {
      const x = Math.min(bounds.x, monitor.x), y = Math.min(bounds.y, monitor.y)
      bounds = { x, y, width: Math.max(bounds.x + bounds.width, monitor.x + monitor.width) - x,
        height: Math.max(bounds.y + bounds.height, monitor.y + monitor.height) - y }
    }
  }
  return bounds ? clipEdges(window, bounds) : edgeRect(window, rootWidth, rootHeight)
}

export function rgbFrom(pixels: Buffer): Uint8Array {
  const rgb = new Uint8Array(pixels.length / 4 * 3)
  for (let src = 0, dst = 0; src < pixels.length; src += 4) {
    rgb[dst++] = pixels[src + 2]!
    rgb[dst++] = pixels[src + 1]!
    rgb[dst++] = pixels[src]!
  }
  return rgb
}

/**
 * The reader's problems, each said once: on stderr, and to the one listening (the app's record), who
 * first hears those said before it listened.
 */
export function problemList(write: (line: string) => void): { say: (message: string) => void; listen: (listener: (message: string) => void) => void } {
  const said: string[] = []
  let listener: ((message: string) => void) | undefined
  return {
    say: (message) => {
      if (said.includes(message)) return
      said.push(message)
      write(`Twinmap capture: ${message}`)
      listener?.(message)
    },
    listen: (next) => {
      listener = next
      for (const message of said) next(message)
    },
  }
}

// Window discovery is in Quartz. ScreenCaptureKit publishes live strip rows and slower full snapshots
// into a shared BGRA buffer so readers can pick up pixels without waiting for WindowServer.
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { closeSync, constants, fstatSync, lstatSync, mkdtempSync, openSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { app, screen } from 'electron'
import koffi from 'koffi'
import type { Rect } from '../shared/window'
import { contentTop, FOREVER_PROGRAM, inContent, windowRecord, type WindowRecord } from './capture-darwin-frame'

const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
const cf = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
const proc = koffi.load('/usr/lib/libproc.dylib')
const libc = koffi.load('/usr/lib/libSystem.B.dylib')
const CGRect = koffi.struct('CGRect', { x: 'double', y: 'double', width: 'double', height: 'double' })
const listWindows = cg.func('void * CGWindowListCopyWindowInfo(uint32_t options, uint32_t id)')
const rectFrom = cg.func('CGRectMakeWithDictionaryRepresentation', 'bool', ['void *', koffi.out(koffi.pointer(CGRect))])
const preflight = cg.func('bool CGPreflightScreenCaptureAccess()')
const arrayCount = cf.func('long CFArrayGetCount(void *array)')
const arrayValue = cf.func('void * CFArrayGetValueAtIndex(void *array, long index)')
const dictValue = cf.func('void * CFDictionaryGetValue(void *dict, void *key)')
const numberValue = cf.func('bool CFNumberGetValue(void *number, long type, _Out_ int64_t *out)')
const boolValue = cf.func('bool CFBooleanGetValue(void *value)')
const stringSize = cf.func('long CFStringGetLength(void *string)')
const stringRead = cf.func('bool CFStringGetCString(void *string, void *buffer, long length, uint32_t encoding)')
const release = cf.func('void CFRelease(void *object)')
const pidPath = proc.func('int proc_pidpath(int pid, void *buffer, uint32_t length)')
const shmOpen = libc.func('int shm_open(const char *name, int flags, ...)')
const shmUnlink = libc.func('int shm_unlink(const char *name)')
// Addresses stay integers: Electron's V8 memory cage forbids external ArrayBuffers, so koffi.view()
// over the mapping aborts the whole app (it passed under plain Node). Reads copy bytes out with memcpy.
const map = libc.func('uintptr_t mmap(void *address, size_t length, int protection, int flags, int fd, int64_t offset)')
const unmap = libc.func('int munmap(uintptr_t address, size_t length)')
const copyOut = libc.func('void * memcpy(void *destination, uintptr_t source, size_t length)')
const flock = libc.func('int flock(int fd, int operation)')

const EXCLUDE_DESKTOP = 1 << 4, INCLUDING_WINDOW = 1 << 3
const SHARED = 1, NONBLOCKING = 4, UNLOCK = 8
const RESIZE_SETTLE = 500, IDLE_AFTER = 3000 // ms
const TEMP_PREFIX = 'twinmap-capture-'
const UTF8 = 0x08000100
const key = (name: string): bigint => koffi.decode(cg.symbol(name), 'void *')
const keys = {
  id: key('kCGWindowNumber'), pid: key('kCGWindowOwnerPID'), bounds: key('kCGWindowBounds'),
  layer: key('kCGWindowLayer'), onScreen: key('kCGWindowIsOnscreen'), title: key('kCGWindowName'),
}

export type WindowHandle = number

function windows(id?: WindowHandle): WindowRecord[] {
  const list = listWindows(id === undefined ? EXCLUDE_DESKTOP : INCLUDING_WINDOW, id ?? 0)
  if (!list) return []
  const windows: WindowRecord[] = []
  try {
    for (let i = 0, count = arrayCount(list); i < count; i++) {
      const dict = arrayValue(list, i)
      const number = (key: bigint): number | null => {
        const value = dictValue(dict, key), out = [0]
        return value && numberValue(value, 4, out) ? Number(out[0]) : null // kCFNumberSInt64Type
      }
      const value = dictValue(dict, keys.bounds), bounds = {} as Rect
      const shown = dictValue(dict, keys.onScreen), name = dictValue(dict, keys.title)
      const title = name && Buffer.alloc(stringSize(name) * 3 + 1)
      const window = windowRecord({
        id: number(keys.id), pid: number(keys.pid), layer: number(keys.layer),
        bounds: value && rectFrom(value, bounds) ? bounds : null,
        onScreen: !!shown && boolValue(shown),
        title: title && stringRead(name, title, title.length, UTF8) ? title.toString('utf8', 0, title.indexOf(0)) : null,
      })
      if (window) windows.push(window)
    }
  } finally {
    release(list)
  }
  return windows
}

export const findWindow = (title: string): WindowHandle | null => windows().find((window) => window.title === title)?.id ?? null

function executable(pid: number): string | null {
  const name = Buffer.alloc(4096) // PROC_PIDPATHINFO_MAXSIZE
  return pidPath(pid, name, name.length) > 0 ? name.toString('utf8', 0, name.indexOf(0)) : null
}

export function programOf(id: WindowHandle): string | null {
  const window = windows(id)[0]
  return window ? executable(window.pid) : null
}

function windowOf(matches: (path: string) => boolean, includeMinimized = false): WindowHandle | null {
  const paths = new Map<number, string | null>()
  let minimized: WindowHandle | null = null
  for (const window of windows()) {
    if (window.layer !== 0 || (!window.onScreen && !includeMinimized)) continue
    if (!paths.has(window.pid)) paths.set(window.pid, executable(window.pid))
    const path = paths.get(window.pid)
    if (!path || !matches(path)) continue
    if (window.onScreen) return window.id
    minimized ??= window.id
  }
  return minimized
}

export const findWindowOf = (program: RegExp): WindowHandle | null => windowOf((path) => program.test(path))

export function findGameWindow(): WindowHandle | null {
  const test = !app.isPackaged && process.env.TWINMAP_CAPTURE_TEST_PROGRAM
  return windowOf(test ? (path) => path === test : (path) => FOREVER_PROGRAM.test(path), true)
}

export const captureAllowed = (): boolean => preflight()

// Quartz calls are shared by windowState, readRow and the occasional rectangle. Recheck often
// enough to notice a resize or display change, without querying WindowServer every 15 ms.
let checked: { id: WindowHandle; until: number; readyAt: number; window?: WindowRecord; geometry?: string } | undefined
function windowInfo(id: WindowHandle): WindowRecord | undefined {
  const now = performance.now()
  if (checked?.id === id && checked.until > now) return checked.window
  const window = windows(id)[0]
  const display = window?.onScreen ? screen.getDisplayMatching(window.bounds) : undefined
  const geometry = window && display
    // The position is part of it: the helper crops the display to the window's frame at start,
    // so a moved window needs a new crop (the restart waits for RESIZE_SETTLE, as for a resize).
    ? `${window.pid}:${window.bounds.x}:${window.bounds.y}:${window.bounds.width}:${window.bounds.height}:${display.id}:${display.scaleFactor}`
    : undefined
  const previous = checked?.id === id ? checked : undefined
  const changed = previous?.geometry && geometry && previous.geometry !== geometry
  checked = { id, until: now + 100, readyAt: changed ? now + RESIZE_SETTLE : previous?.readyAt ?? 0, window, geometry }
  return window
}

export function windowState(id: WindowHandle): 'gone' | 'minimized' | 'open' {
  const window = windowInfo(id)
  if (!window?.onScreen && active?.id === id) stopCapture()
  return !window ? 'gone' : window.onScreen ? 'open' : 'minimized'
}

type Layout = { width: number; height: number; scale: number; titleBar: number }
type Frame = Layout & { address: bigint; length: number; top: number; confirmed: boolean; nextScan: number }
type Capture = { id: WindowHandle; geometry: string; child: ChildProcess; lockFd: number; sharedFd?: number; frame?: Frame; deadline: number; idle: NodeJS.Timeout }

let active: Capture | undefined
let retryAt = 0
let lastProblem = ''
let swept = false

function problem(message: string): void {
  if (lastProblem === message) return
  lastProblem = message
  console.error(`Twinmap capture: ${message}`)
}

function forgetFile(dir: string): void {
  try { unlinkSync(join(dir, 'frame')) } catch {}
  try { rmdirSync(dir) } catch {}
}

function sweepStaleFrames(folder: string): void {
  if (swept) return
  swept = true
  let names: string[]
  try { names = readdirSync(folder) } catch { return }
  const cutoff = Date.now() - 60_000 // give another app instance time to open its descriptors
  for (const name of names) {
    if (!/^twinmap-capture-[a-zA-Z0-9]{6}$/.test(name)) continue
    const dir = join(folder, name)
    try {
      const entry = lstatSync(dir)
      if (entry.isDirectory() && entry.uid === process.getuid?.() && entry.mtimeMs < cutoff) forgetFile(dir)
    } catch {} // another instance may have cleaned up
  }
}

function openSharedMemory(): number | undefined {
  const name = '/twinmap-' + randomBytes(8).toString('hex')
  const fd = shmOpen(name, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL, 'int', 0o600)
  if (fd < 0) return
  if (shmUnlink(name) === 0) return fd
  closeSync(fd)
}

function retryCapture(): void {
  stopCapture()
  retryAt = performance.now() + 3000
}

export function stopCapture(): void {
  const current = active
  if (!current) return
  active = undefined
  clearTimeout(current.idle)
  current.child.stdin?.end()
  if (current.frame) unmap(current.frame.address, current.frame.length)
  if (current.sharedFd !== undefined) closeSync(current.sharedFd)
  closeSync(current.lockFd)
}

function startCapture(id: WindowHandle, geometry: string): Capture | undefined {
  const helper = app.isPackaged ? join(process.resourcesPath, '..', 'Helpers', 'twinmap-capture') : join(app.getAppPath(), 'dist-native', 'twinmap-capture')
  const folder = tmpdir()
  sweepStaleFrames(folder)
  let dir: string | undefined, lockFd: number | undefined, writer: number | undefined, sharedFd: number | undefined
  try {
    dir = mkdtempSync(join(folder, TEMP_PREFIX))
    const path = join(dir, 'frame')
    // Separate opens make flock work across processes. This file also backs the mapping if shm_open is denied.
    lockFd = openSync(path, 'wx+', 0o600)
    writer = openSync(path, 'r+')
    unlinkSync(path)
    rmdirSync(dir)
    dir = undefined
    sharedFd = openSharedMemory()
    const frameFd = sharedFd ?? lockFd
    const child = spawn(helper, [String(id), sharedFd === undefined ? '3' : '4'], {
      stdio: ['pipe', 'pipe', 'pipe', writer, sharedFd ?? 'ignore'],
    })
    const capture: Capture = {
      id, geometry, child, lockFd, sharedFd, deadline: performance.now() + 5000,
      idle: setTimeout(stopCapture, IDLE_AFTER).unref(),
    }
    child.stdin!.on('error', () => {}) // the helper can reject a window before we close its pipe
    child.once('error', (error) => problem(error.message))
    child.once('close', () => {
      if (active !== capture) return
      retryCapture()
    })
    createInterface({ input: child.stderr! }).on('line', problem)
    createInterface({ input: child.stdout! }).once('line', (line) => {
      if (active !== capture) return
      try {
        const { width, height, scale, titleBar, topRows } = JSON.parse(line) as Layout & { topRows: number }
        const length = width * (height + 1 + topRows) * 4
        if (![width, height, topRows].every((value) => Number.isSafeInteger(value) && value > 0)
          || !Number.isFinite(scale) || scale <= 0 || !Number.isFinite(titleBar) || titleBar < 0
          || topRows !== Math.min(height, Math.max(Math.round(titleBar * scale), Math.ceil(64 * scale)) + 1)
          || !Number.isSafeInteger(length) || fstatSync(frameFd).size < length) {
          throw new Error('invalid shared frame layout')
        }
        const address = BigInt(map(null, length, 1, 1, frameFd, 0) as number | bigint) // PROT_READ, MAP_SHARED
        if (address === 0n || address === 0xffff_ffff_ffff_ffffn) throw new Error('could not map the shared frame')
        capture.frame = { width, height, scale, titleBar, address, length, top: 0, confirmed: false, nextScan: 0 }
      } catch (error) {
        problem(error instanceof Error ? error.message : String(error))
        retryCapture()
      }
    })
    return capture
  } catch (error) {
    if (sharedFd !== undefined) closeSync(sharedFd)
    if (lockFd !== undefined) closeSync(lockFd)
    if (dir) forgetFile(dir)
    problem(error instanceof Error ? error.message : String(error))
    return undefined
  } finally {
    if (writer !== undefined) closeSync(writer)
  }
}

function frameRow(frame: Frame, y: number): Buffer {
  const row = Buffer.alloc(frame.width * 4)
  if (y < 0 || (y + 1) * row.length > frame.length) return row
  copyOut(row, frame.address + BigInt(y * row.length), row.length)
  return row
}

function withFrame<T>(id: WindowHandle, read: (frame: Frame, bounds: Rect) => T): T | null {
  const window = windowInfo(id)
  if (!window?.onScreen) {
    if (active?.id === id) stopCapture()
    return null
  }
  const { bounds } = window, now = performance.now(), info = checked
  if (!info?.geometry) return null
  const { geometry, readyAt } = info
  if (active && (active.id !== id || active.geometry !== geometry)) stopCapture()
  if (active && !active.frame && now >= active.deadline) {
    problem('ScreenCaptureKit did not deliver a frame within 5 seconds')
    retryCapture()
  }
  if (!active && now >= Math.max(retryAt, readyAt)) {
    if (captureAllowed()) active = startCapture(id, geometry)
    if (!active) retryAt = now + 3000
  }
  if (!active) return null
  const { frame, lockFd, idle } = active
  idle.refresh()
  if (!frame || flock(lockFd, SHARED | NONBLOCKING) !== 0) return null
  try {
    if (!frame.confirmed && now >= frame.nextScan) {
      const offset = contentTop(frame, (y) => frameRow(frame, frame.height + 1 + y))
      frame.top = offset.top
      frame.confirmed = offset.confirmed
      frame.nextScan = now + 150
    }
    return read(frame, bounds)
  } finally {
    flock(lockFd, UNLOCK)
  }
}

/** A target-window stream only contains that window, even under other windows. For own/showsOnly
 * it is enough to require an on-screen window and a rectangle within the cached content. */
export function readRect(id: WindowHandle, x: number, y: number, width: number, height: number, _own = false): { width: number; height: number; rgb: Uint8Array; at: { x: number; y: number } } | null {
  return withFrame(id, (frame, bounds) => {
    if (!inContent(frame, x, y, width, height)) return null
    const rgb = new Uint8Array(width * height * 3)
    for (let dy = 0, dst = 0; dy < height; dy++) {
      const row = frameRow(frame, frame.top + y + dy)
      for (let dx = 0, src = x * 4; dx < width; dx++, src += 4) {
        rgb[dst++] = row[src + 2]!
        rgb[dst++] = row[src + 1]!
        rgb[dst++] = row[src]!
      }
    }
    return { width, height, rgb, at: { x: Math.round(bounds.x * frame.scale) + x, y: Math.round(bounds.y * frame.scale) + frame.top + y } }
  })
}

export function readBox(id: WindowHandle, x: number, y: number, size: number): { size: number; rgb: Uint8Array } | null {
  const rectangle = readRect(id, x, y, size, size)
  return rectangle && { size, rgb: rectangle.rgb }
}

export const showsOnly = (id: WindowHandle, x: number, y: number, size: number): boolean =>
  withFrame(id, (frame) => inContent(frame, x, y, size, size)) ?? false

export const readRow = (id: WindowHandle, edge: 'top' | 'bottom' = 'top'): Buffer | null =>
  withFrame(id, (frame) => Buffer.from(frameRow(frame, edge === 'top' ? frame.height + 1 + frame.top : frame.height)))

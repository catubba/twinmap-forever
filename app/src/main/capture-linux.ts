import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, existsSync, fstatSync, mkdtempSync, openSync, rmdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import koffi from 'koffi'
import type { Edge, TokenStore } from './capture'
import { createTrust } from './capture-trust'
import { askClients, clientsShowGame, hyprlandSocket } from './hyprland'
import { initialCapturing, stepCapture, hintOf, restoreGate, gameChanged, frameMatchesGame, selectionAfterStop, type CaptureView } from './capture-linux-state'
import { frameLayout, HEADER_BYTES, inFrame, parseHelperLine, readHeader, type FrameLayout } from './capture-linux-frame'
import { app } from 'electron'
import { argv0, findForeverPid, findPid, matchesTestProgram, processAlive, processCwd, programPath } from './wine-process'

export function findGameWindow(): number | null {
  const marker = !app.isPackaged && process.env.TWINMAP_CAPTURE_TEST_PROGRAM
  return marker ? findPid((pid, cmdline) => matchesTestProgram(cmdline, marker, processCwd(pid) ?? '/')) : findForeverPid()
}

export function programOf(pid: number): string | null { return programPath(pid) }
export function findWindowOf(re: RegExp): number | null {
  return findPid((pid, cmdline) => /\.exe$/i.test(argv0(cmdline)) && re.test(programOf(pid) ?? ''))
}
export function findWindow(): null { return null }
export function windowState(pid: number): 'gone' | 'open' | 'minimized' {
  if (!existsSync('/proc/' + pid)) return 'gone'
  const info = captureView.state === 'running' ? frameInfo() : null
  return info && info.frames > 0 && Number(process.hrtime.bigint() / 1_000_000n) - info.lastFrameMs >= 2000 ? 'minimized' : 'open'
}
const libc = koffi.load('libc.so.6')
const memfdCreate = libc.func('int memfd_create(const char *name, unsigned int flags)')
const map = libc.func('uintptr_t mmap(void *address, size_t length, int protection, int flags, int fd, int64_t offset)')
const unmap = libc.func('int munmap(uintptr_t address, size_t length)')
const copyOut = libc.func('void * memcpy(void *destination, uintptr_t source, size_t length)')
const flock = libc.func('int flock(int fd, int operation)')
const MFD_CLOEXEC = 1, PROT_READ = 1, MAP_SHARED = 1
const LOCK_SH = 1, LOCK_NB = 4, LOCK_UN = 8
const MAP_FAILED = 0xffff_ffff_ffff_ffffn

type Frame = FrameLayout & { address: bigint }
type Capture = { pid: number; child: ChildProcess; lockFd: number; memfd?: number; session: number; frame?: Frame; stopping?: boolean; timer?: NodeJS.Timeout }
let active: Capture | undefined
let captureView = initialCapturing()
let tokenStore: TokenStore | undefined
export function useTokenStore(store: TokenStore): void { tokenStore = store }
let gamePid: number | null = null
let stopped = false
let reselectPending = false
const autoRestoreGate = restoreGate()
let asking = false
let sessionStartMs = 0, lastBlockMs: number | null = null, tokenReturned = false
export function captureState(paused = false): CaptureView {
  const hint = hintOf({ running: captureView.state === 'running', sessionStartMs, lastBlockMs, paused, nowMs: Date.now(), hyprland: !!hyprlandSocket(process.env), tokenReturned })
  return hint ? { ...captureView, hint } : captureView
}
export function captureAllowed(): boolean { return captureView.state === 'running' }
function tick(): void {
  if (stopped) return
  const previousPid = gamePid
  if (gamePid === null || !processAlive(gamePid)) gamePid = findGameWindow()
  if (gameChanged(previousPid, gamePid)) {
    reselectPending = false
    autoRestoreGate.reset()
    tokenStore?.set(null)
    trust.clear()
    stopHelper()
    captureView = initialCapturing()
  }
  const next = stepCapture(captureView, { kind: 'game', running: gamePid !== null })
  if (next.state === 'idle' && captureView.state !== 'idle') {
    reselectPending = false
    autoRestoreGate.reset()
    stopHelper()
  }
  captureView = next
  const socket = hyprlandSocket(process.env), pid = gamePid
  if (captureView.state === 'waiting' && tokenStore?.get() && socket && pid !== null && !asking && !active) {
    asking = true
    void askClients(socket).then(json => {
      asking = false
      if (!stopped && gamePid === pid && existsSync('/proc/' + pid) && captureView.state === 'waiting' && tokenStore?.get() && !active && json && clientsShowGame(json, pid) && autoRestoreGate.take(pid)) {
        captureView = stepCapture(captureView, { kind: 'connect' })
        startHelper()
      }
    })
  }
}
const ticker = setInterval(tick, 1000).unref()
let session = 0
let lastProblem = ''
let helperState: { state: string; why?: string } | null = null
export function lastHelperState(): { state: string; why?: string } | null { return helperState }
function problem(message: string): void {
  if (message !== lastProblem) console.error(`Twinmap capture: ${message}`)
  lastProblem = message
}
function cleanup(capture: Capture): void {
  if (capture.timer) clearTimeout(capture.timer)
  if (capture.frame) unmap(capture.frame.address, capture.frame.length)
  if (capture.memfd !== undefined) closeSync(capture.memfd)
  closeSync(capture.lockFd)
}
const trust = createTrust()
export function currentSession(): number | null { return active?.session ?? null }
export const captureSession = currentSession
export function trustCapture(value: number): void { trust.decoded(value); if (value === active?.session) lastBlockMs = Date.now() }
export function stopCapture(): void {
  stopped = true
  reselectPending = false
  clearInterval(ticker)
  stopHelper()
}
function stopHelper(): void {
  const current = active
  if (!current || current.stopping) return
  current.stopping = true
  current.child.stdin?.end()
  current.timer = setTimeout(() => current.child.kill('SIGTERM'), 2000).unref()
}
export function chooseCapture(): void {
  tick()
  if (stopped) return
  const next = stepCapture(captureView, { kind: 'reselect' })
  if (active?.stopping) {
    if (gamePid !== null && (next !== captureView || stepCapture(captureView, { kind: 'connect' }) !== captureView)) {
      tokenStore?.set(null)
      trust.clear()
      reselectPending = true
    }
    return
  }
  if (next === captureView && stepCapture(captureView, { kind: 'connect' }) === captureView) return
  tokenStore?.set(null)
  if (!active) { requestCapture(); return }
  captureView = next
  trust.clear()
  reselectPending = true
  stopHelper()
}
export function requestCapture(): boolean {
  tick()
  if (stopped) return false
  if (active?.stopping) {
    if (gamePid === null || stepCapture(captureView, { kind: 'connect' }) === captureView) return false
    tokenStore?.set(null)
    trust.clear()
    reselectPending = true
    return true
  }
  if (active) return false
  const next = stepCapture(captureView, { kind: 'connect' })
  if (next === captureView) return false
  captureView = next
  return startHelper()
}
function startHelper(): boolean {
  if (gamePid === null) return false
  const pid = gamePid
  helperState = null
  sessionStartMs = Date.now()
  lastBlockMs = null
  tokenReturned = false
  let dir: string | undefined, lockFd: number | undefined, writer: number | undefined, memfd: number | undefined
  let capture: Capture | undefined
  try {
    dir = mkdtempSync(join(tmpdir(), 'twinmap-capture-'))
    const path = join(dir, 'frame')
    lockFd = openSync(path, 'wx+', 0o600)
    writer = openSync(path, 'r+')
    unlinkSync(path)
    rmdirSync(dir)
    dir = undefined
    const fd = memfdCreate('twinmap-frame', MFD_CLOEXEC)
    if (fd >= 0) memfd = fd
    const frameFd = memfd ?? lockFd
    const helper = app.isPackaged ? join(process.resourcesPath, 'twinmap-capture') : join(app.getAppPath(), 'dist-native', 'twinmap-capture')
    const { LD_LIBRARY_PATH: _l, GSETTINGS_SCHEMA_DIR: _g, ...env } = process.env
    const child = spawn(helper, [memfd === undefined ? '3' : '4', String(++session)], { stdio: ['pipe', 'pipe', 'pipe', writer, memfd ?? 'ignore'], env })
    const current: Capture = { pid, child, lockFd, memfd, session }
    capture = current
    active = current
    child.stdin!.on('error', () => {})
    child.on('error', error => {
      if (active !== current || current.stopping) return
      problem(error.message)
      captureView = stepCapture(captureView, { kind: 'state', state: 'unsupported', why: error.message })
    })
    child.once('close', () => {
      if (active !== current) return
      active = undefined
      if (!current.stopping) captureView = stepCapture(captureView, { kind: 'exit' })
      cleanup(current)
      if (reselectPending) {
        reselectPending = false
        tick()
        captureView = selectionAfterStop(captureView, !stopped)
        if (!stopped && gamePid !== null && captureView.state === 'picking') startHelper()
      }
    })
    createInterface({ input: child.stderr! }).on('line', line => { if (active === current) problem(line) })
    createInterface({ input: child.stdout! }).on('line', line => {
      if (active !== current || current.stopping) return
      const message = parseHelperLine(line)
      if (!message) return
      if ('state' in message) {
        helperState = message
        captureView = stepCapture(captureView, { kind: 'state', state: message.state, why: message.why })
        stopHelper()
        return
      }
      if ('token' in message) { tokenReturned = message.token !== null; tokenStore?.set(message.token); return }
      if (!('layout' in message)) return
      try {
        const { width, height, topRows } = message.layout
        const layout = frameLayout(width, height, topRows)!
        if (fstatSync(frameFd).size < layout.length) throw new Error('invalid shared frame layout')
        if (current.frame) unmap(current.frame.address, current.frame.length)
        current.frame = undefined
        const address = BigInt(map(null, layout.length, PROT_READ, MAP_SHARED, frameFd, 0) as number | bigint)
        if (address === MAP_FAILED || address === 0n) throw new Error('could not map the shared frame')
        current.frame = { ...layout, address }
        if (captureView.state === 'picking') sessionStartMs = Date.now()
        captureView = stepCapture(captureView, { kind: 'layout' })
      } catch (error) { problem(error instanceof Error ? error.message : String(error)) }
    })
    const token = tokenStore?.get()
    child.stdin!.write(JSON.stringify(token ? { token } : {}) + '\n')
    return true
  } catch (error) {
    if (capture && active === capture) active = undefined
    if (memfd !== undefined) closeSync(memfd)
    if (lockFd !== undefined) closeSync(lockFd)
    if (dir) { try { unlinkSync(join(dir, 'frame')) } catch {} try { rmdirSync(dir) } catch {} }
    const why = error instanceof Error ? error.message : String(error)
    problem(why)
    captureView = stepCapture(captureView, { kind: 'state', state: 'unsupported', why })
    return false
  } finally { if (writer !== undefined) closeSync(writer) }
}
function bytes(frame: Frame, offset: number, length: number): Buffer {
  const result = Buffer.alloc(length)
  copyOut(result, frame.address + BigInt(offset), length)
  return result
}
function withFrame<T>(read: (frame: Frame, header: ReturnType<typeof readHeader>) => T): T | null {
  const capture = active, frame = capture?.frame
  if (!capture || capture.stopping || !frame || flock(capture.lockFd, LOCK_SH | LOCK_NB) !== 0) return null
  try {
    const header = readHeader(bytes(frame, 0, HEADER_BYTES))
    return header.width === frame.width && header.height === frame.height ? read(frame, header) : null
  } finally { flock(capture.lockFd, LOCK_UN) }
}
export function frameInfo(): ReturnType<typeof readHeader> | null { return withFrame((_frame, header) => header) }
export function readRow(pid: number, edge: Edge = 'top'): Buffer | null {
  if (!frameMatchesGame(active?.pid ?? null, pid)) return null
  return withFrame(frame => bytes(frame, frame[edge], (edge === 'left' || edge === 'right' ? frame.height : frame.width) * 4))
}
export function readRect(pid: number, x: number, y: number, width: number, height: number, _own = false): { width: number; height: number; rgb: Uint8Array; at: { x: number; y: number } } | null {
  if (!frameMatchesGame(active?.pid ?? null, pid) || (_own && !trust.trusted(currentSession()))) return null
  return withFrame(frame => {
    if (!inFrame(frame, x, y, width, height)) return null
    const rgb = new Uint8Array(width * height * 3)
    for (let dy = 0, dst = 0; dy < height; dy++) {
      const row = bytes(frame, frame.snapshot + ((y + dy) * frame.width + x) * 4, width * 4)
      for (let src = 0; src < row.length; src += 4) {
        rgb[dst++] = row[src + 2]!
        rgb[dst++] = row[src + 1]!
        rgb[dst++] = row[src]!
      }
    }
    return { width, height, rgb, at: { x, y } }
  })
}
export function readBox(pid: number, x: number, y: number, size: number): { size: number; rgb: Uint8Array } | null {
  const rect = readRect(pid, x, y, size, size, true)
  return rect && { size, rgb: rect.rgb }
}
export function showsOnly(pid: number, x: number, y: number, size: number): boolean {
  return frameMatchesGame(active?.pid ?? null, pid) && trust.trusted(currentSession()) && (withFrame(frame => inFrame(frame, x, y, size, size)) ?? false)
}

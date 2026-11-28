export type CaptureState = 'idle' | 'waiting' | 'picking' | 'running' | 'cancelled' | 'refused' | 'unsupported'
export type CaptureView = { state: CaptureState; why?: string; hint?: 'wrong-window' | 'not-remembered' }
type Event = { kind: 'game'; running: boolean } | { kind: 'connect' | 'layout' | 'exit' | 'forget' | 'reselect' } | { kind: 'state'; state: 'cancelled' | 'refused' | 'closed' | 'unsupported'; why?: string }
export const initialCapturing = (): CaptureView => ({ state: 'idle' })
export function stepCapture(c: CaptureView, e: Event): CaptureView {
  if (e.kind === 'game') return e.running ? c.state === 'idle' ? { state: 'waiting' } : c : c.state === 'idle' ? c : { state: 'idle' }
  if (e.kind === 'connect' && ['waiting', 'cancelled', 'refused', 'unsupported'].includes(c.state)) return { state: 'picking' }
  if (e.kind === 'reselect' && c.state === 'running') return { state: 'picking' }
  if (e.kind === 'layout' && c.state === 'picking') return { state: 'running' }
  if (e.kind === 'exit' && (c.state === 'running' || c.state === 'picking')) return { state: 'waiting' }
  if (e.kind === 'forget' && c.state !== 'idle') return { state: 'waiting' }
  if (e.kind === 'state') {
    if (e.state === 'unsupported') return { state: 'unsupported', why: e.why }
    if (c.state === 'running' || c.state === 'picking') return { state: e.state === 'closed' ? 'waiting' : e.state }
  }
  return c
}
export function hintOf(s: { running: boolean; sessionStartMs: number; lastBlockMs: number | null; paused: boolean; nowMs: number; hyprland: boolean; tokenReturned: boolean }): 'wrong-window' | 'not-remembered' | null {
  if (!s.running || s.paused || s.nowMs - s.sessionStartMs < 10_000) return null
  if (s.lastBlockMs === null) return 'wrong-window'
  return s.hyprland && !s.tokenReturned ? 'not-remembered' : null
}
export function restoreGate(): { take(pid: number): boolean; reset(): void } {
  let attempted: number | null = null
  return {
    take(pid) { if (attempted === pid) return false; attempted = pid; return true },
    reset() { attempted = null },
  }
}

export function gameChanged(previous: number | null, next: number | null): boolean { return previous !== null && previous !== next }

export function frameMatchesGame(capturePid: number | null, requestedPid: number): boolean { return capturePid !== null && capturePid === requestedPid }
export function selectionAfterStop(view: CaptureView, requested: boolean): CaptureView { return requested ? stepCapture(view, { kind: 'connect' }) : view }

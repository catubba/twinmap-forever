// The link with the game: finds its window, reads the strip off it many times a second, and
// keeps the character's state up to date.
import { createGame } from '../shared/game'
import type { LinkSnapshot } from '../shared/link'
import { decodeRow } from '../shared/strip'
import { findGameWindow, readRow, windowState, type WindowHandle } from './capture'

// Tuning knobs.
const READ_EVERY = 15 // ms: a block stays up 50 ms, so it is seen about three times
const FIND_EVERY = 3000 // ms between looks for the game's window while it is not open
const EDGE_KEPT = 5000 // ms without a strip before the other edge of the window is tried again

export function startLink(): { snapshot: () => LinkSnapshot; stop: () => void } {
  const game = createGame()
  const startedAt = Date.now(), cpuAtStart = process.cpuUsage()
  let hwnd: WindowHandle | null = null
  let status: LinkSnapshot['game'] = 'closed'
  let lookAgainAt = 0, reads = 0
  // The player chooses the edge in the game. Until a strip shows which, both are read in turn.
  let edge: 'top' | 'bottom' = 'top', edgeSeenAt = 0

  const timer = setInterval(() => {
    const now = Date.now()
    if (hwnd === null) {
      if (now < lookAgainAt) return
      lookAgainAt = now + FIND_EVERY
      hwnd = findGameWindow()
      if (hwnd === null) return
    }
    const state = windowState(hwnd)
    if (state === 'gone') {
      hwnd = null
      status = 'closed'
      return
    }
    status = state
    if (state === 'minimized') return

    if (now - edgeSeenAt > EDGE_KEPT) edge = edge === 'top' ? 'bottom' : 'top'
    const row = readRow(hwnd, edge)
    if (!row) return
    reads++
    const reading = decodeRow(row)
    if (reading.kind !== 'none') edgeSeenAt = now
    game.feed(reading, now)
  }, READ_EVERY)

  return {
    snapshot() {
      const cpu = process.cpuUsage(cpuAtStart)
      const elapsed = Date.now() - startedAt
      return {
        game: status,
        state: game.state,
        seconds: elapsed / 1000,
        reads,
        cpu: elapsed ? ((cpu.user + cpu.system) / 1000 / elapsed) * 100 : 0,
      }
    },
    stop: () => clearInterval(timer),
  }
}

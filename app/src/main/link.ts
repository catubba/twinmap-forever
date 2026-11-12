// The link with the game: finds its window, reads the strip off it many times a second, and
// keeps the character's state up to date.
import { createGame, type GameState } from '../shared/game'
import type { LinkSnapshot } from '../shared/link'
import { decodeRow, readStrip } from '../shared/strip'
import { readFileSync } from 'node:fs'
import { worldOfYards } from '../shared/inside'
import { findGameWindow, readBox, readRow, windowState, type WindowHandle } from './capture'
import { startInside, type Inside } from './minimap'

// Tuning knobs.
const READ_EVERY = 15 // ms: a block stays up 50 ms, so it is seen about three times
const FIND_EVERY = 3000 // ms between looks for the game's window while it is not open
const EDGE_KEPT = 5000 // ms without a strip before the other edge of the window is tried again
const REPLAY_EVERY = 5000 // ms between the strips of a recorded session

// For trials without the game: TWINMAP_REPLAY names a file of recorded strips (a list of strings of
// cells, one digit 0 to 7 a pixel, as addon/tests/record.js writes them). They go through the same
// decoder as the pixels of the game's window, one every few seconds.
function replayed(file: string): (() => Uint8Array | null) {
  const strips = JSON.parse(readFileSync(file, 'utf8')) as string[], startedAt = Date.now()
  return () => {
    const cells = strips[Math.min(strips.length - 1, Math.floor((Date.now() - startedAt) / REPLAY_EVERY))]
    if (!cells) return null
    const row = new Uint8Array(cells.length * 4)
    for (let i = 0; i < cells.length; i++) {
      const v = Number(cells[i])
      row.set([v & 1 ? 255 : 0, v & 2 ? 255 : 0, v & 4 ? 255 : 0, 0], i * 4) // blue, green, red, unused
    }
    return row
  }
}

/** tilesFolder: where the converter keeps the build's pictures, once it has them: the rooms of the dungeons are there. */
/** The state with the place found from the minimap put where the game's own would be: the map draws the arrow from it. */
function withInside(state: GameState, found: (Inside & { at: number }) | null): GameState {
  const pos = state.sections.pos
  if (!found || !pos?.inst) return state
  // The app counts a facing anticlockwise from north, as the game does.
  const facing = found.facing === undefined ? pos.facing : (360 - found.facing) % 360
  return { ...state, sections: { ...state.sections, pos: { ...pos, facing, inst: { ...pos.inst, ...worldOfYards(found), level: found.level } } }, updatedAt: { ...state.updatedAt, pos: Math.max(state.updatedAt.pos ?? 0, found.at) } }
}

export function startLink(tilesFolder: () => string | null = () => null): { snapshot: () => LinkSnapshot; stop: () => void } {
  const game = createGame()
  // Inside a dungeon the game tells addons no place: there, and only there, it is found from the minimap on the screen.
  const inside = startInside(tilesFolder)
  let found: (Inside & { at: number }) | null = null
  const startedAt = Date.now(), cpuAtStart = process.cpuUsage()
  let hwnd: WindowHandle | null = null
  let status: LinkSnapshot['game'] = 'closed'
  let lookAgainAt = 0, reads = 0
  // The player chooses the edge in the game. Until a strip shows which, both are read in turn.
  let edge: 'top' | 'bottom' = 'top', edgeSeenAt = 0
  let drew: number | undefined // how wide the game drew the last strip read

  const replay = process.env.TWINMAP_REPLAY ? replayed(process.env.TWINMAP_REPLAY) : null

  const timer = setInterval(() => {
    const now = Date.now()
    if (replay) {
      const row = replay()
      status = 'open'
      if (!row) return
      reads++
      game.feed(decodeRow(row), now)
      return
    }
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
    // A game stretched to fill its monitor: the width it drew at is found once and kept.
    const read = readStrip(row, drew)
    const reading = read.reading
    if (read.drew) drew = read.drew
    if (reading.kind !== 'none') edgeSeenAt = now
    game.feed(reading, now)
    // The addon tells where the minimap is in pixels of the game: on a stretched game the square is as much further and bigger on screen.
    const window = hwnd, stretch = drew ? (row.length >> 2) / drew : 1
    const place = inside.look(game.state.sections.pos, (x, y, size) => readBox(window, Math.round(x * stretch), Math.round(y * stretch), Math.round(size * stretch)), now)
    found = place && (found && found.u === place.u && found.v === place.v && found.facing === place.facing && found.level === place.level ? found : { ...place, at: now })
  }, READ_EVERY)

  return {
    snapshot() {
      const cpu = process.cpuUsage(cpuAtStart)
      const elapsed = Date.now() - startedAt
      return {
        game: status,
        state: withInside(game.state, found),
        seconds: elapsed / 1000,
        reads,
        cpu: elapsed ? ((cpu.user + cpu.system) / 1000 / elapsed) * 100 : 0,
      }
    },
    stop: () => clearInterval(timer),
  }
}

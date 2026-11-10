// What the main process tells the window about its link with the game, a few times a second.
import type { GameState } from './game'

export interface LinkSnapshot {
  /** The game's window: not found, minimized (nothing to read), or on screen. */
  game: 'closed' | 'minimized' | 'open'
  state: GameState
  /** Seconds since the app started reading. */
  seconds: number
  /** Rows of pixels read so far. */
  reads: number
  /** Processor time the main process used since it started, as a percent of one core. */
  cpu: number
}

/** How the link is, for the top row: a word, its colour, and a sentence for the map when the player has something to do. */
export interface LinkStatus {
  kind: 'connected' | 'combat' | 'waiting' | 'closed' | 'minimized' | 'lost' | 'update-app' | 'update-addon'
  word: string
  /** Green: all well. Gold: in a fight. Red: no position is coming. Dim: not known yet. */
  tone: 'done' | 'gold' | 'objective' | 'dim'
  line?: string
}

// The addon sends the position at least every 10 seconds. Two missed and a margin: the strip has stopped.
export const LOST_AFTER = 25_000

export function linkStatus(link: LinkSnapshot, now: number): LinkStatus {
  const { state } = link
  if (link.game === 'closed')
    return { kind: 'closed', word: 'Game not running', tone: 'objective', line: 'Game not running. The map still works; your position appears when you log in.' }
  if (link.game === 'minimized')
    return { kind: 'minimized', word: 'Game minimized', tone: 'objective', line: 'Game minimized. Your position appears when its window is back on screen.' }
  if (state.protocol)
    return { kind: `update-${state.protocol.update}`, word: state.protocol.update === 'app' ? 'Update the app' : 'Update the addon', tone: 'objective', line: state.protocol.message }
  const heard = Math.max(0, ...Object.values(state.updatedAt))
  if (!heard && link.seconds * 1000 < LOST_AFTER) return { kind: 'waiting', word: 'Connecting', tone: 'dim' }
  if (now - heard > LOST_AFTER)
    return { kind: 'lost', word: 'Link lost', tone: 'objective', line: 'No signal from the game. Log in, and check that the Twinmap Forever addon is on and its strip is not paused.' }
  if (state.sections.pos?.combat) return { kind: 'combat', word: 'In combat, position only', tone: 'gold' }
  return { kind: 'connected', word: 'Connected', tone: 'done' }
}

/** The experience bar: percent of the level done, and percent of it that rest will double. Null at the level cap. */
export function experience(char: { xp?: number; max?: number; rested?: number }): { percent: number; rested: number } | null {
  if (char.xp === undefined || !char.max) return null
  const percent = Math.min(100, (char.xp / char.max) * 100)
  return { percent, rested: Math.min(100 - percent, ((char.rested ?? 0) / char.max) * 100) }
}

/** Blocks that went by unseen, as a percent of all the blocks the addon drew. */
export function lostPercent(state: GameState): number {
  const drawn = state.blocks + state.lost
  return drawn ? (state.lost / drawn) * 100 : 0
}

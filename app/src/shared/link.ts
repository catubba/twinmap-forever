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

/** Blocks that went by unseen, as a percent of all the blocks the addon drew. */
export function lostPercent(state: GameState): number {
  const drawn = state.blocks + state.lost
  return drawn ? (state.lost / drawn) * 100 : 0
}

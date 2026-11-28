// What the main process tells the window about its link with the game, a few times a second.
import type { GameState } from './game'
import { t } from './i18n'

export type CaptureState = 'idle' | 'waiting' | 'picking' | 'running' | 'cancelled' | 'refused' | 'unsupported'
export type CaptureView = { state: CaptureState; why?: string; hint?: 'wrong-window' | 'not-remembered' }

export interface LinkSnapshot {
  capture?: CaptureView
  /** Present only on macOS while Screen Recording permission is missing. */
  screenRecording?: false
  /** The game's window: not found, minimized (nothing to read), or on screen. */
  game: 'closed' | 'minimized' | 'open'
  state: GameState
  /** Seconds since the app started reading. */
  seconds: number
  /** Rows of pixels read so far. */
  reads: number
  /** Processor time the main process used since it started, as a percent of one core. */
  cpu: number
  /** Inside a dungeon or a raid: why the place is not known, when it is not, and for how many milliseconds. */
  inside?: { why?: string; lostFor?: number } | null
  /** The player pressed Pause: the strip is not read, and the addon was asked to stop drawing it. */
  paused?: boolean
  /** When the pause was last taken back (ms since 1970): the addon takes a few seconds to draw again. */
  resumedAt?: number
}

/** How the link is, for the top row: a word, its colour, and a sentence for the map when the player has something to do. */
export interface LinkStatus {
  kind: 'connect' | 'paused' | 'connected' | 'combat' | 'waiting' | 'closed' | 'minimized' | 'lost' | 'update-app' | 'update-addon'
  word: string
  /** Green: all well. Gold: in a fight. Red: no position is coming. Dim: not known yet. */
  tone: 'done' | 'gold' | 'objective' | 'dim'
  line?: string
  capture?: CaptureView
}

// The addon sends the position at least every 10 seconds. Two missed and a margin: the strip has stopped.
export const canChooseCapture = (link: Pick<LinkSnapshot, 'capture'> | null): boolean => link?.capture?.state === 'running'
export const LOST_AFTER = 25_000

export function linkStatus(link: LinkSnapshot, now: number): LinkStatus {
  const { state } = link
  // The map says so with a button of its own (App.svelte): no line here.
  if (link.paused) return { kind: 'paused', word: t('app.link.paused'), tone: 'dim' }
  if (link.game === 'closed')
    return { kind: 'closed', word: t('app.link.closed'), tone: 'objective', line: t('app.link.closedLine') }
  if (link.game === 'minimized')
    return { kind: 'minimized', word: t('app.link.minimized'), tone: 'objective', line: t('app.link.minimizedLine'), ...(link.capture && { capture: link.capture }) }
  const hint = link.capture?.hint
  const hinted = hint === 'wrong-window' ? t('app.link.wrongWindowLine') : hint === 'not-remembered' ? t('app.link.notRememberedLine') : undefined
  const capturing = link.capture?.state
  if (capturing === 'waiting' || capturing === 'cancelled' || capturing === 'refused')
    return { kind: 'connect', word: t('app.link.noWindow'), tone: 'objective', line: t(capturing === 'waiting' ? 'app.link.connectLine' : 'app.link.chooseAgainLine'), capture: link.capture }
  if (capturing === 'unsupported') return { kind: 'lost', word: t('app.link.lost'), tone: 'objective', line: t('app.link.unsupportedLine', { why: link.capture?.why ?? '' }), capture: link.capture }
  if (capturing === 'picking') return { kind: 'waiting', word: t('app.link.connecting'), tone: 'dim' }
  if (link.screenRecording === false)
    return { kind: 'lost', word: t('app.link.lost'), tone: 'objective', line: t('app.link.screenRecording') }
  if (state.protocol)
    return { kind: `update-${state.protocol.update}`, word: state.protocol.update === 'app' ? t('app.link.updateApp') : t('app.link.updateAddon'), tone: 'objective', line: state.protocol.message }
  const heard = Math.max(0, ...Object.values(state.updatedAt))
  if (!heard && link.seconds * 1000 < LOST_AFTER) return { kind: 'waiting', word: t('app.link.connecting'), tone: 'dim', ...(hinted && { line: hinted }) }
  // Back from a pause, the addon reads the news within seconds and draws again: until then the link is not lost.
  if (link.resumedAt !== undefined && heard < link.resumedAt && now - link.resumedAt < LOST_AFTER) return { kind: 'waiting', word: t('app.link.connecting'), tone: 'dim', ...(hinted && { line: hinted }) }
  if (now - heard > LOST_AFTER)
    return { kind: 'lost', word: t('app.link.lost'), tone: 'objective', line: hinted ?? t('app.link.lostLine') }
  const line = insideLine(link.inside) ?? hinted
  if (state.sections.pos?.combat) return { kind: 'combat', word: t('app.link.combat'), tone: 'gold', ...(line && { line }) }
  return { kind: 'connected', word: t('app.link.connected'), tone: 'done', ...(line && { line }) }
}

// A place that is missing for this long inside a dungeon is said: shorter, the map is still looking.
const LOOKING_FOR = 10_000

/**
 * What to tell the player inside a dungeon when the arrow is not there: the place is read from the
 * game's minimap on the screen, and the link itself is well. Nothing while the place is known.
 */
function insideLine(inside: LinkSnapshot['inside']): string | undefined {
  if (!inside?.why) return undefined
  if (inside.why === 'minimap turns') return t('app.link.minimapTurns')
  if (inside.why === 'no rooms') return t('app.link.noRooms')
  if (inside.why === 'no minimap told' || inside.why === 'zoom not known') return t('app.link.noMinimap')
  if ((inside.lostFor ?? 0) < LOOKING_FOR) return undefined
  return t('app.link.looking')
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

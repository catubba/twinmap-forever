// Feedback from the player: a bug, an idea, a word. The app sends nothing by itself. It opens an
// issue on GitHub, or a letter in the player's own mail program for who has no account there,
// already filled with what the app knows about itself. The player sees every word before it leaves.
import { tilesLine, type TilesStatus } from './tiles-status'
import type { SetupStatus } from './setup'

export const FEEDBACK = { github: 'https://github.com/catubba/twinmap-forever/issues/new', email: 'dev@twinmap.app' } as const
export type FeedbackWay = keyof typeof FEEDBACK

/** A text with the name of the Windows account left out of any folder it names. */
export const nameless = (text: string): string => text.replace(/([\\/]Users[\\/])[^\\/\s']+/gi, '$1...')

const LONGEST = 1500 // characters of details an address may carry: a browser or a mail program cuts longer ones as it likes

/** What the app knows about itself, for whoever reads the report. Nothing of the player: no folder, no name, no character. */
export function feedbackDetails(setup: SetupStatus, tiles: TilesStatus | null, link: string | null): string {
  const has = (there: boolean): string => (there ? 'installed' : 'not installed')
  // A fault's message may name a folder of the player.
  return nameless(
    [
      `Twinmap ${setup.version}`,
      `Twinmap Forever addon: ${setup.addon ?? 'not installed'}`,
      `Game folder: ${setup.gameFolder ? 'found' : 'not found'}`,
      `Map: ${tiles ? tilesLine(tiles) : 'unknown'}`,
      `Link: ${link ?? 'unknown'}`,
      `Questie: ${has(setup.questie)}`,
      `Shortest Path: ${has(setup.shortestPath)}`,
    ].join('\n'),
  )
}

/** The address that opens the report, with the details under the room for the player's words. `details` may come from anywhere: only its text is used, cut short. */
export function feedbackLink(way: unknown, details: unknown): string | null {
  if (way !== 'github' && way !== 'email') return null
  const body = encodeURIComponent(`What happened, or what you would like:\n\n\n\n---\n${typeof details === 'string' ? details.slice(0, LONGEST) : ''}`)
  return way === 'github' ? `${FEEDBACK.github}?body=${body}` : `mailto:${FEEDBACK.email}?subject=${encodeURIComponent('Twinmap feedback')}&body=${body}`
}

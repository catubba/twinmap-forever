// Feedback from the player: a bug, an idea, a word. Nothing of it is sent by itself. The player
// writes in the app and presses Send, or opens an issue on GitHub, or a letter in their own mail
// program, already filled with what the app knows about itself. They see every word before it leaves.
import { tilesLine, type TilesStatus } from './tiles-status'
import type { SetupStatus } from './setup'

export const FEEDBACK = { github: 'https://github.com/catubba/twinmap-forever/issues/new', email: 'dev@twinmap.app', privacy: 'https://twinmap.app/privacy.html', participation: 'https://twinmap.app/privacy.html#participation' } as const
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
      `QuestieDB: ${has(setup.questie)}`,
      `Shortest Path: ${has(setup.shortestPath)}`,
    ].join('\n'),
  )
}

/** The address that opens the report, with the details under the room for the player's words, or the page that says what a sent message carries. `details` may come from anywhere: only its text is used, cut short. */
export function feedbackLink(way: unknown, details: unknown): string | null {
  if (way === 'privacy' || way === 'participation') return FEEDBACK[way]
  if (way !== 'github' && way !== 'email') return null
  const body = encodeURIComponent(`What happened, or what you would like:\n\n\n\n---\n${typeof details === 'string' ? details.slice(0, LONGEST) : ''}`)
  return way === 'github' ? `${FEEDBACK.github}?body=${body}` : `mailto:${FEEDBACK.email}?subject=${encodeURIComponent('Twinmap feedback')}&body=${body}`
}

/** What the Feedback window hands over when the player presses Send. */
export interface FeedbackSent {
  message: string
  email: string
  details: string
  withLog: boolean
}

/** Where Send delivers a message: server/src/index.ts, which files it for the developer to read. */
export const SEND_TO = 'https://api.twinmap.app/feedback'
export const LONGEST_MESSAGE = 5000 // characters, as the server allows

/**
 * Sends what the player wrote. Gives null when it is delivered, else the words to show them.
 * `sent` may come from anywhere: only its texts are used. The log is read here, and only when asked for.
 */
export async function sendFeedback(sent: unknown, log: () => string, to: string = SEND_TO): Promise<string | null> {
  const { message, email, details, withLog } = (typeof sent === 'object' && sent !== null ? sent : {}) as Record<string, unknown>
  if (typeof message !== 'string' || !message.trim()) return 'Write your message first.'
  if (message.length > LONGEST_MESSAGE) return `Your message is too long: ${LONGEST_MESSAGE} characters at most.`
  const body = {
    message,
    email: typeof email === 'string' ? email.trim() : '',
    details: typeof details === 'string' ? details.slice(0, LONGEST) : '',
    log: withLog === true ? log() : '',
  }
  try {
    const answer = await fetch(to, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) })
    if (answer.ok) return null
    if (answer.status === 429) return 'Too many messages in a short time. Wait a minute and send again.'
    const said = ((await answer.json().catch(() => null)) as { error?: unknown } | null)?.error
    return said === 'not an email address' ? 'The email address does not look right.' : 'The message could not be delivered. Try again later, or use GitHub or email.'
  } catch {
    return 'No answer from the server. Check your connection and send again.'
  }
}

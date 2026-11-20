// The app's health, for the participation programme (M15-F17): off until the player turns it on.
// While it is on, the lines of the app's errors and the looks at the minimap inside a dungeon (how
// many, how many found no place, how long they took) are kept in memory, and sent to the server
// (server/src/index.ts, /errors) at most every half hour, with the version of the app and the build
// and language of the game. No place, no character: before a line leaves, the folders of the player
// are taken out of it (a folder the app knows becomes a word in brackets, any other becomes its last
// name) and so are the names of the Windows account, of the computer and of the characters; a line
// that still holds a folder is not sent at all. With the choice off nothing is kept and nothing is sent.
// Every error line goes into the app's own record too, whatever the choice.
import { randomBytes } from 'node:crypto'

export const ERRORS_TO = 'https://api.twinmap.app/errors'
const MOST_LINES = 20, LONGEST_LINE = 300 // as the server takes them
const MOST_TIMES = 10_000 // looks timed in a report: two hours at two a second
const EVERY = 30 * 60_000 // ms between two reports
const CHECK = 60_000 // ms between two looks at whether a report is due
// A folder as the server refuses it (FOLDER in server/src/index.ts).
const FOLDER = /[A-Za-z]:[\\/]|\\\\|(^|[\s('"=])\/(Users|home|mnt|Volumes|var|tmp|private)\/|[\\/]Users[\\/]/i

let on: () => boolean = () => false
let say: (line: string) => void = () => {}
const lines: string[] = [], times: number[] = []
let looks = 0, failed = 0

/** An error: written in the app's record, and kept for the next report while the choice is on. */
export function fault(line: string): void {
  say(`error: ${line}`)
  if (on() && lines.length < MOST_LINES && !lines.includes(line)) lines.push(line)
}

/** What went wrong, in a line: the kind and message of an error and where it was thrown. */
export function describe(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const where = e.stack?.split('\n').find((l) => l.trim().startsWith('at '))?.trim()
  return `${e.name}: ${e.message}${where ? ` ${where}` : ''}`
}

/** A look at the minimap inside a dungeon that came to something new: how long it took, and whether it found the place. */
export function look(ms: number, found: boolean): void {
  if (!on()) return
  looks++
  if (!found) failed++
  if (times.length < MOST_TIMES) times.push(Math.round(ms))
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A line as it may leave this computer, or null when a folder is still in it. places: folders the
 * app knows and the word each becomes; names: what is taken out wherever it stands.
 */
export function clean(line: string, places: [string, string][], names: string[]): string | null {
  let out = line.replace(/[\u0000-\u001f\u007f]+/g, ' ')
  // The longest folder first: the game's may lie inside the home.
  for (const [folder, word] of [...places].filter(([f]) => f.length > 3).sort((a, b) => b[0].length - a[0].length)) {
    out = out.replace(new RegExp(escape(folder).replace(/\\\\|\//g, '[\\\\/]'), 'gi'), word)
  }
  // Any other folder, up to the first space: its last name only.
  out = out.replace(/(?:[A-Za-z]:[\\/]|\\\\|(?<=^|[\s('"=])\/)[^\s'"()]*/g, (path) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? '')
  for (const name of names.filter((n) => n.length > 1)) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, 'giu'), '<name>')
  out = out.trim().slice(0, LONGEST_LINE)
  return out && !FOLDER.test(out) ? out : null
}

const at = (sorted: number[], share: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))]!

/** What is kept, taken away: the report, or null when there is nothing. */
export function report(places: [string, string][], names: string[]): { id: string; errors: string[]; looks: number; failed: number; ms: number[] } | null {
  if (lines.length === 0 && looks === 0) return null
  const sorted = [...times].sort((a, b) => a - b)
  const out = {
    id: randomBytes(8).toString('hex'),
    errors: [...new Set(lines.map((l) => clean(l, places, names)).filter((l): l is string => l !== null))],
    looks,
    failed,
    ms: sorted.length ? [at(sorted, 0.5), at(sorted, 0.95), sorted.at(-1)!].map((n) => Math.min(n, 600_000)) : [],
  }
  lines.length = 0
  times.length = 0
  looks = failed = 0
  return out.errors.length || out.looks ? out : null
}

/**
 * Sends a report when one is due: something is kept and the last one went at least every ms ago.
 * said: the version of the app, the build of the game and its language, null while not known.
 */
export function startHealth(
  isOn: () => boolean,
  said: () => { app: string; build: string; locale: string } | null,
  places: () => [string, string][],
  names: () => string[],
  record: (line: string) => void,
  to: string = ERRORS_TO,
  every: number = EVERY,
): { stop: () => void } {
  on = isOn
  say = record
  let sentAt = -Infinity
  const check = async (): Promise<void> => {
    if (!on()) return void report([], []) // what was kept before the choice went off goes
    const told = said()
    if (!told || Date.now() - sentAt < every || (lines.length === 0 && looks === 0)) return
    const body = report(places(), names())
    if (!body) return
    sentAt = Date.now()
    // ponytail: a report that cannot be sent is lost; a queue if the server is often out of reach.
    try {
      const answer = await fetch(`${to.replace(/errors$/, 'want')}?${new URLSearchParams({ app: told.app })}`, { signal: AbortSignal.timeout(15_000) })
      const want = answer.ok ? ((await answer.json()) as { errors?: { reports?: unknown } }).errors?.reports : 0
      if (!(Number(want) > 0) || !on()) return say('health: not wanted')
      const sent = await fetch(`${to}?${new URLSearchParams(told)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) })
      say(`health: ${sent.ok ? 'sent' : `not sent (${sent.status})`}, ${body.errors.length} errors, ${body.looks} looks`)
    } catch {
      say('health: not sent, no answer')
    }
  }
  const timer = setInterval(() => void check(), CHECK)
  return { stop: () => clearInterval(timer) }
}

// The addon's log of the participation programme (addon/TwinmapForever/Log.lua): what the addon
// wrote down by itself, a session at a time, in the settings the game saves for it. The game writes
// that file at logout or /reload. It is read here when the app starts and each time it changes,
// and the sessions not sent yet are sent (server/src/index.ts, /log), after asking the server
// whether it wants any. A session that could not be sent stays in the file and goes at the next
// read. Nothing is ever changed in the game's file: the addon lets go of the oldest sessions itself.
// With the choice off the file is not even read.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const LOG_TO = 'https://api.twinmap.app/log'
const LARGEST = 200_000 // bytes of a session the server takes
const REMEMBERED = 500 // sessions known as sent: an account keeps ten in its file
const LOOK_EVERY = 5000 // ms between two looks at whether the game wrote its files

export interface Session {
  id: string
  /** The session as the addon wrote it, which is how it is sent. */
  text: string
}

/**
 * The sessions in a file of saved settings. A session is a text the addon wrote whole, as JSON, so
 * the file is not read as Lua: every quoted text in it is looked at, and the ones that are a
 * session are taken. Whether a session holds only what it may is for the server to say.
 */
export function sessionsIn(saved: string): Session[] {
  const out: Session[] = []
  for (const [, quoted] of saved.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
    const text = quoted!.replace(/\\(.)/g, '$1')
    if (!text.startsWith('{"log":1,') || text.length > LARGEST) continue
    try {
      const id = (JSON.parse(text) as { id?: unknown }).id
      if (typeof id === 'string' && /^[0-9a-f]{16}$/.test(id)) out.push({ id, text })
    } catch {
      // cut short, or not a session
    }
  }
  return out
}

/** The addon's saved settings, one file for each account that played with it. */
export function logFiles(gameFolder: string): string[] {
  const accounts = join(gameFolder, '_forever_', 'WTF', 'Account')
  try {
    return readdirSync(accounts).map((account) => join(accounts, account, 'SavedVariables', 'TwinmapForever.lua')).filter((file) => existsSync(file))
  } catch {
    return []
  }
}

/**
 * Sends sessions while the choice stays on: first the server is asked how many it still wants today
 * from this version of the app. Gives the sessions that need not be sent again: the ones the
 * server took, and the ones it says are not a session, which no later send would get through.
 */
export async function sendLog(sessions: Session[], said: { app: string; build: string; locale: string }, on: () => boolean, to: string = LOG_TO): Promise<string[]> {
  const done: string[] = []
  try {
    const answer = await fetch(`${to.replace(/log$/, 'want')}?${new URLSearchParams({ app: said.app })}`, { signal: AbortSignal.timeout(15_000) })
    if (!answer.ok) return done
    // By kind of data: one that is not in the answer is not wanted, switched off on the server.
    let want = Number(((await answer.json()) as { log?: { sessions?: unknown } }).log?.sessions) || 0
    for (const session of sessions) {
      if (!(want-- > 0) || !on()) break
      const taken = await fetch(`${to}?${new URLSearchParams(said)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: session.text, signal: AbortSignal.timeout(15_000) })
      if (!taken.ok && taken.status !== 400) break
      done.push(session.id)
    }
  } catch {
    // no network: they go at the next read
  }
  return done
}

/**
 * Looks at the game's files now and whenever the game has written them. sentFile: where the app
 * keeps, in its own data, which sessions it sent. said: the version of the app, the build of the
 * game and its language, null while they are not known.
 */
export function startGameLog(gameFolder: () => string | null, sentFile: string, said: () => { app: string; build: string; locale: string } | null, on: () => boolean, say: (line: string) => void, to?: string): { stop: () => void } {
  let sent: string[] = []
  try {
    const read: unknown = JSON.parse(readFileSync(sentFile, 'utf8'))
    if (Array.isArray(read)) sent = read.filter((id): id is string => typeof id === 'string')
  } catch {
    // nothing was sent yet
  }
  let seen = '', busy = false
  const look = async (): Promise<void> => {
    const folder = gameFolder()
    if (busy || !folder || !on()) return
    // As the game left them: a file is read again only when it was written again.
    const files = logFiles(folder), now = files.map((file) => `${file} ${statSync(file, { throwIfNoEntry: false })?.mtimeMs}`).join('\n')
    if (now === seen) return
    const told = said()
    if (!told) return
    seen = now
    busy = true
    try {
      const fresh = new Map<string, Session>()
      for (const file of files) {
        try {
          for (const session of sessionsIn(readFileSync(file, 'utf8'))) if (!sent.includes(session.id)) fresh.set(session.id, session)
        } catch {
          // being written: the next look has it
        }
      }
      if (fresh.size === 0) return
      const done = await sendLog([...fresh.values()], told, on, to)
      if (done.length > 0) {
        sent = [...sent, ...done].slice(-REMEMBERED)
        writeFileSync(sentFile, JSON.stringify(sent))
      }
      say(`log: ${done.length} of ${fresh.size} sessions sent`)
    } finally {
      busy = false
    }
  }
  const again = (): void => void look().catch(() => {}) // a file that went meanwhile, a disk that is full: the next look
  again()
  const timer = setInterval(again, LOOK_EVERY)
  return { stop: () => clearInterval(timer) }
}

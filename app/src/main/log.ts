// The app's own record of what happened to it: started, game found or not, addon, map, link, updates.
// A file in the app's folder, for the player to copy into a report. No positions, no characters.
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { nameless } from '../shared/feedback'

const KEPT = 200 // lines given back to the player, the latest
const TOO_BIG = 256 * 1024 // bytes after which the older half of the file is dropped, at start

export interface Log {
  /** Writes a line, with the time. */
  say: (line: string) => void
  /** Writes a line under a subject only when it differs from the last one said under it. */
  note: (subject: string, line: string) => void
  /** The latest lines, with the name of the Windows account left out of any folder. */
  read: () => string
}

export function startLog(file: string): Log {
  try {
    if (existsSync(file) && statSync(file).size > TOO_BIG) {
      const lines = readFileSync(file, 'utf8').split('\n')
      writeFileSync(file, lines.slice(Math.floor(lines.length / 2)).join('\n'))
    }
  } catch {
    // a record that cannot be trimmed is still a record
  }
  const said = new Map<string, string>()
  const say = (line: string): void => {
    try {
      appendFileSync(file, `${new Date().toISOString()} ${line.replace(/\s+/g, ' ')}\n`)
    } catch {
      // not being able to write the record is no reason to stop
    }
  }
  return {
    say,
    note: (subject, line) => {
      if (said.get(subject) === line) return
      said.set(subject, line)
      say(`${subject}: ${line}`)
    },
    read: () => {
      try {
        return nameless(readFileSync(file, 'utf8').trimEnd().split('\n').slice(-KEPT).join('\n'))
      } catch {
        return ''
      }
    },
  }
}

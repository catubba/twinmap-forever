// Where the bosses die, for the participation programme (M15-F13): off until the player turns it on.
// Inside a dungeon each kill the addon tells (its section "kills", Bosses.lua) is kept, in memory
// only, with the place the minimap gave a moment before: the number of the fight, the dungeon, the
// picture of the level and the yards on it, and how like the picture the minimap was there. The rare
// creatures targeted in the run are kept too: they say which of them were there. When the character
// leaves, the run is one session of the same log the addon writes (gamelog.ts), with the app's
// version for the addon's: kinds and numbers, nothing else, and a number drawn anew for each run.
//   ["boss", seconds, fight, dungeon, picture, u, v, likeness]   the last four when a place was found
//   ["rare", seconds, creature, dungeon]
// seconds: since the run began, never the time of day.
import { randomBytes } from 'node:crypto'
import type { Session } from './gamelog'
import type { InsideReport } from './minimap'

const FRESH = 10_000 // ms: a place older than this at a kill is no place of it

type Entry = (string | number)[]
interface Run {
  dungeon: number
  began: number
  entries: Entry[]
  rares: Set<number>
  place?: { at: number; picture: number; u: number; v: number; score: number }
}

const numbers = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : [])
const tenth = (n: number): number => Math.round(n * 10) / 10

/**
 * take(): what each look at the minimap came to (null out of a dungeon), as samples.ts has it; it
 * gives the session of a run when the run ends, if anything happened in it. kills(): the section
 * "kills" each time it is read off the strip. A kill is a fight that was not in the section read
 * before: the first section the app reads tells nothing new, so a run under way when the app opens
 * keeps what was killed before it. With the choice off nothing is kept and nothing is given.
 */
export function startBosses(on: () => boolean, version: string): { take: (report: InsideReport | null, now: number) => Session | null; kills: (section: unknown, now: number) => void } {
  let run: Run | null = null
  let before: { map: unknown; ids: number[] } | null = null
  const seconds = (r: Run, now: number): number => Math.max(0, Math.floor((now - r.began) / 1000))
  return {
    take(report, now) {
      const done = run && report?.dungeon !== run.dungeon ? run : null
      if (done) run = null
      if (!on()) return (run = null), null
      if (report) {
        run ??= { dungeon: report.dungeon, began: now, entries: [], rares: new Set() }
        if (report.place && report.picture !== undefined) run.place = { at: now, picture: report.picture, u: tenth(report.place.u), v: tenth(report.place.v), score: Math.round(report.place.score * 1000) / 1000 }
      }
      if (!done) return null
      const entries = [...done.entries, ...[...done.rares].map((npc): Entry => ['rare', seconds(done, now), npc, done.dungeon])]
      if (entries.length === 0) return null
      const id = randomBytes(8).toString('hex')
      return { id, text: JSON.stringify({ log: 1, id, v: version, e: entries }) }
    },
    kills(section, now) {
      const told = (typeof section === 'object' && section ? section : {}) as { map?: unknown; ids?: unknown; rares?: unknown }
      const ids = numbers(told.ids), was = before
      before = { map: told.map, ids }
      if (!run || !on() || told.map !== run.dungeon) return
      for (const npc of numbers(told.rares)) run.rares.add(npc)
      if (!was || was.map !== told.map) return
      const p = run.place && now - run.place.at <= FRESH ? run.place : undefined
      for (const fight of ids) if (!was.ids.includes(fight)) run.entries.push(['boss', seconds(run, now), fight, run.dungeon, ...(p ? [p.picture, p.u, p.v, p.score] : [])])
    },
  }
}

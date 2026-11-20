// Where the bosses die, for the participation programme (M15-F13): off until the player turns it on.
// Inside a dungeon each kill the addon tells (its section "kills", Bosses.lua) is kept, in memory
// only, with the place the minimap gave a moment before: the number of the fight, the dungeon, the
// picture of the level and the yards on it, and how like the picture the minimap was there. Every
// kill, of the bosses the app has a pin for too: many kills put a pin where the boss really is, and a
// boss with no pin gets one. The rare creatures are kept the same way, when first targeted and when
// seen dead. When the character leaves, the run is one session of the same log the addon writes
// (gamelog.ts), with the app's version for the addon's: kinds and numbers, nothing else, and a number
// drawn anew for each run. The worker takes out those of a dungeon its rules leave out.
//   ["boss", seconds, fight, dungeon, picture, u, v, likeness]      the last four when a place was found
//   ["rare", seconds, creature, dungeon, 1 seen dead or 0 targeted, picture, u, v, likeness]
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
  let before: { map: unknown; ids: number[]; rares: number[]; slain: number[] } | null = null
  const seconds = (r: Run, now: number): number => Math.max(0, Math.floor((now - r.began) / 1000))
  return {
    take(report, now) {
      const done = run && report?.dungeon !== run.dungeon ? run : null
      if (done) run = null
      if (!on()) return (run = null), null
      if (report) {
        run ??= { dungeon: report.dungeon, began: now, entries: [] }
        if (report.place && report.picture !== undefined) run.place = { at: now, picture: report.picture, u: tenth(report.place.u), v: tenth(report.place.v), score: Math.round(report.place.score * 1000) / 1000 }
      }
      if (!done) return null
      if (done.entries.length === 0) return null
      const id = randomBytes(8).toString('hex')
      return { id, text: JSON.stringify({ log: 1, id, v: version, e: done.entries }) }
    },
    kills(section, now) {
      const told = (typeof section === 'object' && section ? section : {}) as { map?: unknown; ids?: unknown; rares?: unknown; slain?: unknown }
      const was = before, seen = { map: told.map, ids: numbers(told.ids), rares: numbers(told.rares), slain: numbers(told.slain) }
      before = seen
      if (!run || !on() || told.map !== run.dungeon || !was || was.map !== told.map) return
      const p = run.place && now - run.place.at <= FRESH ? run.place : undefined
      const place = p ? [p.picture, p.u, p.v, p.score] : [], s = seconds(run, now)
      for (const fight of seen.ids) if (!was.ids.includes(fight)) run.entries.push(['boss', s, fight, run.dungeon, ...place])
      for (const npc of seen.rares) if (!was.rares.includes(npc)) run.entries.push(['rare', s, npc, run.dungeon, 0, ...place])
      for (const npc of seen.slain) if (!was.slain.includes(npc)) run.entries.push(['rare', s, npc, run.dungeon, 1, ...place])
    },
  }
}

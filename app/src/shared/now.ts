// The Now panel: every quest of the log, the nearest first, and who is near. Every row has a place; how far and which way are worked out again with each
// reading of the position, while the order of the rows changes at most every few seconds.
import { UNITS_PER_BLOCK, unitsOfPlace, type Point } from './geo'
import type { Continent, GameMap } from './maps'
import type { LogQuest, QuestPin } from './quests'
import { serves, type FixedPin, type ServiceLayer } from './services'
import { BLOCK_YARDS } from './world'

const YARDS_PER_UNIT = BLOCK_YARDS / UNITS_PER_BLOCK

/** What a row is, which gives it its colour: a quest to take or to hand in, something to find, a service. */
export type RowTone = 'quest' | 'objective' | 'service'
export interface NowRow {
  /** The same from one reading to the next: the row keeps its place by it. */
  key: string
  name: string
  /** The word in the second cell: "Quest", "Hand in", "Vendor". */
  kind: string
  tone: RowTone
  continent: Continent
  /** Where it is, in map units (geo.ts). */
  at: Point
}

/** Where the character is, in map units, from what the addon tells: the zone's map and a percent of it. */
export function whereIs(maps: GameMap[], pos: { map?: number; x?: number; y?: number } | undefined): { zone: GameMap; continent: Continent; at: Point } | null {
  const zone = pos?.map === undefined ? undefined : maps.find((m) => m.id === pos.map)
  if (!zone?.rect || zone.continent === null || pos?.x === undefined || pos.y === undefined) return null
  return { zone, continent: zone.continent, at: unitsOfPlace(zone.rect, pos.x, pos.y) }
}

/** How far a place is, in yards, and which way: degrees clockwise from north, which is up on the map. */
export function wayOf(from: Point, to: Point): { yards: number; turn: number } {
  const dx = to.x - from.x, dy = to.y - from.y // y grows to the south
  return { yards: Math.hypot(dx, dy) * YARDS_PER_UNIT, turn: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360 }
}

const far = (from: Point, row: NowRow): number => Math.hypot(row.at.x - from.x, row.at.y - from.y)
const zonesByArea = (maps: GameMap[]): Map<number, GameMap> => new Map(maps.filter((m) => m.level === 'zone' && m.rect && m.area && m.continent !== null).map((m) => [m.area, m]))

/** A quest of the log with no pin on a map the app has: in a dungeon, or one Questie cannot place. */
export type PlacelessRow = Omit<NowRow, 'continent' | 'at'>

/**
 * Every quest of the log, as the journal of the game has them, however far. One row each, on the
 * nearest of its pins: those on the character's continent first, the nearest first; then those
 * with pins on the other continent only; and apart, those with no pin at all.
 */
export function questRows(log: LogQuest[], pins: QuestPin[], maps: GameMap[], continent: Continent, from: Point): { placed: NowRow[]; placeless: PlacelessRow[] } {
  const zones = zonesByArea(maps), best = new Map<string, NowRow>()
  for (const pin of pins) {
    const zone = zones.get(pin.area)
    if (pin.type === 'available' || !zone) continue
    const at = unitsOfPlace(zone.rect!, pin.x, pin.y)
    for (const quest of pin.quests) {
      const row: NowRow = { key: `q:${quest}`, name: quest, kind: pin.type === 'turnin' ? 'Hand in' : 'Objective', tone: pin.type === 'turnin' ? 'quest' : 'objective', continent: zone.continent!, at }
      const before = best.get(row.key), here = row.continent === continent
      if (!before || (here !== (before.continent === continent) ? here : here && far(from, row) < far(from, before))) best.set(row.key, row)
    }
  }
  const near: NowRow[] = [], away: NowRow[] = [], placeless: PlacelessRow[] = [], seen = new Set<string>()
  for (const quest of log) {
    const key = `q:${quest.name}`, row = best.get(key)
    if (seen.has(key)) continue // two quests of one name are one row
    seen.add(key)
    if (!row) placeless.push({ key, name: quest.name, kind: quest.done ? 'Hand in' : 'Objective', tone: quest.done ? 'quest' : 'objective' })
    else (row.continent === continent ? near : away).push(row)
  }
  return { placed: [...near.sort((a, b) => far(from, a) - far(from, b)), ...away], placeless }
}

// The word for each service, in the order they are told when someone offers several.
const WORDS: Record<ServiceLayer, string> = { flight: 'Flight', inn: 'Inn', bank: 'Bank', auction: 'Auction', stable: 'Stable', trainers: 'Trainer', repair: 'Repair', vendors: 'Vendor' }
const ORDER = Object.keys(WORDS) as ServiceLayer[]
// Ore and herbs have no word here: they are not someone to go to.
function serviceWord(pin: FixedPin): string | undefined {
  const layer = ORDER.find((l) => pin.layers.includes(l))
  return layer && WORDS[layer]
}

/**
 * Everything that can be near on the continents: who gives a quest Questie shows, and who offers a
 * service to the character's side. Laid on the map once, when the pins change, not with every step.
 */
export function nearbyRows(maps: GameMap[], quests: QuestPin[], fixed: FixedPin[], side: string | undefined): NowRow[] {
  const zones = zonesByArea(maps), rows: NowRow[] = []
  for (const pin of quests) {
    const zone = zones.get(pin.area)
    if (pin.type === 'available' && zone) rows.push({ key: `a:${pin.name}`, name: pin.name, kind: 'Quest', tone: 'quest', continent: zone.continent!, at: unitsOfPlace(zone.rect!, pin.x, pin.y) })
  }
  for (const pin of fixed) {
    const zone = zones.get(pin.area), kind = serviceWord(pin)
    if (kind && zone && serves(pin, side)) rows.push({ key: `s:${pin.name}`, name: pin.name, kind, tone: 'service', continent: zone.continent!, at: unitsOfPlace(zone.rect!, pin.x, pin.y) })
  }
  return rows
}

/** The nearest of the rows on the character's continent: each name once, on its nearest place. */
export function nearest(rows: NowRow[], continent: Continent, from: Point, most: number): NowRow[] {
  const best = new Map<string, NowRow>()
  for (const row of rows) {
    if (row.continent !== continent) continue
    const before = best.get(row.key)
    if (!before || far(from, row) < far(from, before)) best.set(row.key, row)
  }
  return [...best.values()].sort((a, b) => far(from, a) - far(from, b)).slice(0, most)
}

export const REORDER_EVERY = 5000 // ms: the rows change places no more often, so the eye finds them again

/**
 * The rows to show, in an order that holds: the fresh order is taken when the last is older than
 * REORDER_EVERY; until then the rows stay where they were (a row no longer among the fresh ones
 * goes, and its place closes up).
 */
export function steady(shown: { rows: NowRow[]; at: number } | null, fresh: NowRow[], now: number): { rows: NowRow[]; at: number } {
  if (!shown || !shown.rows.length || now - shown.at >= REORDER_EVERY) return { rows: fresh, at: now }
  const byKey = new Map(fresh.map((row) => [row.key, row]))
  return { rows: shown.rows.flatMap((row) => byKey.get(row.key) ?? []), at: shown.at }
}

// The way on foot as the window knows it: what it asks the main process for, what comes back, and
// how much of a way found is still ahead of the character.
import { UNITS_PER_BLOCK, type Point } from './geo'
import type { Continent } from './maps'
import { BLOCK_YARDS } from './world'

/** Two points of one continent, in map units. */
export interface WalkAsk {
  continent: Continent
  from: Point
  to: Point
}

/** The way between them, in map units, and how long it is; null where none was found. */
export type WalkPath = { points: Point[]; yards: number } | null

const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const point = (v: unknown): v is Point => typeof v === 'object' && v !== null && number((v as Point).x) && number((v as Point).y)

/** What the window asked, checked. */
export function walkAskFrom(asked: unknown): WalkAsk | null {
  if (typeof asked !== 'object' || !asked) return null
  const { continent, from, to } = asked as Record<string, unknown>
  return (continent === 0 || continent === 1) && point(from) && point(to) ? { continent, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } } : null
}

/**
 * From one point to many of the same continent, in map units. reach: how many yards the search
 * walks at most, as it prices them (a yard off the road counts for one and a half). With one end
 * alone the search is steered towards it, and a long reach costs little.
 */
export interface FarAsk {
  continent: Continent
  from: Point
  to: Point[]
  reach: number
}

/** By end, the yards on foot; null where no way was found within the reach. */
export type Far = (number | null)[]

const MOST_ENDS = 200

/** What the window asked, checked. */
export function farAskFrom(asked: unknown): FarAsk | null {
  if (typeof asked !== 'object' || !asked) return null
  const { continent, from, to, reach } = asked as Record<string, unknown>
  if ((continent !== 0 && continent !== 1) || !point(from) || !Array.isArray(to) || to.length > MOST_ENDS || !to.every(point) || !number(reach) || reach <= 0) return null
  return { continent, from: { x: from.x, y: from.y }, to: to.map((p: Point) => ({ x: p.x, y: p.y })), reach }
}

/**
 * The nearest first. Those a way on foot is known to come first, by its yards; the others after
 * them as the crow flies: they are past the reach of the search, or where no way leads. With no
 * way known at all (the answer has not come, there is no grid) that is the order of the crow.
 */
export function nearestOnFoot<T>(items: T[], foot: (item: T) => number | undefined, crow: (item: T) => number): T[] {
  return items
    .map((item) => ({ item, foot: foot(item), crow: crow(item) }))
    .sort((a, b) => (a.foot === undefined ? (b.foot === undefined ? a.crow - b.crow : 1) : b.foot === undefined ? -1 : a.foot - b.foot))
    .map((entry) => entry.item)
}

export const YARDS_PER_UNIT = BLOCK_YARDS / UNITS_PER_BLOCK

/**
 * What is left of a way for a character at `me`: from the nearest place on it to its end. off: how
 * many yards the character is from the way, which tells when to look for a new one.
 */
export function ahead(points: Point[], me: Point): { rest: Point[]; off: number } {
  if (points.length < 2) return { rest: points, off: points[0] ? Math.hypot(me.x - points[0].x, me.y - points[0].y) * YARDS_PER_UNIT : 0 }
  let best = { at: 0, on: points[0]!, d: Infinity }
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!, b = points[i + 1]!, dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy
    const t = length ? Math.max(0, Math.min(1, ((me.x - a.x) * dx + (me.y - a.y) * dy) / length)) : 0
    const on = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(me.x - on.x, me.y - on.y)
    if (d < best.d) best = { at: i, on, d }
  }
  return { rest: [best.on, ...points.slice(best.at + 1)], off: best.d * YARDS_PER_UNIT }
}

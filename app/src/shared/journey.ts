// The journey Shortest Path Forever guides in the game, as the addon tells it on the strip: read
// only, and shown whoever started it (Twinmap, the player in the game, another addon).
import { unitsOfWorld, type Point } from './geo'
import type { Continent } from './maps'
import { pinFrom, type Pin } from './send'

export interface Leg {
  /** As Shortest Path names it: "walk", "passage", "tram", "flight", "boat"... */
  mode: string
  /** The words of its tracker: "Walk to Deeprun Tram". */
  text: string
  /** Whole seconds, its wait included. */
  seconds: number
}

export type Journey =
  // Its first plan is still searched: nothing to read yet.
  | { loading: true }
  // goal: where it leads, as the game names the place; null when the strip told none that reads.
  | { loading?: false; name: string; owner: string; legs: Leg[]; left: number; goal: Pin | null }

const plain = (text: unknown, most: number): string =>
  typeof text === 'string' ? Array.from(text, (c) => (c < ' ' || c === '\x7f' ? ' ' : c)).join('').trim().slice(0, most) : ''
const seconds = (v: unknown): number => (typeof v === 'number' && v >= 0 && v < 1e6 ? Math.round(v) : 0)

/** The section as it came off the strip, checked; null when the game guides no journey, or has no Shortest Path. */
export function journeyFrom(section: unknown): Journey | null {
  if (typeof section !== 'object' || !section || Array.isArray(section)) return null
  const { loading, name, owner, legs, left, m, x, y } = section as Record<string, unknown>
  if (loading === true) return { loading: true }
  if (!Array.isArray(legs)) return null
  const read = legs.slice(0, 20).flatMap((leg: unknown): Leg[] => {
    const { mode, text, s } = (typeof leg === 'object' && leg ? leg : {}) as Record<string, unknown>
    const words = plain(text, 80)
    return words ? [{ mode: plain(mode, 20), text: words, seconds: seconds(s) }] : []
  })
  const title = plain(name, 80) || 'Journey'
  return { name: title, owner: plain(owner, 40), legs: read, left: seconds(left), goal: pinFrom({ m, x, y, name: title }) }
}

/** Who started it, for the player to read; nothing when it is Twinmap's own or the player's. "AdventureGuideForever" reads "Adventure Guide". */
export function startedBy(owner: string): string {
  if (!owner || owner === 'Twinmap') return ''
  return owner.replace(/Forever$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
}

/** "45 s", "4 min", "1 h 12 min". */
export function span(s: number): string {
  if (s < 60) return `${s} s`
  const minutes = Math.round(s / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/** A leg of the journey as it lies on the map: its mode, and its points in map units. A walk has its two ends only. */
export interface WayLeg {
  mode: string
  points: { continent: Continent; at: Point }[]
}

/** The legs of a journey with their points, as the addon read them off Shortest Path's own line, and the goal they led to. */
export interface Way {
  legs: WayLeg[]
  goal: Pin | null
}

/** The section as it came off the strip, checked: points in yards of the world become map units. null when there is none that reads. */
export function wayFrom(section: unknown): Way | null {
  if (typeof section !== 'object' || !section || Array.isArray(section)) return null
  const { legs, m, x, y } = section as Record<string, unknown>
  if (!Array.isArray(legs) || legs.length === 0 || legs.length > 30) return null
  const read: WayLeg[] = []
  for (const leg of legs as unknown[]) {
    const { mode, p } = (typeof leg === 'object' && leg ? leg : {}) as Record<string, unknown>
    if (typeof mode !== 'string' || !Array.isArray(p) || p.length < 6 || p.length % 3 !== 0 || p.length > 600) return null
    const points: WayLeg['points'] = []
    for (let i = 0; i < p.length; i += 3) {
      const [continent, north, west] = [p[i], p[i + 1], p[i + 2]] as unknown[]
      if ((continent !== 0 && continent !== 1) || typeof north !== 'number' || typeof west !== 'number' || !Number.isFinite(north) || !Number.isFinite(west)) return null
      points.push({ continent, at: unitsOfWorld(north, west) })
    }
    read.push({ mode: plain(mode, 20), points })
  }
  return { legs: read, goal: pinFrom({ m, x, y, name: 'Goal' }) }
}

/**
 * The legs still ahead on a journey, from a reading taken earlier on it: the last of them, as many
 * as the journey has left. null when the reading is of another journey (another goal), or the
 * journey was planned anew with other legs: then nothing of it can be trusted.
 */
export function legsAhead(journey: Journey | null, way: Way | null): WayLeg[] | null {
  if (!journey || journey.loading || !way || !journey.goal || !way.goal) return null
  if (way.goal.m !== journey.goal.m || way.goal.x !== journey.goal.x || way.goal.y !== journey.goal.y) return null
  const ahead = way.legs.slice(way.legs.length - journey.legs.length)
  if (journey.legs.length === 0 || ahead.length !== journey.legs.length) return null
  return ahead.every((leg, i) => leg.mode === journey.legs[i]!.mode) ? ahead : null
}

// The journey Shortest Path Forever guides in the game, as the addon tells it on the strip: read
// only, and shown whoever started it (Twinmap, the player in the game, another addon).
import { unitsOfPlace, type Point } from './geo'
import type { Continent, GameMap } from './maps'
import { pinFrom, type Pin } from './send'

export interface Leg {
  /** As Shortest Path names it: "walk", "passage", "tram", "flight", "boat"... */
  mode: string
  /** The words of its tracker: "Walk to Deeprun Tram". */
  text: string
  /** Whole seconds, its wait included. */
  seconds: number
  /** Where it starts and ends, as Shortest Path planned it: absent when it did not tell both. */
  ends?: [Pin, Pin]
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
    const { mode, text, s, p } = (typeof leg === 'object' && leg ? leg : {}) as Record<string, unknown>
    const words = plain(text, 80)
    if (!words) return []
    const told: Leg = { mode: plain(mode, 20), text: words, seconds: seconds(s) }
    const [a, b] = Array.isArray(p) && p.length === 6 ? [pinFrom({ m: p[0], x: p[1], y: p[2], name: '' }), pinFrom({ m: p[3], x: p[4], y: p[5], name: '' })] : []
    if (a && b) told.ends = [a, b]
    return [told]
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

/** A leg of the journey as it lies on the map: its mode, and where it starts and ends in map units. */
export interface WayLeg {
  mode: string
  points: { continent: Continent; at: Point }[]
}

/** The legs still ahead on the map, when every one of them has its ends on a map Twinmap draws; else null. */
export function legsOn(journey: Journey | null, maps: GameMap[]): WayLeg[] | null {
  if (!journey || journey.loading || journey.legs.length === 0) return null
  const legs: WayLeg[] = []
  for (const leg of journey.legs) {
    const points = (leg.ends ?? []).flatMap((end) => {
      const on = maps.find((m) => m.id === end.m)
      return on?.rect && on.continent !== null ? [{ continent: on.continent, at: unitsOfPlace(on.rect, end.x, end.y) }] : []
    })
    if (points.length !== 2) return null
    legs.push({ mode: leg.mode, points })
  }
  return legs
}

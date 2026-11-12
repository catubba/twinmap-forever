// The journey Shortest Path Forever guides in the game, as the addon tells it on the strip: read
// only, and shown whoever started it (Twinmap, the player in the game, another addon).

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
  | { loading?: false; name: string; owner: string; legs: Leg[]; left: number }

const plain = (text: unknown, most: number): string =>
  typeof text === 'string' ? Array.from(text, (c) => (c < ' ' || c === '\x7f' ? ' ' : c)).join('').trim().slice(0, most) : ''
const seconds = (v: unknown): number => (typeof v === 'number' && v >= 0 && v < 1e6 ? Math.round(v) : 0)

/** The section as it came off the strip, checked; null when the game guides no journey, or has no Shortest Path. */
export function journeyFrom(section: unknown): Journey | null {
  if (typeof section !== 'object' || !section || Array.isArray(section)) return null
  const { loading, name, owner, legs, left } = section as Record<string, unknown>
  if (loading === true) return { loading: true }
  if (!Array.isArray(legs)) return null
  const read = legs.slice(0, 20).flatMap((leg: unknown): Leg[] => {
    const { mode, text, s } = (typeof leg === 'object' && leg ? leg : {}) as Record<string, unknown>
    const words = plain(text, 80)
    return words ? [{ mode: plain(mode, 20), text: words, seconds: seconds(s) }] : []
  })
  return { name: plain(name, 80) || 'Journey', owner: plain(owner, 40), legs: read, left: seconds(left) }
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

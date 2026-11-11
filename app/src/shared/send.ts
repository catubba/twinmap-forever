// Sending to the game, as the window sees it: what a pin is, what the addon tells of its inbox, and
// whether a send can go now.

/** A point to mark in the game: the game's number of a zone map, and the place on it in percent. */
export interface Pin {
  m: number
  x: number
  y: number
  name: string
}

const NAME_MAX = 80
const percent = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 100

/** A pin as the window asked for it, checked. The name is made plain text: no control characters, and "|" starts the game's escapes. */
export function pinFrom(asked: unknown): Pin | null {
  if (typeof asked !== 'object' || !asked) return null
  const { m, x, y, name } = asked as Record<string, unknown>
  if (!Number.isInteger(m) || (m as number) <= 0 || !percent(x) || !percent(y) || typeof name !== 'string') return null
  const plain = Array.from(name, (c) => (c < ' ' || c === '\x7f' ? ' ' : c === '|' ? '/' : c)).join('').trim().slice(0, NAME_MAX)
  return { m: m as number, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, name: plain || 'Pin' }
}

/** What the addon tells of its inbox, on the strip. */
export interface Inbox {
  /** The number of the last send that arrived. */
  seq: number
  /** Sends too big for a font that the game can still take before a /reload. */
  left: number
  /** Why nothing can arrive in this session of the game, when so. */
  off?: string
}

/** The section as it came off the strip, checked. */
export function inboxFrom(section: unknown): Inbox | null {
  if (typeof section !== 'object' || !section) return null
  const { seq, left, off } = section as Record<string, unknown>
  if (typeof seq !== 'number' || typeof left !== 'number') return null
  return { seq, left, ...(typeof off === 'string' ? { off } : {}) }
}

/**
 * Whether a point can be sent now, and if not, why, in words for the player.
 * live: the strip is being read. inbox: what the addon last told. pin: the point lies on a zone map.
 */
export function sendState(live: boolean, inbox: Inbox | null, pin: boolean): { can: boolean; why: string } {
  if (!pin) return { can: false, why: 'This point is in no zone the game can mark.' }
  if (!live) return { can: false, why: 'The game is not connected.' }
  if (!inbox) return { can: false, why: 'The game is not listening yet. If this stays, update the addon and restart the game.' }
  if (inbox.off === 'slots used up') return { can: false, why: 'Type /reload in the game to send again.' }
  if (inbox.off) return { can: false, why: 'Restart the game once: its way back from Twinmap opens at the next start.' }
  return { can: true, why: '' }
}

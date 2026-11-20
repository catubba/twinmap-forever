// The characters the app knows, for the picker at the start of the top row: one for each sheet it
// keeps (shared/sheet.ts). The one shown is the one in game, unless the player picked another; a
// login, of the same character or another, brings the one in game back.
import type { Sheets } from './sheet'

export interface Known {
  key: string
  /** The class as the game's token ("WARLOCK"), and its colour. */
  class?: string
  color: string
  level?: number
  /** "Level 24 Gnome Warlock", as much of it as the sheet tells. */
  line: string
  /** The character in game now. */
  live: boolean
  /** When the app last heard of it, in milliseconds. */
  seen: number
}

// The colours the game gives the classes (visual-spec.md).
export const CLASS_COLORS: Record<string, string> = {
  WARRIOR: '#c79c6e', PALADIN: '#f58cba', HUNTER: '#abd473', ROGUE: '#fff569', PRIEST: '#ffffff',
  SHAMAN: '#0070de', MAGE: '#69ccf0', WARLOCK: '#9482c9', DRUID: '#ff7d0a',
}
// The race tokens whose name is not the token with spaces.
const RACES: Record<string, string> = { Scourge: 'Undead', NightElf: 'Night Elf' }

const word = (token: string): string => token.charAt(0) + token.slice(1).toLowerCase()
const spaced = (token: string): string => RACES[token] ?? token.replace(/([a-z])([A-Z])/g, '$1 $2')

/** The characters to pick from: the one in game first, then the others by when they were last seen. */
export function knownOf(sheets: Sheets, live: string | null): Known[] {
  const out: Known[] = Object.entries(sheets).map(([key, sheet]) => {
    const who = (sheet.pieces.who ?? {}) as { race?: unknown; class?: unknown; level?: unknown }
    const cls = typeof who.class === 'string' ? who.class : undefined
    const level = typeof who.level === 'number' ? who.level : undefined
    const line = [level !== undefined && `Level ${level}`, typeof who.race === 'string' && spaced(who.race), cls && word(cls)].filter(Boolean).join(' ')
    return { key, ...(cls && { class: cls }), color: (cls && CLASS_COLORS[cls]) ?? 'var(--text)', ...(level !== undefined && { level }), line, live: key === live, seen: Math.max(0, ...Object.values(sheet.at)) }
  })
  return out.sort((a, b) => Number(b.live) - Number(a.live) || b.seen - a.seen)
}

/** Whose sheet is shown: the one picked, if it is still kept; else the one in game; else the one seen last. */
export function shownOf(known: Known[], picked: string | null): Known | null {
  return known.find((k) => k.key === picked) ?? known.find((k) => k.live) ?? known[0] ?? null
}

/** How long ago, in words: "just now", "5 minutes ago", "3 hours ago", "2 days ago", "3 weeks ago". */
export function ago(then: number, now: number): string {
  const minutes = Math.floor((now - then) / 60_000)
  const say = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'} ago`
  if (minutes < 1) return 'just now'
  if (minutes < 60) return say(minutes, 'minute')
  if (minutes < 60 * 24) return say(Math.floor(minutes / 60), 'hour')
  if (minutes < 60 * 24 * 14) return say(Math.floor(minutes / (60 * 24)), 'day')
  return say(Math.floor(minutes / (60 * 24 * 7)), 'week')
}

/** The first name: what the way back to the character in game says. */
export const firstName = (key: string): string => key.split(' ')[0] ?? key

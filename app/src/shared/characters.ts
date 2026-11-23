// The characters the app knows, for the picker at the start of the top row: one for each sheet it
// keeps (shared/sheet.ts). The one shown is the one in game, unless the player picked another; a
// login, of the same character or another, brings the one in game back.
import { t, type Key } from './i18n'
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
// The races and classes by the game's tokens: the keys of their names. A token not listed (Forever's own) shows as written.
const RACES: Record<string, Key> = {
  Human: 'items.races.human', Orc: 'items.races.orc', Dwarf: 'items.races.dwarf', NightElf: 'items.races.nightElf',
  Scourge: 'items.races.undead', Tauren: 'items.races.tauren', Gnome: 'items.races.gnome', Troll: 'items.races.troll',
}
const CLASSES: Record<string, Key> = {
  WARRIOR: 'items.classes.warrior', PALADIN: 'items.classes.paladin', HUNTER: 'items.classes.hunter', ROGUE: 'items.classes.rogue', PRIEST: 'items.classes.priest',
  SHAMAN: 'items.classes.shaman', MAGE: 'items.classes.mage', WARLOCK: 'items.classes.warlock', DRUID: 'items.classes.druid',
}
const CLASSES_ALL: Record<string, Key> = {
  WARRIOR: 'items.classesAll.warrior', PALADIN: 'items.classesAll.paladin', HUNTER: 'items.classesAll.hunter', ROGUE: 'items.classesAll.rogue', PRIEST: 'items.classesAll.priest',
  SHAMAN: 'items.classesAll.shaman', MAGE: 'items.classesAll.mage', WARLOCK: 'items.classesAll.warlock', DRUID: 'items.classesAll.druid',
}

const word = (token: string): string => token.charAt(0) + token.slice(1).toLowerCase()
const raceName = (token: string): string => (RACES[token] ? t(RACES[token]) : token.replace(/([a-z])([A-Z])/g, '$1 $2'))
/** A class by its token, one of them ("Warlock"). */
export const className = (token: string): string => (CLASSES[token] ? t(CLASSES[token]) : word(token))
/** A class by its token, all of them ("Warlocks"). */
export const classNameAll = (token: string): string => (CLASSES_ALL[token] ? t(CLASSES_ALL[token]) : `${word(token)}s`)

/** The characters to pick from: the one in game first, then the others by when they were last seen. */
export function knownOf(sheets: Sheets, live: string | null): Known[] {
  const out: Known[] = Object.entries(sheets).map(([key, sheet]) => {
    const who = (sheet.pieces.who ?? {}) as { race?: unknown; class?: unknown; level?: unknown }
    const cls = typeof who.class === 'string' ? who.class : undefined
    const level = typeof who.level === 'number' ? who.level : undefined
    const race = typeof who.race === 'string' ? raceName(who.race) : '', named = cls ? className(cls) : ''
    // Without a level, race and class alone; with one, the whole line, room left by a part not told taken away.
    const line = (level === undefined ? t('items.character.kind', { race, class: named }) : t('items.character.line', { level, race, class: named })).replace(/\s+/g, ' ').trim()
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
  if (minutes < 1) return t('items.ago.justNow')
  if (minutes < 60) return t('items.ago.minutes', { count: minutes })
  if (minutes < 60 * 24) return t('items.ago.hours', { count: Math.floor(minutes / 60) })
  if (minutes < 60 * 24 * 14) return t('items.ago.days', { count: Math.floor(minutes / (60 * 24)) })
  return t('items.ago.weeks', { count: Math.floor(minutes / (60 * 24 * 7)) })
}

/** The first name: what the way back to the character in game says. */
export const firstName = (key: string): string => key.split(' ')[0] ?? key

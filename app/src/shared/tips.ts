// The popup of an item (M10-F15, mockup design/vendors/mockup/popups.html): the lines of the game's own
// tooltip, which the addon reads once for each item met and sends with the sheet (Sheet.lua, the piece
// "tips"), kept by the app for good in a file of their own; under them what the app adds: who holds it,
// who sells it and where it drops. An item never met has only what the game's files say.
import { unitsOfPlace } from './geo'
import type { GameMap } from './maps'
import type { whereIs } from './now'
import { serves } from './services'
import type { Sheets } from './sheet'

/** A line of a tooltip: the left text and its colour ("rrggbb", "" for white), and a right side where there is one. */
export type TipLine = [string, string] | [string, string, string, string]
/**
 * By the item's key (Sheet.lua): "item:ID", or the whole link for one with a suffix or an enchant. Those of spells and talents
 * (M20-F16) are the character's own, so they are kept under its name: "spell:ID@name", "talent:node:rank@name".
 */
export type Tips = Record<string, TipLine[]>

const HEX = /^([0-9a-f]{6})?$/
const lineOf = (l: unknown): TipLine | null => {
  if (!Array.isArray(l) || typeof l[0] !== 'string' || !l[0] || typeof l[1] !== 'string' || !HEX.test(l[1])) return null
  if (typeof l[2] === 'string' && l[2] && typeof l[3] === 'string' && HEX.test(l[3])) return [l[0], l[1], l[2], l[3]]
  return [l[0], l[1]]
}

const OWN = /^(spell:\d+|talent:\d+:\d+)(@.+)?$/

/** The tooltips in what was read or sent, those of a shape the app does not know left out. who: the character whose sheet sent them. */
export function tipsFrom(value: unknown, who?: string): Tips {
  const out: Tips = {}
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out
  for (const [key, lines] of Object.entries(value)) {
    const own = OWN.exec(key)
    if (!(/^item:\d+/.test(key) || (own && (own[2] || who))) || !Array.isArray(lines)) continue
    const read = lines.map(lineOf).filter((l): l is TipLine => l !== null)
    if (read.length) out[own && !own[2] ? `${key}@${who}` : key] = read
  }
  return out
}

/** A line of space between the parts of a tooltip, as the game leaves one. */
export const GAP: TipLine = ['', '']

/** The words of the talent window around a talent's own lines, in the app's language. need: what it still asks, if anything. */
export interface TalentWords {
  rank: string
  next: string
  need?: string
}

/**
 * A talent's tooltip as the game's talent window shows it (seen in the game, 25 November 2026): its name, its rank, the
 * lines of the rank it has (of the first, not taken), then those of the next under "Next Rank:", and in red what it still
 * asks. Its own lines come from the addon (Sheet.lua, "talent:node:rank"); before they do, the name and the rank alone.
 */
export function talentLines(tips: Tips, who: string, talent: { node: number; name: string; rank: number; most: number }, words: TalentWords): TipLine[] {
  const at = (rank: number): TipLine[] => tips[`talent:${talent.node}:${rank}@${who}`] ?? []
  const out: TipLine[] = [[talent.name, ''], [words.rank, '']]
  const now = at(Math.max(talent.rank, 1)), next = talent.rank > 0 && talent.rank < talent.most ? at(talent.rank + 1) : []
  if (now.length) out.push(GAP, ...now)
  if (next.length) out.push(GAP, [words.next, ''], ...next)
  if (words.need) out.push(GAP, [words.need, 'ff2020'])
  return out
}

/** The key of an item held: the one the sheet carries, or "item:ID". */
export const tipKey = (item: number, key?: unknown): string => (typeof key === 'string' && key.startsWith(`item:${item}`) ? key : `item:${item}`)

/**
 * The lines to show: the durability as it is now, not as it was when the tooltip was read. In every language the line
 * is its word, then "now / most" ("Durability 50 / 60", "Прочность: 50 / 60"): the one whose most is the item's.
 */
export function shownLines(lines: TipLine[], wear?: { now?: number; most?: number }): TipLine[] {
  if (wear?.most === undefined || wear.now === undefined) return lines
  return lines.map((l) => {
    const m = /^(\D+?)\s*\d+ \/ (\d+)$/.exec(l[0])
    return m && Number(m[2]) === wear.most ? [`${m[1]} ${wear.now} / ${wear.most}`, l[1]] : l
  })
}

export interface Holder {
  key: string
  bags: number
  bank: number
  worn: number
}

type Slot = unknown[]
const slots = (piece: unknown, take: (bag: number) => boolean): Slot[] =>
  (Array.isArray(piece) ? piece : []).flatMap((c: { b?: unknown; s?: unknown }) => (take(Number(c?.b)) && Array.isArray(c?.s) ? (c.s as unknown[]).filter(Array.isArray) : []))

/** Who holds an item, and how many in the bags (the keyring and the reagent bag with them), in the bank and worn. */
export function holdersOf(sheets: Sheets, item: number): Holder[] {
  const out: Holder[] = []
  for (const [key, sheet] of Object.entries(sheets)) {
    const count = (list: Slot[]): number => list.reduce((n, s) => n + (s[1] === item ? Number(s[2]) || 1 : 0), 0)
    const bags = count(slots(sheet.pieces.bags, () => true))
    const bank = count(slots(sheet.pieces.bank, (b) => b >= 6))
    const worn = (Array.isArray(sheet.pieces.gear) ? sheet.pieces.gear : []).filter((g) => Array.isArray(g) && g[1] === item).length
    if (bags || bank || worn) out.push({ key, bags, bank, worn })
  }
  return out
}

/** Who sells an item, who drops it, where it is found (QuestieDB): names and places, a few of each. */
export interface ItemSources {
  sold: { npc: number; name: string; area: number; x: number; y: number; side?: string }[]
  drops: { name: string; area: number }[]
  found: { name: string; area: number }[]
}

/** A piece of a line in its colour ("rrggbb", "" for the line's own). */
export interface Piece {
  text: string
  color: string
}

/**
 * A line as the game writes it, in pieces of one colour each: "|cffRRGGBB" starts a colour and "|r"
 * ends it ("Made by" is written so); pictures ("|T...|t", "|A...|a") are left out, a link keeps its
 * words, "||" is a bar, "|n" a new line.
 */
export function piecesOf(text: string, color: string): Piece[] {
  const out: Piece[] = []
  let now = color
  const put = (t: string): void => {
    if (!t) return
    const last = out.at(-1)
    if (last && last.color === now) last.text += t
    else out.push({ text: t, color: now })
  }
  const clean = text.replace(/\|T[^|]*\|t|\|A[^|]*\|a|\|H[^|]*\|h|\|h/g, '')
  const marks = /\|c[0-9a-fA-F]{2}([0-9a-fA-F]{6})|\|r|\|\||\|n/g
  let from = 0
  for (const m of clean.matchAll(marks)) {
    put(clean.slice(from, m.index))
    if (m[0] === '||') put('|')
    else if (m[0] === '|n') put('\n')
    else now = m[1] ? m[1].toLowerCase() : color
    from = m.index + m[0].length
  }
  put(clean.slice(from))
  return out
}

/** The sellers of the character's side, the nearest first where it is on a map (far: Infinity elsewhere); the others after, as QuestieDB lists them. */
export function sellersOf(sold: ItemSources['sold'], side: string | undefined, zones: Map<number, GameMap>, here: ReturnType<typeof whereIs>): (ItemSources['sold'][number] & { far: number })[] {
  const far = (s: { area: number; x: number; y: number }): number => {
    const zone = zones.get(s.area)
    if (!here || !zone?.rect || zone.continent !== here.continent) return Infinity
    const at = unitsOfPlace(zone.rect, s.x, s.y)
    return Math.hypot(at.x - here.at.x, at.y - here.at.y)
  }
  return sold.filter((s) => serves(s, side)).map((s) => ({ ...s, far: far(s) })).sort((a, b) => a.far - b.far)
}

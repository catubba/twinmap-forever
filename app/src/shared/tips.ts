// The popup of an item (M10-F15, mockup design/vendors/mockup/popups.html): the lines of the game's own
// tooltip, which the addon reads once for each item met and sends with the sheet (Sheet.lua, the piece
// "tips"), kept by the app for good in a file of their own; under them what the app adds: who holds it,
// who sells it and where it drops. An item never met has only what the game's files say.
import type { Sheets } from './sheet'

/** A line of a tooltip: the left text and its colour ("rrggbb", "" for white), and a right side where there is one. */
export type TipLine = [string, string] | [string, string, string, string]
/** By the item's key (Sheet.lua): "item:ID", or the whole link for one with a suffix or an enchant. */
export type Tips = Record<string, TipLine[]>

const HEX = /^([0-9a-f]{6})?$/
const lineOf = (l: unknown): TipLine | null => {
  if (!Array.isArray(l) || typeof l[0] !== 'string' || !l[0] || typeof l[1] !== 'string' || !HEX.test(l[1])) return null
  if (typeof l[2] === 'string' && l[2] && typeof l[3] === 'string' && HEX.test(l[3])) return [l[0], l[1], l[2], l[3]]
  return [l[0], l[1]]
}

/** The tooltips in what was read or sent, those of a shape the app does not know left out. */
export function tipsFrom(value: unknown): Tips {
  const out: Tips = {}
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out
  for (const [key, lines] of Object.entries(value)) {
    if (!/^item:\d+/.test(key) || !Array.isArray(lines)) continue
    const read = lines.map(lineOf).filter((l): l is TipLine => l !== null)
    if (read.length) out[key] = read
  }
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
 * words, "||" is a bar.
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
  const marks = /\|c[0-9a-fA-F]{2}([0-9a-fA-F]{6})|\|r|\|\|/g
  let from = 0
  for (const m of clean.matchAll(marks)) {
    put(clean.slice(from, m.index))
    if (m[0] === '||') put('|')
    else now = m[1] ? m[1].toLowerCase() : color
    from = m.index + m[0].length
  }
  put(clean.slice(from))
  return out
}

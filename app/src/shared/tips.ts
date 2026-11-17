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

/** The lines to show: the durability as it is now, not as it was when the tooltip was read. */
export function shownLines(lines: TipLine[], wear?: { now?: number; most?: number }): TipLine[] {
  if (wear?.most === undefined || wear.now === undefined) return lines
  return lines.map((l) => (/^Durability \d+ \/ \d+$/.test(l[0]) ? [`Durability ${wear.now} / ${wear.most}`, l[1]] : l))
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

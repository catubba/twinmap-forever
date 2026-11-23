// The Items section: bags, bank, keyring and what is worn by a character, from the sheet the app
// keeps (sheet.ts), with what the game's own tables say of each item: name, quality, what a vendor
// gives for it, its type. Those come from the player's game (items.json, made beside the map by
// tiles-worker.ts): ItemSparse with the rows the server has sent over it, and Item for the type.
import { keyOfLink } from './ah'
import { langTag, t, type Key } from './i18n'
import type { Sheet, Sheets } from './sheet'
import { readHotfixes, readTable, type Table } from './wdc5'

export const ITEMS_FILE = 'items.json'
const ITEM_FILE = 841626 // class column 0, subclass column 1
const ITEM_SPARSE_FILE = 1572924
const ITEM_SPARSE_TABLE = 0x919be54e // its number among the server's rows (DBCache.bin)
const ITEM_SPARSE_TEXTS = [0, 1, 2, 3, 4] // description and the four names
const NAME = 4, STACK = 17, SELL = 22, BUY = 23, PER_BUY = 24, HOLIDAY = 37, ITEM_LEVEL = 50, LEVEL = 64, SLOT = 65, QUALITY = 66

/**
 * By the item's number: name, quality (0 poor to 7), sell price in copper, class, subclass, buy
 * price in copper (for perBuy of them), perBuy, the holiday (Holidays table) it is sold for, 0 if none;
 * then its item level, the level it asks for, where it is worn (the game's inventory type, 0 for
 * nowhere) and how many make a stack. The last four are missing from a file an older app made.
 */
export type ItemFacts = Record<string, [string, number, number, number, number, number, number, number, number?, number?, number?, number?]>
/** How many facts an item has: a file with fewer was made by an older app. */
export const FACTS = 12

/** What the game's tables say of every item. hotfixes: the server's rows of ItemSparse (null where taken away). */
export function itemFacts(item: Table, sparse: Table, hotfixes: Map<number, Buffer | null>): ItemFacts {
  const kind = new Map(item.rows.map((r) => [r.id, [r.int(0), r.int(1)] as const]))
  const rows = new Map(sparse.rows.map((r) => [r.id, r]))
  for (const [id, record] of hotfixes) {
    if (!record) rows.delete(id)
    else
      try {
        rows.set(id, sparse.rowOf!(id, record))
      } catch {
        // A row of some other shape: the game's own stays.
      }
  }
  const out: ItemFacts = {}
  for (const [id, r] of rows) {
    try {
      const [cls, sub] = kind.get(id) ?? [-1, 0]
      out[id] = [r.text(NAME), r.int(QUALITY), Math.max(0, r.int(SELL)), cls, sub, Math.max(0, r.int(BUY)), Math.max(1, r.int(PER_BUY)), r.int(HOLIDAY), r.int(ITEM_LEVEL), r.int(LEVEL), r.int(SLOT), Math.max(1, r.int(STACK))]
    } catch {
      // A row cut short: the item goes without its facts.
    }
  }
  return out
}

export interface ShopRow {
  id: number
  name: string
  quality: number
  /** In copper, for perBuy of them; null when the game has no row for the item (the server sends it when met). */
  buy: number | null
  perBuy: number
}

/** What a vendor sells (its items from QuestieDB, shops in questie.ts) by name; what is sold only on a holiday left out. */
export function shopRows(items: number[], facts: ItemFacts): ShopRow[] {
  return items
    .flatMap((id): ShopRow[] => {
      const f = facts[id]
      if (!f) return [{ id, name: t('items.unknownItem', { id }), quality: 1, buy: null, perBuy: 1 }]
      return f[7] ? [] : [{ id, name: f[0], quality: f[1], buy: f[5], perBuy: f[6] }]
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The facts of the player's game (ClientFiles of main), with the rows of the server's caches (DBCache.bin) over them; null without the tables.
 * sent: the caches in the game's language. elsewhere: those of other languages, for the items neither the tables nor sent have (new on
 * Forever, before the game has run in its language): a name in another language rather than none, never over one in the game's own.
 */
export function gameItemFacts(files: { read(id: number, skipHidden?: boolean): Buffer | null; opens(keyName: string): boolean }, sent: Buffer[], elsewhere: Buffer[] = []): ItemFacts | null {
  const item = files.read(ITEM_FILE, true), sparse = files.read(ITEM_SPARSE_FILE, true)
  if (!item || !sparse) return null
  const hotfixes = new Map(sent.flatMap((cache) => [...readHotfixes(cache, ITEM_SPARSE_TABLE)]))
  const opens = (keyName: string): boolean => files.opens(keyName)
  const names = readTable(sparse, opens, ITEM_SPARSE_TEXTS), known = new Set(names.rows.map((r) => r.id))
  for (const cache of elsewhere) for (const [id, row] of readHotfixes(cache, ITEM_SPARSE_TABLE)) if (!known.has(id) && !hotfixes.has(id)) hotfixes.set(id, row)
  return itemFacts(readTable(item, opens), names, hotfixes)
}

// The names the game gives the classes of items, and the subclasses of weapons and armour: their keys, by the game's numbers.
const CLASSES = ['consumable', 'container', 'weapon', 'gem', 'armor', 'reagent', 'projectile', 'tradeGoods', 'itemEnhancement', 'recipe', 'money', 'quiver', 'quest', 'key', 'permanent', 'miscellaneous'] as const
const WEAPONS = ['axe', 'axe', 'bow', 'gun', 'mace', 'mace', 'polearm', 'sword', 'sword', 'warglaive', 'staff', 'exotic', 'exotic', 'fistWeapon', 'miscellaneous', 'dagger', 'thrown', 'spear', 'crossbow', 'wand', 'fishingPole'] as const
const ARMOR = ['miscellaneous', 'cloth', 'leather', 'mail', 'plate', 'cosmetic', 'shield', 'libram', 'idol', 'totem', 'sigil', 'relic'] as const

/** "Armor · Cloth", "Weapon · Staff", "Trade Goods"; "Other" for what the game does not say. */
export function typeOf(cls: number, sub: number): string {
  const weapon = cls === 2 ? WEAPONS[sub] : undefined, armor = cls === 4 ? ARMOR[sub] : undefined, kind = CLASSES[cls]
  if (weapon) return t('items.types.weaponOf', { kind: t(`items.types.weapons.${weapon}`) })
  if (armor) return t('items.types.armorOf', { kind: t(`items.types.armors.${armor}`) })
  return kind ? t(`items.types.classes.${kind}`) : t('items.types.unknown')
}

export type Place = 'Bags' | 'Bank' | 'Worn' | 'Keyring'
export const PLACES: Place[] = ['Bags', 'Bank', 'Worn', 'Keyring']
const PLACE_KEYS: Record<Place, Key> = { Bags: 'items.places.bags', Bank: 'items.places.bank', Worn: 'items.places.worn', Keyring: 'items.places.keyring' }
/** A place as the player reads it: the Place itself is an id, compared in code. */
export const placeName = (place: Place): string => t(PLACE_KEYS[place])
const KEYRING = -1 // the keyring's container on Forever (Sheet.lua)

export interface ItemRow {
  id: number
  place: Place
  /** How many: stacks of the same item in the same place add up. */
  n: number
  name: string
  /** 0 poor to 7; 1 when the game does not say. */
  quality: number
  type: string
  /** What a vendor gives for all of them, in copper; 0 for what cannot be sold. */
  value: number
  /** What all of them fetch at the auction house at the lowest price of each one's kind, in copper; 0 for what is not on sale. */
  auction: number
}

type Held = { b?: unknown; s?: unknown }
const slotsOf = (piece: unknown): { bag: number; item: number; n: number; link?: unknown }[] =>
  (Array.isArray(piece) ? (piece as Held[]) : []).flatMap((c) =>
    Array.isArray(c?.s) ? (c.s as unknown[]).filter(Array.isArray).map((s) => ({ bag: Number(c.b), item: Number(s[1]), n: Number(s[2]) || 1, link: s[3] })) : [],
  )

/**
 * One row for each item in each place of a sheet. lowest: the auction house's lowest price of one of a
 * kind (shared/ah.ts), by its key; items of other kinds in a row each count at their own.
 */
export function itemRows(sheet: Sheet, facts: ItemFacts, lowest: (key: string) => number | undefined = () => undefined): ItemRow[] {
  const rows = new Map<string, ItemRow>()
  const add = (place: Place, id: number, n: number, link?: unknown): void => {
    if (!Number.isInteger(id) || id <= 0) return
    const auction = (lowest(keyOfLink(id, link)) ?? 0) * n
    const had = rows.get(`${place} ${id}`)
    if (had) return void ((had.n += n), (had.auction += auction))
    const [name, quality, sell, cls, sub] = facts[id] ?? [t('items.unknownItem', { id }), 1, 0, -1, 0]
    rows.set(`${place} ${id}`, { id, place, n, name, quality, type: typeOf(cls, sub), value: sell, auction })
  }
  for (const s of slotsOf(sheet.pieces.bags)) add(s.bag === KEYRING ? 'Keyring' : 'Bags', s.item, s.n, s.link)
  for (const s of slotsOf(sheet.pieces.bank)) add('Bank', s.item, s.n, s.link)
  for (const g of Array.isArray(sheet.pieces.gear) ? sheet.pieces.gear : []) if (Array.isArray(g)) add('Worn', Number(g[1]), 1, g[4])
  // The sell price is of one: the row is worth all of them.
  return [...rows.values()].map((r) => ({ ...r, value: r.value * r.n }))
}

export type Column = 'name' | 'type' | 'place' | 'n' | 'value' | 'auction'

/** The rows sorted by a column; ties by name. up: smallest first (A to Z), in the order of the language the app speaks. */
export function sortRows(rows: ItemRow[], column: Column, up: boolean): ItemRow[] {
  const words = new Intl.Collator(langTag())
  // Where: by the word shown, not by the place's id.
  const of = (r: ItemRow): string | number => (column === 'place' ? placeName(r.place) : r[column])
  const by = (a: ItemRow, b: ItemRow): number => {
    const x = of(a), y = of(b)
    return typeof x === 'number' && typeof y === 'number' ? x - y : words.compare(String(x), String(y))
  }
  return [...rows].sort((a, b) => (up ? by(a, b) : by(b, a)) || words.compare(a.name, b.name))
}

/** The rows whose name or type holds every word typed. */
export function filterRows(rows: ItemRow[], typed: string): ItemRow[] {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((r) => words.every((w) => r.name.toLowerCase().includes(w) || r.type.toLowerCase().includes(w)))
}

/** The other characters that hold what is typed: who, and the rows found. */
export function othersHolding(sheets: Sheets, shown: string, facts: ItemFacts, typed: string, lowest?: (key: string) => number | undefined): { key: string; rows: ItemRow[] }[] {
  if (!typed.trim()) return []
  return Object.entries(sheets)
    .filter(([key]) => key !== shown)
    .map(([key, sheet]) => ({ key, rows: filterRows(itemRows(sheet, facts, lowest), typed) }))
    .filter((o) => o.rows.length > 0)
}

/** Copper as gold, silver and copper: [amount, "g" | "s" | "c"], the empty ones left out. */
export function coins(copper: number): [number, 'g' | 's' | 'c'][] {
  const out: [number, 'g' | 's' | 'c'][] = [[Math.floor(copper / 10000), 'g'], [Math.floor(copper / 100) % 100, 's'], [copper % 100, 'c']]
  return out.filter(([n]) => n > 0)
}

/** The colours the game gives the qualities, poor to heirloom. */
export const QUALITY_COLORS = ['#9d9d9d', '#ffffff', '#1eff00', '#0070dd', '#a335ee', '#ff8000', '#e6cc80', '#00ccff']
/** The same as text in a list on the dark ground: the blue and the purple lighter, so they read (design/ah/mock.html). */
export const QUALITY_TEXT = ['#9d9d9d', '#ffffff', '#1eff00', '#3d9bff', '#b866f5', '#ff8000', '#e6cc80', '#00ccff']

// The page of slots (M10-F14): what is worn in the places the game's character window gives it,
// and the bags and the bank as grids, their items packed and the free slots at the end.

/** The game's equipment slots as its character window lays them: left column, right column, weapons; with the key of the word for an empty one. */
export const WORN_LEFT: [number, Key][] = [[1, 'items.slots.head'], [2, 'items.slots.neck'], [3, 'items.slots.shoulder'], [15, 'items.slots.back'], [5, 'items.slots.chest'], [4, 'items.slots.shirt'], [19, 'items.slots.tabard'], [9, 'items.slots.wrist']]
export const WORN_RIGHT: [number, Key][] = [[10, 'items.slots.hands'], [6, 'items.slots.waist'], [7, 'items.slots.legs'], [8, 'items.slots.feet'], [11, 'items.slots.ring'], [12, 'items.slots.ring'], [13, 'items.slots.trinket'], [14, 'items.slots.trinket']]
export const WORN_WEAPONS: [number, Key][] = [[16, 'items.slots.mainHand'], [17, 'items.slots.offHand'], [18, 'items.slots.ranged']]

export interface Worn {
  item: number
  /** The key of an item with a suffix or an enchant (Sheet.lua). */
  key?: string
  /** Durability now and at most; undefined for what does not wear. */
  now?: number
  most?: number
}

/** What a sheet says is worn, by the game's slot. */
export function wornOf(sheet: Sheet): Map<number, Worn> {
  const out = new Map<number, Worn>()
  for (const g of Array.isArray(sheet.pieces.gear) ? sheet.pieces.gear : []) {
    if (!Array.isArray(g) || !Number.isInteger(g[0]) || !Number.isInteger(g[1]) || g[1] <= 0) continue
    out.set(g[0], { item: g[1], ...(typeof g[2] === 'number' && typeof g[3] === 'number' && g[3] > 0 && { now: g[2], most: g[3] }), ...(typeof g[4] === 'string' && { key: g[4] }) })
  }
  return out
}

/** One cell of a grid: an item and how many, or a free slot. */
export type Cell = { item: number; n: number; key?: string } | null

export interface Grid {
  cells: Cell[]
  used: number
  slots: number
}

/** Containers as one grid: their items in the game's order (container, then slot), then the free slots. */
function gridOf(piece: unknown, take: (bag: number) => boolean): Grid {
  const cells: Cell[] = []
  let slots = 0
  const containers = (Array.isArray(piece) ? (piece as Held[]) : []).filter((c) => take(Number(c?.b))).sort((a, b) => Number(a.b) - Number(b.b))
  for (const c of containers) {
    slots += Math.max(0, Number((c as { n?: unknown }).n) || 0)
    const held = (Array.isArray(c.s) ? (c.s as unknown[]) : []).filter((s): s is [number, number, number, unknown] => Array.isArray(s) && Number.isInteger(s[1]) && (s[1] as number) > 0)
    for (const s of held.sort((a, b) => a[0] - b[0])) cells.push({ item: s[1], n: Number(s[2]) || 1, ...(typeof s[3] === 'string' && { key: s[3] }) })
  }
  const used = cells.length
  for (let i = used; i < slots; i++) cells.push(null)
  return { cells, used, slots: Math.max(slots, used) }
}

/** The grids of a sheet: backpack and bags as one, the reagent bag, the keyring, and the bank with its bags (6 and after on Forever). */
export function gridsOf(sheet: Sheet): { bags: Grid; reagents: Grid; keyring: Grid; bank: Grid } {
  return {
    bags: gridOf(sheet.pieces.bags, (b) => b >= 0 && b <= 4),
    reagents: gridOf(sheet.pieces.bags, (b) => b === 5),
    keyring: gridOf(sheet.pieces.bags, (b) => b === KEYRING),
    // An older addon sent the keyring with the bank too: the bank is 6 and after.
    bank: gridOf(sheet.pieces.bank, (b) => b >= 6),
  }
}

/** Whether an item's name or type holds every word typed; everything matches nothing typed. */
export function itemMatches(id: number, facts: ItemFacts, typed: string): boolean {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const [name, , , cls, sub] = facts[id] ?? [t('items.unknownItem', { id }), 1, 0, -1, 0]
  const type = typeOf(cls, sub).toLowerCase(), n = name.toLowerCase()
  return words.every((w) => n.includes(w) || type.includes(w))
}

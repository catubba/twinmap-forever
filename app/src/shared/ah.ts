// The Auction House section (M18-F7): which house the character sells at, its prices as
// prices.twinmap.app has them (written every hour by server/prices/prices.ts), the game's
// categories, the names of the kinds of an item, and the search over them.
import type { ItemFacts } from './items'
import { fold } from './search'
import { readTable, type Table } from './wdc5'

export const PRICES_URL = 'https://prices.twinmap.app/prices'
export const REGIONS = ['EU', 'US', 'KR', 'TW'] as const
export type Region = (typeof REGIONS)[number]

/** The rulesets a player can choose, by the API's number, with the names the game gives each in every language (design/bnet/rulesets.json). */
export const RULESETS: { id: number; name: string; names: string[] }[] = [
  { id: 2, name: 'Normal', names: ['Normal', 'Обычный', '일반', '普通'] },
  { id: 1, name: 'PvP', names: ['PvP', 'JcJ', 'JxJ'] },
  { id: 3, name: 'Roleplay', names: ['Roleplay', 'Juego de rol', 'Interpretação', 'Rollenspiel', 'Jeu de rôle', 'Ролевая игра', '롤플레이', '角色扮演'] },
  { id: 15, name: 'Roleplay PvP', names: ['Roleplay PvP', 'Juego de rol JcJ', 'Interpretação e JxJ', 'Rollenspiel (PvP)', 'Jeu de rôle JcJ', 'Ролевая игра с PvP', '롤플레이 PvP', '角色扮演PvP'] },
]

/**
 * The houses of each ruleset: Alliance, Horde, and the neutral one of Booty Bay, Gadgetzan and
 * Everlook (Blackwater). From the game's AuctionHouseRedirect, design/bnet/catalogo.md; Hardcore
 * (4) is closed. Written here by hand: changed by hand if Blizzard changes it.
 */
export const HOUSES: Record<number, [number, number, number]> = { 1: [110, 113, 116], 2: [111, 114, 117], 3: [119, 120, 121], 4: [112, 115, 118], 15: [123, 124, 125] }

/** A for the Alliance, H for the Horde, N for the neutral house. */
export type Side = 'A' | 'H' | 'N'
export const SIDES: Record<Side, string> = { A: 'Alliance', H: 'Horde', N: 'Neutral' }

export interface House {
  region: Region
  ruleset: number
  side: Side
}

export const houseNumber = (h: House): number => HOUSES[h.ruleset]?.[h.side === 'A' ? 0 : h.side === 'H' ? 1 : 2] ?? 0
export const rulesetName = (id: number): string => RULESETS.find((r) => r.id === id)?.name ?? `Ruleset ${id}`
/** "House 111 · Alliance · Normal". */
export const houseLine = (h: House): string => `House ${houseNumber(h)} · ${SIDES[h.side]} · ${rulesetName(h.ruleset)}`

/** The ruleset the game names so, in any of its languages; null for a name not known. */
export function rulesetOf(name: unknown): number | null {
  if (typeof name !== 'string') return null
  const wanted = name.trim().toLowerCase()
  return RULESETS.find((r) => r.names.some((n) => n.toLowerCase() === wanted))?.id ?? null
}

/** What the addon tells of the character that decides its house (Strip.lua, the part char). */
export interface HouseHints {
  region?: unknown
  rs?: unknown
  side?: unknown
  nh?: unknown
}

/** The house the character sells at, from what the game tells; null while the region, the ruleset or the side is not known. */
export function houseOf(hints: HouseHints | null | undefined): House | null {
  if (!hints) return null
  const region = REGIONS.find((r) => r === String(hints.region ?? '').toUpperCase()), ruleset = rulesetOf(hints.rs)
  const side: Side | null = hints.nh === true ? 'N' : hints.side === 'A' || hints.side === 'H' ? hints.side : null
  return region && ruleset && side ? { region, ruleset, side } : null
}

/** A house as kept, checked: what was kept by an older app, or by hand, may be anything. */
export function houseFrom(v: unknown): House | null {
  const h = v as Partial<House> | null
  if (!h || !REGIONS.includes(h.region as Region) || !HOUSES[h.ruleset as number] || !(h.side! in SIDES)) return null
  return { region: h.region as Region, ruleset: h.ruleset as number, side: h.side as Side }
}

/** The prices of a house as the bucket has them: by key, the lots on sale as [price of one in copper, how many], lots of one price added up. */
export interface Listing {
  region: string
  house: number
  name: string
  /** When Blizzard took the snapshot (ISO). */
  snapshot: string
  items: Record<string, [number, number][]>
}

/** A listing read from the bucket or the disk, checked; null for anything else. */
export function listingFrom(v: unknown): Listing | null {
  const l = v as Listing | null
  if (!l || typeof l !== 'object' || typeof l.region !== 'string' || !Number.isInteger(l.house) || typeof l.snapshot !== 'string' || Number.isNaN(Date.parse(l.snapshot))) return null
  if (!l.items || typeof l.items !== 'object' || Array.isArray(l.items)) return null
  return { region: l.region, house: l.house, name: typeof l.name === 'string' ? l.name : '', snapshot: l.snapshot, items: l.items }
}

/** What the window is told of the prices: the house asked for, its listing, when it was last asked for and what went wrong then. */
export interface PricesTold {
  region: string | null
  house: number | null
  listing: Listing | null
  /** When the bucket last answered (ms), null if never for this house. */
  checked: number | null
  error: string | null
}

/** How many days the app keeps what came from Blizzard's API at most: the chart goes back 7 (the terms would allow 30, design/product.md). */
export const KEEP_DAYS = 8

/** When the next prices should be on the bucket: an hour after the snapshot, and the time the hourly Action takes. */
export const nextPrices = (snapshot: string): number => Date.parse(snapshot) + 75 * 60_000

// The history of the prices (M18-F9), as server/prices/prices.ts writes it beside the listing.

/** Of one key in one snapshot: lowest, typical, how many. */
export type Point = [number, number, number]
/** prices/<region>/<house>/hours.json: the last 24 snapshots; a key not on sale in one has null there. */
export interface HoursFile {
  hours: string[]
  keys: Record<string, (Point | null)[]>
}
/** Of one key in one day: lowest of the day, mean typical, mean count, hours seen. */
export type DayPoint = [number, number, number, number]
/** prices/<region>/<house>/<YYYY-MM-DD>.json. */
export interface DayFile {
  day: string
  hours: string[]
  keys: Record<string, DayPoint>
}
/** What the chart of a key is drawn from: only the snapshots and the days it was really seen on sale. */
export interface History {
  hours: { at: string; p: Point }[]
  days: { day: string; p: DayPoint }[]
}

export function hoursFrom(v: unknown): HoursFile | null {
  const h = v as HoursFile | null
  return h && Array.isArray(h.hours) && h.hours.every((x) => typeof x === 'string') && h.keys && typeof h.keys === 'object' ? h : null
}
export function dayFrom(v: unknown, day: string): DayFile | null {
  const d = v as DayFile | null
  return d && d.day === day && Array.isArray(d.hours) && d.keys && typeof d.keys === 'object' ? d : null
}

/** Lowest, typical and how many from the lots of a key, as the server makes them. */
export const pointOf = (ladder: [number, number][]): Point => [Math.min(...ladder.map((l) => l[0])), typical([...ladder].sort((a, b) => a[0] - b[0])), ladder.reduce((n, [, q]) => n + q, 0)]

/** The hours file with a newer listing added at its end, as the next run of the server will write it. */
export function withListing(hours: HoursFile | null, listing: Listing | null): HoursFile | null {
  if (!listing || (hours && hours.hours.at(-1)! >= listing.snapshot)) return hours
  const before = hours ?? { hours: [], keys: {} }
  const keys: HoursFile['keys'] = {}
  for (const key of new Set([...Object.keys(before.keys), ...Object.keys(listing.items)])) {
    const lots = listing.items[key]
    keys[key] = [...(before.keys[key] ?? before.hours.map(() => null)), Array.isArray(lots) && lots.length ? pointOf(lots) : null].slice(-24)
  }
  return { hours: [...before.hours, listing.snapshot].slice(-24), keys }
}

/** The day of a key from the snapshots of that day in the hours, added up as the server adds up the day's file. */
export function dayOfHours(hours: HoursFile, key: string, day: string): DayPoint | null {
  let p: DayPoint | null = null
  hours.hours.forEach((at, i) => {
    const x = hours.keys[key]?.[i]
    if (!x || !at.startsWith(day)) return
    p = p ? [Math.min(p[0], x[0]), Math.round((p[1] * p[3] + x[1]) / (p[3] + 1)), Math.round((p[2] * p[3] + x[2]) / (p[3] + 1)), p[3] + 1] : [x[0], x[1], x[2], 1]
  })
  return p
}

/** The 7 days the chart shows, the last one the day of the snapshot (UTC, as the server names its files). */
export const chartDays = (snapshot: string): string[] => Array.from({ length: 7 }, (_, i) => new Date(Date.parse(snapshot.slice(0, 10)) - (6 - i) * 86_400_000).toISOString().slice(0, 10))

/** The history of a key: each hour and each day it was on sale. The day of the snapshot comes from the hours, the others from their files. */
export function historyOf(key: string, hours: HoursFile | null, days: Record<string, DayFile | null>, today: string | null): History {
  const out: History = { hours: [], days: [] }
  hours?.hours.forEach((at, i) => {
    const p = hours.keys[key]?.[i]
    if (p) out.hours.push({ at, p })
  })
  for (const day of Object.keys(days).sort()) {
    const p = day === today ? (hours ? dayOfHours(hours, key, day) : null) : (days[day]?.keys[key] ?? null)
    if (p) out.days.push({ day, p })
  }
  return out
}

// The names of the game's categories and of the kinds of items, from its tables (made beside items.json).
const ITEM_CLASS_FILE = 1140189 // ClassName, ClassID
const ITEM_SUBCLASS_FILE = 1261604 // DisplayName, VerboseName, ?, ClassID, SubClassID
const ITEM_BONUS_FILE = 959070 // Value[4], ParentItemBonusListID, Type, OrderIndex
const ITEM_NAME_DESCRIPTION_FILE = 1332559 // Description
const SUFFIX = 5 // a bonus of this type names the kind: its first value is a row of ItemNameDescription

export const AH_NAMES_FILE = 'ah-names.json'

export interface AhNames {
  /** The game's names of the classes of items, by class. */
  classes: Record<string, string>
  /** Of the subclasses, by "class.subclass": the longer one where the game has it ("One-Handed Axes"). */
  subs: Record<string, string>
  /** What a list of bonuses adds to the name of an item ("of the Eagle"), by the list's number. */
  suffixes: Record<string, string>
}

/** The names, from the game's tables. */
export function ahNames(classes: Table, subs: Table, bonus: Table, descriptions: Table): AhNames {
  const out: AhNames = { classes: {}, subs: {}, suffixes: {} }
  const text = (t: Table['rows'][number], field: number): string => {
    try {
      return t.text(field)
    } catch {
      return ''
    }
  }
  for (const r of classes.rows) out.classes[r.int(1)] = text(r, 0).replace(/\s*\(OBSOLETE\)$/i, '')
  for (const r of subs.rows) out.subs[`${r.int(3)}.${r.int(4)}`] = (text(r, 1) || text(r, 0)).replace(/\s*\(OBSOLETE\)$/i, '')
  const said = new Map(descriptions.rows.map((r) => [r.id, text(r, 0)]))
  for (const r of bonus.rows) {
    const named = r.int(2) === SUFFIX && said.get(r.int(0, 0))
    if (named) out.suffixes[r.int(1)] = named
  }
  return out
}

/** The names from the player's game; null without the tables. */
export function gameAhNames(files: { read(id: number, skipHidden?: boolean): Buffer | null; opens(keyName: string): boolean }): AhNames | null {
  const read = [ITEM_CLASS_FILE, ITEM_SUBCLASS_FILE, ITEM_BONUS_FILE, ITEM_NAME_DESCRIPTION_FILE].map((id) => files.read(id, true))
  if (read.some((b) => !b)) return null
  const opens = (keyName: string): boolean => files.opens(keyName)
  const [c, s, b, d] = read.map((bytes, i) => readTable(bytes!, opens, i === 0 ? [0] : i === 1 ? [0, 1] : i === 3 ? [0] : []))
  return ahNames(c!, s!, b!, d!)
}

/** One kind of an item on sale: the item alone, or with a list of bonuses ("of the Eagle"). */
export interface Kind {
  /** "6567", or "6567:12718" with its bonuses (the key of the bucket, design/bnet/catalogo.md). */
  key: string
  /** What the bonuses add to the name; "" for the item alone. */
  suffix: string
  lowest: number
  /** The price half of what is on sale costs less than: the median, weighed by how many. */
  typical: number
  available: number
  /** The lots, cheapest first. */
  ladder: [number, number][]
}

/** The median price of a ladder, weighed by how many are on sale at each price. */
export function typical(ladder: [number, number][]): number {
  const all = ladder.reduce((n, [, q]) => n + q, 0)
  let seen = 0
  for (const [price, q] of ladder) if ((seen += q) * 2 >= all) return price
  return ladder.at(-1)?.[0] ?? 0
}

/** What the bonuses of a key add to the name of the item ("of the Eagle"); "" for the item alone. */
export const suffixOf = (key: string, names: AhNames): string =>
  (key.split(':')[1] ?? '')
    .split('.')
    .map((b) => names.suffixes[b])
    .filter(Boolean)
    .join(' ')

/** An item of the house, with every kind of it on sale. */
export interface AhItem {
  id: number
  name: string
  quality: number
  cls: number
  sub: number
  /** Where it is worn, the game's inventory type; 0 for nowhere. */
  slot: number
  itemLevel: number
  /** The level it asks for; 0 for none. */
  level: number
  /** What a vendor gives for one. */
  vendor: number
  /** How many make a stack in the bags. */
  stack: number
  kinds: Kind[]
  lowest: number
  available: number
  /** The name and the kinds' full names, folded for the search. */
  folded: string[]
}

/** The items of a listing, with what the game says of each. An item the game has no row of goes by its number. */
export function ahItems(listing: Listing, facts: ItemFacts, names: AhNames): AhItem[] {
  const byId = new Map<number, Kind[]>()
  for (const [key, lots] of Object.entries(listing.items)) {
    const id = Number.parseInt(key, 10)
    if (!Number.isInteger(id) || !Array.isArray(lots)) continue
    const ladder = lots.filter((l): l is [number, number] => Array.isArray(l) && l[0]! > 0 && l[1]! > 0).sort((a, b) => a[0] - b[0])
    if (!ladder.length) continue
    const kind: Kind = { key, suffix: suffixOf(key, names), lowest: ladder[0]![0], typical: typical(ladder), available: ladder.reduce((n, [, q]) => n + q, 0), ladder }
    byId.set(id, [...(byId.get(id) ?? []), kind])
  }
  return [...byId].map(([id, kinds]) => {
    const f = facts[id]
    const name = f?.[0] ?? `Item ${id}`
    kinds.sort((a, b) => (a.suffix ? 1 : 0) - (b.suffix ? 1 : 0) || a.suffix.localeCompare(b.suffix) || a.key.localeCompare(b.key))
    return {
      id,
      name,
      quality: f?.[1] ?? 1,
      cls: f?.[3] ?? -1,
      sub: f?.[4] ?? 0,
      slot: f?.[10] ?? 0,
      itemLevel: f?.[8] ?? 0,
      level: f?.[9] ?? 0,
      vendor: f?.[2] ?? 0,
      stack: Math.max(1, f?.[11] ?? 1),
      kinds,
      lowest: Math.min(...kinds.map((k) => k.lowest)),
      available: kinds.reduce((n, k) => n + k.available, 0),
      folded: [fold(name), ...kinds.filter((k) => k.suffix).map((k) => fold(`${name} ${k.suffix}`))],
    }
  })
}

// The categories as the game's auction house lists them: the classes in its order, their
// subclasses, and for armour where it is worn.
const CLASS_ORDER = [2, 4, 1, 0, 7, 6, 11, 9, 5, 13, 15, 12]
const SLOTS: Record<number, string> = { 1: 'Head', 2: 'Neck', 3: 'Shoulder', 4: 'Shirt', 5: 'Chest', 6: 'Waist', 7: 'Legs', 8: 'Feet', 9: 'Wrist', 10: 'Hands', 11: 'Finger', 12: 'Trinket', 14: 'Off Hand', 16: 'Back', 19: 'Tabard', 20: 'Chest', 23: 'Held In Off-hand', 28: 'Relic' }
const SLOT_ORDER = [1, 2, 3, 16, 5, 4, 19, 9, 10, 6, 7, 8, 11, 12, 14, 23, 28]

export interface Category {
  /** "4", "4.1", "4.1.5": class, subclass, slot. */
  key: string
  name: string
  n: number
  kids: Category[]
}

/** The category keys of an item, from the widest: class, subclass, and the slot of armour. */
export function categoryKeys(item: Pick<AhItem, 'cls' | 'sub' | 'slot'>): string[] {
  const keys = [`${item.cls}`, `${item.cls}.${item.sub}`]
  if (item.cls === 4 && SLOTS[item.slot]) keys.push(`${item.cls}.${item.sub}.${item.slot === 20 ? 5 : item.slot}`)
  return keys
}

/** The categories that have something on sale, with how many items each has, in the game's order. */
export function categoriesOf(items: AhItem[], names: AhNames): Category[] {
  const n = new Map<string, number>()
  for (const it of items) for (const k of categoryKeys(it)) n.set(k, (n.get(k) ?? 0) + 1)
  const kids = (parent: string, name: (last: number) => string, order: (a: number, b: number) => number): Category[] =>
    [...n.keys()]
      .filter((k) => k.startsWith(`${parent}.`) && k.split('.').length === parent.split('.').length + 1)
      .map((k) => Number(k.split('.').at(-1)))
      .sort(order)
      .map((last) => {
        const key = `${parent}.${last}`
        return { key, name: name(last), n: n.get(key)!, kids: key.split('.').length === 2 && key.startsWith('4.') ? kids(key, (s) => SLOTS[s]!, (a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b)) : [] }
      })
  const classes = [...new Set(items.map((it) => it.cls))].sort((a, b) => (CLASS_ORDER.indexOf(a) + 1 || 99) - (CLASS_ORDER.indexOf(b) + 1 || 99) || a - b)
  return classes.map((cls) => ({
    key: `${cls}`,
    name: names.classes[cls] || (cls < 0 ? 'Other' : `Class ${cls}`),
    n: n.get(`${cls}`)!,
    kids: kids(`${cls}`, (sub) => names.subs[`${cls}.${sub}`] || `Subclass ${sub}`, (a, b) => a - b),
  }))
}

/** What the player narrows the list to. Prices in copper, levels as the game says them; undefined: no bound. */
export interface Filters {
  typed: string
  category: string | null
  minLevel?: number
  maxLevel?: number
  /** The least quality, 0 poor to 5 legendary. */
  quality?: number
  minPrice?: number
  maxPrice?: number
}

/** Whether two words are one letter apart: one changed, one more, one less, or two side by side swapped. */
export function oneApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (i === a.length && i === b.length) return true
  const rest = (x: number, y: number): boolean => a.slice(i + x) === b.slice(i + y)
  return rest(1, 1) || rest(1, 0) || rest(0, 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && rest(2, 2))
}

/**
 * How well a folded name answers what was typed (folded), the lower the better; null: not at all.
 * Each word typed starts a word of the name (0), or, from four letters, is one letter away from its
 * start (1): "barbaic" finds Barbaric Battle Axe.
 */
export function nameRank(name: string, typed: string): number | null {
  const words = name.split(' ')
  let worst = 0
  for (const want of typed.split(' ').filter(Boolean)) {
    if (words.some((w) => w.startsWith(want))) continue
    if (want.length < 4 || !words.some((w) => [-1, 0, 1].some((d) => oneApart(w.slice(0, want.length + d), want)))) return null
    worst = 1
  }
  return worst
}

/** The quoted part of what was typed, for a name to match whole: "Linen Cloth" between quotes. */
const quoted = (typed: string): string | null => typed.trim().match(/^"(.*)"?$/)?.[1]?.replace(/"$/, '') ?? null

/** The items that answer the filters, the best answer first; without text typed, the most on sale first. */
export function search(items: AhItem[], f: Filters): AhItem[] {
  const exact = quoted(f.typed), wanted = fold(exact ?? f.typed)
  const hits: { it: AhItem; rank: number }[] = []
  for (const it of items) {
    if (f.category && !categoryKeys(it).includes(f.category)) continue
    if (f.minLevel !== undefined && it.level < f.minLevel) continue
    if (f.maxLevel !== undefined && it.level > f.maxLevel) continue
    if (f.quality !== undefined && it.quality < f.quality) continue
    if (f.minPrice !== undefined && it.lowest < f.minPrice) continue
    if (f.maxPrice !== undefined && it.lowest > f.maxPrice) continue
    let rank = 0
    if (wanted) {
      const ranks = it.folded.map((n) => (exact !== null ? (n === wanted ? 0 : null) : nameRank(n, wanted))).filter((r): r is number => r !== null)
      if (!ranks.length) continue
      rank = Math.min(...ranks)
    }
    hits.push({ it, rank })
  }
  return hits.sort((a, b) => a.rank - b.rank || b.it.available - a.it.available || a.it.name.localeCompare(b.it.name)).map((h) => h.it)
}

/** A price typed by the player in copper: "1g 50s", "75s", "30c", or a number of gold ("1.5"); undefined for nothing or nonsense. */
export function priceOf(typed: string): number | undefined {
  const t = typed.trim().toLowerCase()
  if (!t) return undefined
  if (/^\d+([.,]\d+)?$/.test(t)) return Math.round(Number(t.replace(',', '.')) * 10000)
  const parts = [...t.matchAll(/(\d+)\s*([gsc])/g)]
  if (!parts.length || parts.map((p) => p[0]).join('').replace(/\s/g, '') !== t.replace(/\s/g, '')) return undefined
  return parts.reduce((n, [, v, c]) => n + Number(v) * (c === 'g' ? 10000 : c === 's' ? 100 : 1), 0)
}

// What the player owns (M18-F8): the items of every character of the house, with the price of their kind.

/** The key of the bucket of an item held, from the link the addon keeps of it (Sheet.lua, KeyOf): field 13 is how many bonuses, then the bonuses. */
export function keyOfLink(item: number, link?: unknown): string {
  const f = typeof link === 'string' ? link.split(':') : []
  const n = Number(f[13]) || 0
  return n > 0 ? `${item}:${f.slice(14, 14 + n).join('.')}` : `${item}`
}

/** The lowest price of one of a kind on sale; undefined for what is not on sale. */
export function lowestOf(listing: Listing | null | undefined, key: string): number | undefined {
  const lots = listing?.items[key]
  if (!Array.isArray(lots) || !lots.length) return undefined
  return Math.min(...lots.map((l) => l[0]))
}

/** Where a character's own house is: the house of its region, ruleset and side, never the neutral one. */
export type Home = Omit<House, 'side'> & { side: 'A' | 'H' }

/** The home of the character in game, from what the addon tells; null while something is missing. */
export function homeOf(hints: HouseHints | null | undefined): Home | null {
  const h = houseOf(hints ? { ...hints, nh: false } : null)
  return h && h.side !== 'N' ? { ...h, side: h.side } : null
}

/** Whether a character of that home sells at the house: its own, or the neutral house of its ruleset. */
export const sellsAt = (home: Home, house: House): boolean => home.region === house.region && home.ruleset === house.ruleset && (house.side === 'N' || house.side === home.side)

/** The side of a race, by the game's token of it (Sheet.lua, who.race); undefined for a race not known here. */
export function sideOfRace(race: unknown): 'A' | 'H' | undefined {
  if (typeof race !== 'string') return undefined
  if (['Human', 'Dwarf', 'NightElf', 'Gnome', 'Draenei', 'Worgen', 'HighElf'].includes(race)) return 'A'
  if (['Orc', 'Scourge', 'Tauren', 'Troll', 'BloodElf', 'Goblin'].includes(race)) return 'H'
  return undefined
}

/**
 * Whether a character's items count at a house: by its home where the game told it, else by the side of
 * its race, taken to play on the house's region and ruleset (guessed: true). A race not known counts too.
 */
export function countsAt(home: Home | undefined, race: unknown, house: House): { counts: boolean; guessed: boolean } {
  if (home) return { counts: sellsAt(home, house), guessed: false }
  const side = sideOfRace(race)
  return { counts: house.side === 'N' || !side || side === house.side, guessed: true }
}

export type OwnedPlace = 'Bags' | 'Bank' | 'Worn'

/** One item a character holds: stacks of the same kind in the same place added up. */
export interface Owned {
  who: string
  place: OwnedPlace
  id: number
  key: string
  n: number
}

/** What a sheet holds that can be sold: bags (the keyring left out), bank, worn; by kind and place. */
export function ownedOf(who: string, pieces: Record<string, unknown>): Owned[] {
  const out = new Map<string, Owned>()
  const add = (place: OwnedPlace, id: unknown, n: unknown, link: unknown): void => {
    if (!Number.isInteger(id) || (id as number) <= 0) return
    const key = keyOfLink(id as number, link), at = `${place} ${key}`
    const had = out.get(at)
    if (had) had.n += Number(n) || 1
    else out.set(at, { who, place, id: id as number, key, n: Number(n) || 1 })
  }
  const containers = (piece: unknown, take: (bag: number) => boolean, place: OwnedPlace): void => {
    for (const c of Array.isArray(piece) ? (piece as { b?: unknown; s?: unknown }[]) : [])
      if (take(Number(c?.b)) && Array.isArray(c.s)) for (const s of c.s as unknown[]) if (Array.isArray(s)) add(place, s[1], s[2], s[3])
  }
  containers(pieces.bags, (b) => b >= 0 && b <= 5, 'Bags')
  containers(pieces.bank, (b) => b >= 6, 'Bank') // an older addon sent the keyring with the bank: the bank is 6 and after
  for (const g of Array.isArray(pieces.gear) ? pieces.gear : []) if (Array.isArray(g)) add('Worn', g[1], 1, g[4])
  return [...out.values()]
}

// Disenchanting, as Classic has it: for an uncommon item, dust, essence and now and then a shard by its
// item level; a rare one gives a shard, an epic one shards or Nexus Crystals. A weapon gives the
// essence where armour gives the dust, and the other way round.
const DUST = { strange: 10940, soul: 11083, vision: 11137, dream: 11176, illusion: 16204 }
const ESSENCE = { lesserMagic: 10938, greaterMagic: 10939, lesserAstral: 10998, greaterAstral: 11082, lesserMystic: 11134, greaterMystic: 11135, lesserNether: 11174, greaterNether: 11175, lesserEternal: 16202, greaterEternal: 16203 }
const SHARD = { smallGlimmering: 10978, largeGlimmering: 11084, smallGlowing: 11138, largeGlowing: 11139, smallRadiant: 11177, largeRadiant: 11178, smallBrilliant: 14343, largeBrilliant: 14344, nexus: 20725 }
type Draw = [item: number, chance: number, least: number, most: number]
// Uncommon: up to this item level, [dust, how many], [essence, how many], the chances of armour (dust, essence), and the shard with its chance.
const UNCOMMON: [number, Draw, Draw, Draw | null][] = [
  [15, [DUST.strange, 0.8, 1, 2], [ESSENCE.lesserMagic, 0.2, 1, 2], null],
  [20, [DUST.strange, 0.75, 2, 3], [ESSENCE.greaterMagic, 0.2, 1, 2], [SHARD.smallGlimmering, 0.05, 1, 1]],
  [25, [DUST.strange, 0.75, 4, 6], [ESSENCE.lesserAstral, 0.15, 1, 2], [SHARD.smallGlimmering, 0.1, 1, 1]],
  [30, [DUST.soul, 0.75, 1, 2], [ESSENCE.greaterAstral, 0.2, 1, 2], [SHARD.largeGlimmering, 0.05, 1, 1]],
  [35, [DUST.soul, 0.75, 2, 5], [ESSENCE.lesserMystic, 0.2, 1, 2], [SHARD.smallGlowing, 0.05, 1, 1]],
  [40, [DUST.vision, 0.75, 1, 2], [ESSENCE.greaterMystic, 0.2, 1, 2], [SHARD.largeGlowing, 0.05, 1, 1]],
  [45, [DUST.vision, 0.75, 2, 5], [ESSENCE.lesserNether, 0.2, 1, 2], [SHARD.smallRadiant, 0.05, 1, 1]],
  [50, [DUST.dream, 0.75, 1, 2], [ESSENCE.greaterNether, 0.2, 1, 2], [SHARD.largeRadiant, 0.05, 1, 1]],
  [55, [DUST.dream, 0.75, 2, 5], [ESSENCE.lesserEternal, 0.2, 1, 2], [SHARD.smallBrilliant, 0.05, 1, 1]],
  [60, [DUST.illusion, 0.75, 1, 2], [ESSENCE.greaterEternal, 0.2, 1, 2], [SHARD.largeBrilliant, 0.05, 1, 1]],
  [Infinity, [DUST.illusion, 0.75, 2, 5], [ESSENCE.greaterEternal, 0.2, 2, 3], [SHARD.largeBrilliant, 0.05, 1, 1]],
]
const RARE: [number, Draw[]][] = [
  [25, [[SHARD.smallGlimmering, 1, 1, 1]]],
  [30, [[SHARD.largeGlimmering, 1, 1, 1]]],
  [35, [[SHARD.smallGlowing, 1, 1, 1]]],
  [40, [[SHARD.largeGlowing, 1, 1, 1]]],
  [45, [[SHARD.smallRadiant, 1, 1, 1]]],
  [50, [[SHARD.largeRadiant, 1, 1, 1]]],
  [55, [[SHARD.smallBrilliant, 1, 1, 1]]],
  [Infinity, [[SHARD.largeBrilliant, 0.995, 1, 1], [SHARD.nexus, 0.005, 1, 1]]],
]
const EPIC: [number, Draw[]][] = [
  [45, [[SHARD.smallRadiant, 1, 2, 4]]],
  [50, [[SHARD.largeRadiant, 1, 2, 4]]],
  [55, [[SHARD.smallBrilliant, 1, 2, 4]]],
  [60, [[SHARD.nexus, 1, 1, 1]]],
  [Infinity, [[SHARD.nexus, 1, 1, 2]]],
]
const LEAST: Record<number, number> = { 2: 5, 3: 11, 4: 40 } // the lowest item level that gives anything, by quality

/** What disenchanting an item gives, with the chance of each draw; null for what cannot be disenchanted (not a weapon nor armour, or poor and common). */
export function disenchantOf(item: Pick<AhItem, 'cls' | 'quality' | 'itemLevel'>): Draw[] | null {
  if ((item.cls !== 2 && item.cls !== 4) || !LEAST[item.quality] || item.itemLevel < LEAST[item.quality]!) return null
  const level = item.itemLevel
  if (item.quality === 3) return RARE.find(([top]) => level <= top)![1]
  if (item.quality === 4) return EPIC.find(([top]) => level <= top)![1]
  const [, dust, essence, shard] = UNCOMMON.find(([top]) => level <= top)!
  const draws: Draw[] = item.cls === 2 ? [[dust[0], essence[1], dust[2], dust[3]], [essence[0], dust[1], essence[2], essence[3]]] : [dust, essence]
  return shard ? [...draws, shard] : draws
}

/** What disenchanting is worth on average at the house's lowest prices; null when something it gives is not on sale. */
export function disenchantValue(draws: Draw[] | null, listing: Listing | null | undefined): number | null {
  if (!draws) return null
  let worth = 0
  for (const [item, chance, least, most] of draws) {
    const price = lowestOf(listing, `${item}`)
    if (price === undefined) return null
    worth += chance * ((least + most) / 2) * price
  }
  return Math.round(worth)
}

/** What the auction house keeps of a sale (5%), so what reaches the seller of a lot sold at that price. */
export const afterCut = (price: number): number => Math.floor(price * 0.95)

// Alerts on prices (M18-F10): a character asks to be told when the lowest price of an item, or of
// one kind of it, goes below or above a price, or when it is on sale again after an hour with none.
// Checked against every listing of the house the alert was set at; met once, and then it stays met
// until it is removed.

export type AlertWhen = 'below' | 'above' | 'appears'
export const ALERT_WHEN: AlertWhen[] = ['below', 'above', 'appears']

export interface Alert {
  /** When it was set (ms): its name. */
  t: number
  /** The character it belongs to, as the game names it. */
  who: string
  region: string
  house: number
  item: number
  /** One kind of the item (its key in the listing), or null: any kind. */
  key: string | null
  /** The name to tell it by, with the kind's suffix. */
  name: string
  when: AlertWhen
  /** In copper; 0 for 'appears'. */
  price: number
  /** Told in the game too. */
  game: boolean
  /** The snapshot it was met at, null while waiting; and the lowest price then. */
  met: string | null
  at: number | null
  /** For 'appears': a listing of the house had none on sale since the alert was set. */
  away: boolean
}

/** An alert as a screen asks for it or the file kept it, checked; null for anything else. */
export function alertFrom(v: unknown): Alert | null {
  const a = v as Partial<Alert> | null
  if (!a || typeof a !== 'object') return null
  const key = a.key === null || a.key === undefined ? null : a.key
  if (!Number.isInteger(a.t) || typeof a.who !== 'string' || !a.who || a.who.length > 80 || typeof a.region !== 'string' || !/^[a-z]{2}$/i.test(a.region)) return null
  if (!Number.isInteger(a.house) || !Number.isInteger(a.item) || (a.item as number) <= 0 || !ALERT_WHEN.includes(a.when as AlertWhen)) return null
  if (key !== null && (typeof key !== 'string' || (key !== `${a.item}` && !key.startsWith(`${a.item}:`)) || !/^\d+(:\d+(\.\d+)*)?$/.test(key))) return null
  if (!Number.isInteger(a.price) || (a.price as number) < 0 || (a.when !== 'appears' && !a.price)) return null
  const met = typeof a.met === 'string' && !Number.isNaN(Date.parse(a.met)) ? a.met : null
  return { t: a.t as number, who: a.who, region: a.region.toUpperCase(), house: a.house as number, item: a.item as number, key, name: typeof a.name === 'string' ? a.name.slice(0, 120) : `Item ${a.item}`, when: a.when as AlertWhen, price: a.when === 'appears' ? 0 : (a.price as number), game: a.game === true, met, at: met && Number.isInteger(a.at) ? (a.at as number) : null, away: a.away === true }
}

/** The lowest price an alert looks at in a listing: of its kind, or of any kind of its item. */
export function alertLowest(a: Pick<Alert, 'item' | 'key'>, listing: Listing | null | undefined): number | undefined {
  if (a.key !== null) return lowestOf(listing, a.key)
  const all = Object.keys(listing?.items ?? {}).filter((k) => k === `${a.item}` || k.startsWith(`${a.item}:`)).map((k) => lowestOf(listing, k)).filter((p) => p !== undefined)
  return all.length ? Math.min(...all) : undefined
}

/** The alert after a listing: met at its snapshot with the lowest price then, or away for 'appears' when none are on sale. A listing of another house changes nothing. */
export function alertAfter(a: Alert, listing: Listing | null | undefined): Alert {
  if (a.met || !listing || listing.region.toUpperCase() !== a.region || listing.house !== a.house) return a
  const lowest = alertLowest(a, listing)
  if (lowest === undefined) return a.when === 'appears' && !a.away ? { ...a, away: true } : a
  const met = a.when === 'appears' ? a.away : a.when === 'below' ? lowest < a.price : lowest > a.price
  return met ? { ...a, met: listing.snapshot, at: lowest } : a
}

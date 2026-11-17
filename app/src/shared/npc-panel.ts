// What the panel of a vendor or a trainer shows for the character picked (M10-F11): a vendor's items with their
// price and how many the character has in bags and bank; a trainer's spells or recipes in groups, what can be
// learned now first with its total, then each level or skill still to reach, and what is known apart.
import { itemRows, shopRows, type ItemFacts, type ShopRow } from './items'
import { PROFESSION_TRAINERS } from './profession-trainers'
import type { Sheet } from './sheet'
import { CLASS_IDS, type ProfessionRank, type TrainerRow } from './trainers'

export interface VendorRow extends ShopRow {
  bags: number
  bank: number
}

/** What a vendor sells, by name, with how many of each the character has; none held without a sheet. */
export function vendorRows(sells: number[], facts: ItemFacts, sheet?: Sheet): VendorRow[] {
  const held = sheet ? itemRows(sheet, facts) : []
  const count = (id: number, place: string): number => held.find((r) => r.id === id && r.place === place)?.n ?? 0
  return shopRows(sells, facts).map((r) => ({ ...r, bags: count(r.id, 'Bags'), bank: count(r.id, 'Bank') }))
}

/** A heading of the trainer's list and its rows; cost: what its rows with a price ask in all. */
export interface Group {
  at: number
  cost: number
  rows: TrainerRow[]
}

export interface Grouped {
  now: Group
  later: Group[]
  known: TrainerRow[]
}

const priced = (r: TrainerRow): number => (r.talent || r.quest !== undefined ? 0 : (r.cost ?? 0))
const group = (at: number, rows: TrainerRow[]): Group => ({ at, cost: rows.reduce((n, r) => n + priced(r), 0), rows })

/** Rows in order of `at` (a level, a skill), split into known, open now (at reached) and the rest by `at`. */
export function grouped(rows: TrainerRow[], at: (r: TrainerRow) => number, reached: number, known: Set<number>): Grouped {
  const open = rows.filter((r) => !known.has(r.spell))
  const later = new Map<number, TrainerRow[]>()
  for (const r of open) if (at(r) > reached) later.set(at(r), [...(later.get(at(r)) ?? []), r])
  return {
    now: group(reached, open.filter((r) => at(r) <= reached)),
    later: [...later].sort((a, b) => a[0] - b[0]).map(([n, rs]) => group(n, rs)),
    known: rows.filter((r) => known.has(r.spell)),
  }
}

/** The class token a class trainer teaches, from what the game writes under its name: "Warlock Trainer". */
export function trainerClass(sub: string | undefined): string | null {
  const token = /^(\w+) Trainer$/.exec(sub ?? '')?.[1]?.toUpperCase()
  return token && CLASS_IDS[token] ? token : null
}

// The races by the game's tokens, as the bits of SkillLineAbility's mask (bit 0 Human).
const RACE_BITS: Record<string, number> = { Human: 0, Orc: 1, Dwarf: 2, NightElf: 3, Scourge: 4, Tauren: 5, Gnome: 6, Troll: 7 }

export interface Who {
  name: string
  race?: string
  class?: string
  level?: number
}
export const whoOf = (sheet: Sheet | undefined): Who => {
  const w = (sheet?.pieces.who ?? {}) as Record<string, unknown>
  const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
  return { name: text(w.name) ?? '', race: text(w.race), class: text(w.class), level: typeof w.level === 'number' ? w.level : undefined }
}

/** The spells of the character's own race only: a mask of 0 is every race, and a race not listed (Forever's own) sees them all. */
export const forRace = (rows: TrainerRow[], race: string | undefined): TrainerRow[] => {
  const bit = race === undefined ? undefined : RACE_BITS[race]
  return bit === undefined ? rows : rows.filter((r) => !r.races || r.races & (1 << bit))
}

/** The spells the sheet says are known. */
export const knownSpells = (sheet: Sheet | undefined): Set<number> => new Set(Array.isArray(sheet?.pieces.spells) ? (sheet.pieces.spells as number[]) : [])

export interface Craft {
  /** Skill now and the most the rank allows; 0 and 0 when the character does not have the profession. */
  skill: number
  most: number
  /** The rank the character has, by the most skill it allows, and the next one this trainer teaches. */
  rank: string | null
  next: ProfessionRank | null
  /** Whether the recipes known were read: the profession's window was opened once. */
  read: boolean
  known: Set<number>
}

/** Where the character stands in a profession (by its skill line), from the sheet's skills and recipes. */
export function craftOf(sheet: Sheet | undefined, profession: string, ranks: ProfessionRank[]): Craft {
  const line = PROFESSION_TRAINERS[profession]?.skill
  const skills = Array.isArray(sheet?.pieces.skills) ? (sheet.pieces.skills as unknown[][]) : []
  const had = skills.find((s) => Array.isArray(s) && s[0] === line)
  const skill = Number(had?.[1]) || 0, most = Number(had?.[2]) || 0
  const recipes = (sheet?.pieces.recipes ?? {}) as { known?: unknown; seen?: unknown }
  const all = PROFESSION_TRAINERS[profession]?.ranks ?? []
  return {
    skill,
    most,
    rank: all.find((r) => r[2] === most)?.[0] ?? null,
    next: ranks.find((r) => r.most > most) ?? null,
    read: Array.isArray(recipes.seen) && recipes.seen.includes(line),
    known: new Set(Array.isArray(recipes.known) ? (recipes.known as number[]) : []),
  }
}

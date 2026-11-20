// What the trainers teach and at what cost, for the trainer panel (M10-F11).
// Class trainers: the spells of each class with the level they come at, from the player's own game
// (trainers.json, made beside the map by tiles-worker.ts): the abilities of the class's skill lines
// (SkillLineAbility), their level (SpellLevels), name and rank (SpellName, Spell), picture
// (SpellMisc), less the talents (Talent). The game has no costs: those come from a trainer seen in
// the game. Profession trainers: who teaches which rank and recipe and at what cost, from
// CMaNGOS classic-db by way of One for All (profession-trainers.ts).
// What the addon read at a trainer (its sheet piece "trainers", Sheet.lua) wins over both: what
// that trainer teaches, and the costs and levels of every trainer of the same class or profession.
// After the player's own reads, those of the participation programme (trainers-seen.ts): every
// trainer someone saw, the costs before any discount.
import { CLASS_QUESTS } from './class-quests'
import { PROFESSION_TRAINERS } from './profession-trainers'
import type { Sheets } from './sheet'
import { readTable, type Table } from './wdc5'

export const TRAINERS_FILE = 'trainers.json'
/** A file of another format was made by another app: made again. */
export const TRAINERS_FORMAT = 4

const SKILL_LINE_ABILITY = 1266278, SPELL_LEVELS = 1140079, SPELL_NAME = 1990283, SPELL = 1140089, SPELL_MISC = 1003144
const SKILL_RACE_CLASS = 1240406, TALENT = 1369062, SPELL_EFFECT = 1140088
// SkillLineAbility: skill line, spell, classes, how it is learned (0 at a trainer), races; SpellLevels: the level;
// SkillRaceClassInfo: the classes of a line and its flags (2: a pet's, as Beast Training); Talent: the spells of each rank;
// Spell: the rank ("Rank 2", "Passive"); SpellMisc: the picture.
const SLA_LINE = 3, SLA_SPELL = 4, SLA_CLASSES = 6, SLA_HOW = 8, SLA_RACES = 17, LEVEL = 4
const SRC_CLASSES = 1, SRC_FLAGS = 2, PET_LINE = 2, TALENT_RANKS = 11, RANK = 0, ICON = 10
// SpellEffect, by spell: what the effect does (24: makes an item) and the item.
const EFFECT_KIND = 3, EFFECT_ITEM = 10, MAKES_ITEM = 24

/** The class's number in the game by its token. */
export const CLASS_IDS: Record<string, number> = { WARRIOR: 1, PALADIN: 2, HUNTER: 3, ROGUE: 4, PRIEST: 5, SHAMAN: 7, MAGE: 8, WARLOCK: 9, DRUID: 11 }

/** A spell of a class: number, level, name, rank (0 none), races (0 all), 1 when a talent must be taken first, picture. */
export type ClassSpell = [number, number, string, number, number, 0 | 1, number]

export interface TrainerFacts {
  format: number
  /** By the class's number, by level. */
  classes: Record<string, ClassSpell[]>
  /** Name and picture of the recipes and ranks the profession trainers teach. */
  spells: Record<string, [string, number]>
  /** The item each spell of `spells` makes, if it makes one: a recipe's picture and quality are its item's. */
  makes: Record<string, number>
}

type Files = { read(id: number, skipHidden?: boolean): Buffer | null; opens(keyName: string): boolean }

/** What the player's game says of the trainers; null without its tables. */
export function trainerFacts(files: Files): TrainerFacts | null {
  const opens = (keyName: string): boolean => files.opens(keyName)
  const read = (id: number, texts: number[] = []): Table | null => {
    const b = files.read(id, true)
    return b && readTable(b, opens, texts)
  }
  const [sla, levels, names, spell, misc, lineClasses, talents, effects] = [
    read(SKILL_LINE_ABILITY), read(SPELL_LEVELS), read(SPELL_NAME), read(SPELL, [0, 1, 2]), read(SPELL_MISC), read(SKILL_RACE_CLASS), read(TALENT), read(SPELL_EFFECT),
  ]
  if (!sla || !levels || !names || !spell || !misc || !lineClasses || !talents || !effects) return null
  const name = new Map(names.rows.map((r) => [r.id, r.text(0)]))
  const rank = new Map(spell.rows.map((r) => [r.id, r.text(RANK)]))
  const level = new Map(levels.rows.map((r) => [r.parent, r.int(LEVEL)]))
  const icon = new Map(misc.rows.map((r) => [r.parent, r.int(ICON)]))
  const talent = new Set<number>()
  for (const r of talents.rows) for (let k = 0; k < 9; k++) if (r.int(TALENT_RANKS, k) > 0) talent.add(r.int(TALENT_RANKS, k))
  const talentNames = new Set([...talent].map((s) => name.get(s)))
  // A line of one class only, not its pet's: a line of several (Engraving) is no trainer's.
  const classOfLine = new Map<number, number>()
  for (const r of lineClasses.rows) {
    const id = Object.values(CLASS_IDS).find((c) => r.int(SRC_CLASSES) === 1 << (c - 1))
    if (r.parent !== undefined && id && !(r.int(SRC_FLAGS) & PET_LINE)) classOfLine.set(r.parent, id)
  }

  const classes: TrainerFacts['classes'] = {}, spells: TrainerFacts['spells'] = {}
  const named = (id: number): void => {
    const n = name.get(id)
    if (n) spells[id] = [n, icon.get(id) ?? 0]
  }
  const professionLines = new Set(Object.values(PROFESSION_TRAINERS).map((p) => p.skill))
  for (const r of sla.rows) {
    const cls = classOfLine.get(r.int(SLA_LINE)), id = r.int(SLA_SPELL), mask = r.int(SLA_CLASSES)
    // A name for every spell a trainer may show, also those left out of the lists below (a talent's rank, a recipe new on Forever).
    if (r.int(SLA_HOW) === 0 && (cls || professionLines.has(r.int(SLA_LINE)))) named(id)
    if (!cls || (mask !== 0 && !(mask & (1 << (cls - 1)))) || r.int(SLA_HOW) !== 0 || talent.has(id)) continue
    const n = name.get(id), lv = level.get(id), sub = rank.get(id) ?? ''
    // What comes with another spell or with a form is no trainer's: passives and effects.
    if (!n || !lv || sub === 'Passive' || / Effect$|\(Passive\)$/.test(n)) continue
    // A spell the game lists twice for a class (Consecration, Immolate 7) is one line.
    if (classes[cls]?.some((s) => s[0] === id)) continue
    // ponytail: the low 32 bits of the races only; Forever's Skyborne (bits 32 and 33) see the spells of every race.
    ;(classes[cls] ??= []).push([id, lv, n, Number(/^Rank (\d+)$/.exec(sub)?.[1] ?? 0), r.int(SLA_RACES) >>> 0, talentNames.has(n) ? 1 : 0, icon.get(id) ?? 0])
  }
  for (const list of Object.values(classes)) list.sort((a, b) => a[1] - b[1] || a[2].localeCompare(b[2]) || a[3] - b[3])

  for (const p of Object.values(PROFESSION_TRAINERS)) for (const id of [...p.ranks.map((r) => r[1]), ...p.teach.flatMap((t) => t[1])]) named(id)
  const makes: TrainerFacts['makes'] = {}
  for (const r of effects.rows) if (r.parent !== undefined && spells[r.parent] && r.int(EFFECT_KIND) === MAKES_ITEM && r.int(EFFECT_ITEM) > 0) makes[r.parent] ??= r.int(EFFECT_ITEM)
  return { format: TRAINERS_FORMAT, classes, spells, makes }
}

/** By profession: its skill line, its ranks (name, spell, most skill, cost, skill needed, level needed), which
 * ranks each trainer teaches (1 Apprentice, 2 Journeyman, 4 Expert, 8 Artisan), who teaches which recipes, and
 * each recipe's cost and the skill it needs. */
export type ProfessionTrainers = Record<
  string,
  {
    skill: number
    ranks: [string, number, number, number, number, number][]
    trainers: Record<string, number>
    teach: [number[], number[]][]
    fees: Record<string, number[]>
  }
>

/** A line as the addon read it at a trainer: spell, cost in copper, level needed, skill needed. */
export type ReadLine = [number, number, number, number]
/** What was read at one trainer: its NPC, the class token for a class trainer, its lines. */
export interface TrainerRead {
  n: number
  c?: string
  s: ReadLine[]
}

/** What the addon read at trainers, from every character's sheet, the newest first, then `seen` (trainers-seen.ts): by NPC, and each spell's line. */
export function trainerReads(sheets: Sheets, seen: TrainerRead[] = []): { trainers: Map<number, TrainerRead>; lines: Map<number, ReadLine> } {
  const trainers = new Map<number, TrainerRead>(), lines = new Map<number, ReadLine>()
  const sorted = Object.values(sheets).sort((a, b) => (b.at.trainers ?? 0) - (a.at.trainers ?? 0))
  for (const piece of [...sorted.map((sheet) => sheet.pieces.trainers), seen]) {
    for (const t of Array.isArray(piece) ? (piece as TrainerRead[]) : []) {
      if (!t || !Number.isInteger(t.n) || !Array.isArray(t.s)) continue
      const s = t.s.filter((l): l is ReadLine => Array.isArray(l) && Number.isInteger(l[0]) && Number.isInteger(l[1]))
      if (!trainers.has(t.n)) trainers.set(t.n, { n: t.n, ...(typeof t.c === 'string' && { c: t.c }), s })
      for (const l of s) if (!lines.has(l[0])) lines.set(l[0], l)
    }
  }
  return { trainers, lines }
}

export interface TrainerRow {
  spell: number
  name: string
  rank: number
  /** Level needed. */
  level: number
  /** Skill needed, for a recipe. */
  skill: number
  /** In copper; null when no trainer of it was seen and no list has it. */
  cost: number | null
  /** A talent must be taken first. */
  talent: boolean
  /** Taught by a quest, not the trainer: the quest's name, "" when it has none known (One for All's Data/TrainerSpells.lua). */
  quest?: string
  /** 0 all races; otherwise the game's bits of the races (Human 0, Orc 1, Dwarf 2, ...). */
  races: number
  icon: number
}

type Reads = ReturnType<typeof trainerReads>

/** What a class trainer teaches, by level: what the trainer itself showed when one was seen, the game's list otherwise. */
export function classTrainer(npc: number, cls: string, facts: TrainerFacts, reads: Reads): TrainerRow[] {
  const id = CLASS_IDS[cls]
  const list = (id && facts.classes[id]) || []
  const byId = new Map(list.map((s) => [s[0], s]))
  const row = (s: ClassSpell): TrainerRow => {
    const l = reads.lines.get(s[0])
    const quest = CLASS_QUESTS[s[0]]
    return { spell: s[0], name: s[2], rank: s[3], level: l?.[2] || s[1], skill: 0, cost: l ? l[1] : null, talent: s[5] === 1, races: s[4], icon: s[6], ...(quest !== undefined && { quest }) }
  }
  const seen = reads.trainers.get(npc)
  if (!seen) return list.map(row)
  return seen.s
    .map((l) => {
      const s = byId.get(l[0])
      return s ? row(s) : { spell: l[0], name: facts.spells[l[0]]?.[0] ?? `Spell ${l[0]}`, rank: 0, level: l[2], skill: 0, cost: l[1], talent: false, races: 0, icon: facts.spells[l[0]]?.[1] ?? 0 }
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name) || a.rank - b.rank)
}

export interface ProfessionRank {
  name: string
  spell: number
  /** The most skill it allows. */
  most: number
  cost: number | null
  skill: number
  level: number
}

/** What a profession trainer teaches: its profession, the ranks it gives and its recipes by skill needed; null for an NPC that is none. */
export function professionTrainer(npc: number, facts: TrainerFacts, reads: Reads): { profession: string; skill: number; ranks: ProfessionRank[]; rows: TrainerRow[] } | null {
  for (const [profession, p] of Object.entries(PROFESSION_TRAINERS)) {
    const gives = p.trainers[npc] ?? 0
    const recipes = p.teach.filter(([who]) => who.includes(npc)).flatMap(([, spells]) => spells)
    if (!gives && !recipes.length) continue
    const seen = reads.trainers.get(npc)
    const ranks = p.ranks
      .filter((_, i) => gives & (1 << i))
      .map(([name, spell, most, cost, skill, level]) => ({ name, spell, most, cost: reads.lines.get(spell)?.[1] ?? cost, skill, level }))
    const rankSpells = new Set(p.ranks.map((r) => r[1]))
    const taught = seen ? seen.s.map((l) => l[0]).filter((s) => !rankSpells.has(s)) : recipes
    const rows = taught.map((spell): TrainerRow => {
      const l = reads.lines.get(spell), fee = p.fees[spell]
      return {
        spell,
        name: facts.spells[spell]?.[0] ?? `Spell ${spell}`,
        rank: 0,
        level: l?.[2] ?? 0,
        skill: l?.[3] ?? fee?.[1] ?? 0,
        cost: l?.[1] ?? fee?.[0] ?? null,
        talent: false,
        races: 0,
        icon: facts.spells[spell]?.[1] ?? 0,
      }
    })
    rows.sort((a, b) => a.skill - b.skill || a.name.localeCompare(b.name))
    return { profession, skill: p.skill, ranks, rows }
  }
  return null
}

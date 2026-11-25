// The spells of the player's own game, for the panels that show what a character knows: Professions (M20-F10), and after
// it Spellbook and Talents. Made once for each build beside the map (spells.json, by tiles-worker.ts), in the game's
// language: every spell some skill line has (SkillLineAbility), with its name (SpellName), rank (Spell), picture and school
// (SpellMisc), the skill lines themselves (SkillLine), each line's abilities with the skill their colours change at, and the
// item a spell makes (SpellEffect). A spell's picture is drawn from its file like the trainers' ones: TILES/pictures/<file>.png.
import { readTable, type Table } from './wdc5'

export const SPELLS_FILE = 'spells.json'
/** A file of another format was made by another app: made again. */
export const SPELLS_FORMAT = 1

const SKILL_LINE = 1240935, SKILL_LINE_ABILITY = 1266278, SPELL_NAME = 1990283, SPELL = 1140089, SPELL_MISC = 1003144, SPELL_EFFECT = 1140088
// SkillLine: name (text 0), id, category, picture, parent line. SkillLineAbility: line, spell, skill it is yellow from and grey
// from, the heading a profession's window lists it under (its name is not in the files: the addon reads it), the line its
// skill-ups go to (the child line of a profession, as Classic Engineering: its recipes). Spell: the rank
// ("Rank 2", "Passive"). SpellMisc: school and picture. SpellEffect: what it does (24: makes an item) and the item.
const SL_ID = 5, SL_CATEGORY = 6, SL_ICON = 7, SL_PARENT = 9
const SLA_LINE = 3, SLA_SPELL = 4, SLA_GREY = 9, SLA_YELLOW = 10, SLA_HEADING = 14, SLA_UP = 15
const RANK = 0, SCHOOL = 6, ICON = 10, EFFECT_KIND = 3, EFFECT_ITEM = 10, MAKES_ITEM = 24

/** The categories of skill lines in the game. */
export const LINE = { weapons: 6, class: 7, armour: 8, secondary: 9, languages: 10, professions: 11 } as const

/** A spell: name, rank as the game words it ("Rank 2", "Passive", "" for none), its picture's file (0 none), school mask
 * (1 physical, 2 holy, 4 fire, 8 nature, 16 frost, 32 shadow, 64 arcane). */
export type SpellFact = [string, string, number, number]
/** A skill line: name, picture's file, category (LINE), parent line (0 none). */
export type LineFact = [string, number, number, number]
/** An ability of a line: spell, skill it is yellow from, grey from (0 and 0: no colours), the line its skill-ups go to (0 none),
 * the heading of a profession's window it comes under (0 none). */
export type Ability = [number, number, number, number, number]

export interface SpellFacts {
  format: number
  spells: Record<string, SpellFact>
  lines: Record<string, LineFact>
  /** By line, in the game's order. */
  abilities: Record<string, Ability[]>
  /** The item a spell makes, for the spells that make one: a recipe's picture and quality are its item's. */
  makes: Record<string, number>
}

type Files = { read(id: number, skipHidden?: boolean): Buffer | null; opens(keyName: string): boolean }

/** What the player's game says of its spells; null without its tables. */
export function spellFacts(files: Files): SpellFacts | null {
  const read = (id: number, texts: number[] = []): Table | null => {
    const b = files.read(id, true)
    return b && readTable(b, (keyName) => files.opens(keyName), texts)
  }
  const [lineRows, sla, names, spell, misc, effects] = [read(SKILL_LINE, [0, 1, 2, 3, 4]), read(SKILL_LINE_ABILITY), read(SPELL_NAME), read(SPELL, [0, 1, 2]), read(SPELL_MISC), read(SPELL_EFFECT)]
  if (!lineRows || !sla || !names || !spell || !misc || !effects) return null
  const text = (r: Table['rows'][number], field: number): string => {
    try {
      return r.text(field)
    } catch {
      return ''
    }
  }
  const name = new Map(names.rows.map((r) => [r.id, text(r, 0)]))
  const rank = new Map(spell.rows.map((r) => [r.id, text(r, RANK)]))
  const looks = new Map(misc.rows.filter((r) => r.parent !== undefined).map((r) => [r.parent!, [r.int(ICON), r.int(SCHOOL)] as const]))

  const lines: SpellFacts['lines'] = {}
  for (const r of lineRows.rows) lines[r.int(SL_ID) || r.id] = [text(r, 0), r.int(SL_ICON), r.int(SL_CATEGORY), r.int(SL_PARENT)]
  const spells: SpellFacts['spells'] = {}, abilities: SpellFacts['abilities'] = {}
  for (const r of sla.rows) {
    const id = r.int(SLA_SPELL), n = name.get(id)
    if (!n) continue
    const look = looks.get(id)
    spells[id] ??= [n, rank.get(id) ?? '', look?.[0] ?? 0, look?.[1] ?? 0]
    ;(abilities[r.int(SLA_LINE)] ??= []).push([id, r.int(SLA_YELLOW), r.int(SLA_GREY), r.int(SLA_UP), r.int(SLA_HEADING)])
  }
  const makes: SpellFacts['makes'] = {}
  for (const r of effects.rows) if (r.parent !== undefined && spells[r.parent] && r.int(EFFECT_KIND) === MAKES_ITEM && r.int(EFFECT_ITEM) > 0) makes[r.parent] ??= r.int(EFFECT_ITEM)
  return { format: SPELLS_FORMAT, spells, lines, abilities, makes }
}

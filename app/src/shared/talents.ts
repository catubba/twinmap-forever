// The talent trees of the player's own game, for the Talents panel (M20-F12): made once for each build beside the map
// (talents.json, by tiles-worker.ts), in the game's language. Forever's trees are the game's traits (TraitNode, where each
// talent sits; TraitNodeEntry, its ranks; TraitDefinition, its spell; TraitEdge, the arrows), not the old table Talent: one
// tree for each class, its three tabs side by side 4000 apart, each four columns and seven rows 600 apart. The class of a
// tree is that of the skill lines most of each tab's spells come under (SkillLineAbility, SkillLine, SkillRaceClassInfo); a
// tab's name and picture are those of the old table TalentTab for that class and place, as the game's window words them
// ("Shadow", where the skill line says "Shadow Magic"), else the skill line's. Names and pictures of the talents from
// SpellName and SpellMisc, or the definition's own.
// Nodes the game moved out of the grid (far below or to the right) are old ones it no longer shows: left out.
import { readTable, type Table } from './wdc5'

export const TALENTS_FILE = 'talents.json'
/** A file of another format was made by another app: made again. */
export const TALENTS_FORMAT = 1

const TRAIT_NODE = 4420297, TRAIT_NODE_ENTRY = 4420298, NODE_X_ENTRY = 4420304, TRAIT_EDGE = 4420308, TRAIT_DEFINITION = 4420327
const SKILL_LINE = 1240935, SKILL_LINE_ABILITY = 1266278, SKILL_RACE_CLASS = 1240406, SPELL_NAME = 1990283, SPELL_MISC = 1003144
const TALENT_TAB = 2178102
// TraitNode: tree, x, y. TraitNodeXTraitNodeEntry: node, entry. TraitNodeEntry: definition, most ranks. TraitEdge: from, to.
// TraitDefinition: its own name (text 0), number, spell, its own picture. SkillLine: name (text 0), id, category, picture.
// SkillLineAbility: line, spell. SkillRaceClassInfo (by line): classes. SpellMisc (by spell): picture. TalentTab: name (text 0),
// place among the class's tabs, classes, picture.
const NODE_TREE = 1, NODE_X = 2, NODE_Y = 3, NXE_NODE = 1, NXE_ENTRY = 2, ENTRY_DEFINITION = 1, ENTRY_MOST = 2
const EDGE_FROM = 2, EDGE_TO = 3, DEF_ID = 3, DEF_SPELL = 4, DEF_ICON = 5
const SL_ID = 5, SL_CATEGORY = 6, SL_ICON = 7, CLASS_LINE = 7, SLA_LINE = 3, SLA_SPELL = 4, SRC_CLASSES = 1, ICON = 10
const TAB_ORDER = 3, TAB_CLASSES = 5, TAB_ICON = 7
const TAB = 4000, STEP = 600, COLUMNS = 4, ROWS = 7

/** A talent: its node (as the addon sends it), tab (0 to 2), row (0 to 6), column (0 to 3), most ranks, name, picture's file. */
export type TalentFact = [number, number, number, number, number, string, number]
/** A tree: the classes it is for (mask, 1 << class number - 1); its tabs (name, picture's file); talents; arrows (from, to). */
export type TreeFact = { classes: number; tabs: [string, number][]; talents: TalentFact[]; arrows: [number, number][] }

export interface TalentFacts {
  format: number
  /** By the game's number of the tree. */
  trees: Record<string, TreeFact>
}

type Files = { read(id: number, skipHidden?: boolean): Buffer | null; opens(keyName: string): boolean }

/** What the player's game says of its talent trees; null without its tables. */
export function talentFacts(files: Files): TalentFacts | null {
  const read = (id: number, texts: number[] = []): Table | null => {
    const b = files.read(id, true)
    return b && readTable(b, (keyName) => files.opens(keyName), texts)
  }
  const [nodes, links, entryRows, edges, definitions, lineRows, sla, lineClasses, names, misc, oldTabs] = [
    read(TRAIT_NODE), read(NODE_X_ENTRY), read(TRAIT_NODE_ENTRY), read(TRAIT_EDGE), read(TRAIT_DEFINITION, [0, 1, 2]),
    read(SKILL_LINE, [0, 1, 2, 3, 4]), read(SKILL_LINE_ABILITY), read(SKILL_RACE_CLASS), read(SPELL_NAME), read(SPELL_MISC), read(TALENT_TAB, [0, 1]),
  ]
  if (!nodes || !links || !entryRows || !edges || !definitions || !lineRows || !sla || !lineClasses || !names || !misc) return null
  const text = (r: Table['rows'][number], field: number): string => {
    try {
      return r.text(field)
    } catch {
      return ''
    }
  }
  const name = new Map(names.rows.map((r) => [r.id, text(r, 0)]))
  const icon = new Map(misc.rows.filter((r) => r.parent !== undefined).map((r) => [r.parent!, r.int(ICON)]))
  const entries = new Map(entryRows.rows.map((r) => [r.id, r]))
  const definition = new Map(definitions.rows.map((r) => [r.int(DEF_ID) || r.id, r]))
  const entryOf = new Map<number, number>()
  for (const r of links.rows) if (!entryOf.has(r.int(NXE_NODE))) entryOf.set(r.int(NXE_NODE), r.int(NXE_ENTRY))
  const lines = new Map(lineRows.rows.filter((r) => r.int(SL_CATEGORY) === CLASS_LINE).map((r) => [r.int(SL_ID) || r.id, r]))
  const linesOf = new Map<number, number[]>()
  for (const r of sla.rows) if (lines.has(r.int(SLA_LINE))) (linesOf.get(r.int(SLA_SPELL)) ?? linesOf.set(r.int(SLA_SPELL), []).get(r.int(SLA_SPELL))!).push(r.int(SLA_LINE))
  const classesOf = new Map<number, number>()
  for (const r of lineClasses.rows) if (r.parent !== undefined) classesOf.set(r.parent, (classesOf.get(r.parent) ?? 0) | r.int(SRC_CLASSES))

  const byTree = new Map<number, Table['rows']>()
  for (const r of nodes.rows) (byTree.get(r.int(NODE_TREE)) ?? byTree.set(r.int(NODE_TREE), []).get(r.int(NODE_TREE))!).push(r)
  const trees: TalentFacts['trees'] = {}
  for (const [tree, rows] of byTree) {
    const left = Math.min(...rows.map((r) => r.int(NODE_X))), top = Math.min(...rows.map((r) => r.int(NODE_Y)))
    const talents: TalentFact[] = [], votes: Map<number, number>[] = [new Map(), new Map(), new Map()], spells: number[] = []
    for (const r of rows) {
      const x = r.int(NODE_X) - left, tab = Math.round(x / TAB), column = Math.round((x - tab * TAB) / STEP), row = Math.round((r.int(NODE_Y) - top) / STEP)
      const entry = entries.get(entryOf.get(r.id) ?? 0), d = entry && definition.get(entry.int(ENTRY_DEFINITION))
      if (!d || tab > 2 || column < 0 || column >= COLUMNS || row >= ROWS) continue
      const spell = d.int(DEF_SPELL), own = text(d, 0)
      talents.push([r.id, tab, row, column, entry.int(ENTRY_MOST), own || name.get(spell) || '', d.int(DEF_ICON) || icon.get(spell) || 0])
      for (const l of linesOf.get(spell) ?? []) votes[tab]!.set(l, (votes[tab]!.get(l) ?? 0) + 1)
      spells.push(spell)
    }
    // Trees with no class line (a pet's, those of nobody) are not a class's.
    const tabLines = votes.map((v) => [...v].sort((a, b) => b[1] - a[1])[0]?.[0])
    if (tabLines.some((l) => l === undefined) || talents.length < 3 * COLUMNS) continue
    const classes = tabLines.reduce((m, l) => m | (classesOf.get(l!) ?? 0), 0)
    const oldTab = (i: number): Table['rows'][number] | undefined => oldTabs?.rows.find((r) => r.int(TAB_CLASSES) === classes && r.int(TAB_ORDER) === i)
    const kept = new Set(talents.map((t) => t[0]))
    talents.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[3] - b[3])
    trees[tree] = {
      classes,
      tabs: tabLines.map((l, i) => {
        const old = oldTab(i)
        return [(old && text(old, 0)) || text(lines.get(l!)!, 0), (old && old.int(TAB_ICON)) || lines.get(l!)!.int(SL_ICON)]
      }),
      talents,
      arrows: edges.rows.filter((e) => kept.has(e.int(EDGE_FROM)) && kept.has(e.int(EDGE_TO))).map((e) => [e.int(EDGE_FROM), e.int(EDGE_TO)]),
    }
  }
  return { format: TALENTS_FORMAT, trees }
}

/** A talent as the panel draws it: where it sits, its ranks and those taken. */
export type Talent = { node: number; row: number; column: number; most: number; rank: number; name: string; icon: number }
export type Tab = { name: string; icon: number; spent: number; talents: Talent[]; arrows: [Talent, Talent][] }

/** The tree of a character from its sheet's piece talents ({ free, t: [[node, rank, spell], ...] }) and its class's number:
 * the tree the nodes taken are in, else the class's; undefined when the game's files have none. */
export function treeOf(piece: unknown, classId: number | undefined, facts: TalentFacts): { tabs: Tab[]; free: number; spent: number } | undefined {
  const p = (typeof piece === 'object' && piece ? piece : {}) as { free?: unknown; t?: unknown }
  const taken = new Map<number, number>()
  for (const e of Array.isArray(p.t) ? p.t : []) if (Array.isArray(e) && typeof e[0] === 'number' && typeof e[1] === 'number' && e[1] > 0) taken.set(e[0], e[1])
  const all = Object.values(facts.trees)
  const tree = all.find((t) => t.talents.some((n) => taken.has(n[0]))) ?? (classId ? all.find((t) => t.classes & (1 << (classId - 1))) : undefined)
  if (!tree) return undefined
  const tabs: Tab[] = tree.tabs.map(([name, icon]) => ({ name, icon, spent: 0, talents: [], arrows: [] }))
  const byNode = new Map<number, [Talent, Tab]>()
  for (const [node, tab, row, column, most, name, icon] of tree.talents) {
    const rank = Math.min(taken.get(node) ?? 0, most), on = tabs[tab]!, talent = { node, row, column, most, rank, name, icon }
    on.talents.push(talent)
    on.spent += rank
    byNode.set(node, [talent, on])
  }
  for (const [from, to] of tree.arrows) {
    const a = byNode.get(from), b = byNode.get(to)
    if (a && b && a[1] === b[1]) a[1].arrows.push([a[0], b[0]])
  }
  const free = typeof p.free === 'number' && p.free > 0 ? p.free : 0
  return { tabs, free, spent: tabs.reduce((s, t) => s + t.spent, 0) }
}

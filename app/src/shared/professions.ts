// The professions of a character, for the Professions panel (M20-F10): from its sheet (Sheet.lua: the pieces skills and
// recipes) and the game's spells (spells.ts). A profession is a skill line of the professions or secondary skills that has
// no parent; its recipes are the abilities of its line whose skill-ups go to a child line. The recipes not known are shown
// only for a profession whose window the addon saw open: that window lists them all, learned or not.
import { LINE, type SpellFacts } from './spells'

/** A recipe's colour in the game's window: orange, yellow, green, grey; known only. */
export type Difficulty = 'optimal' | 'medium' | 'easy' | 'trivial'

export interface Recipe {
  spell: number
  name: string
  /** The item it makes, 0 none: its picture and quality are the recipe's. */
  item: number
  /** The spell's picture, for a recipe that makes no item. */
  icon: number
  difficulty: Difficulty
  /** The skill it turns yellow at, for the order of the window: 0 for none. */
  yellow: number
}

export interface Profession {
  line: number
  name: string
  icon: number
  rank: number
  most: number
  /** Cooking, First Aid, Fishing. */
  secondary: boolean
  /** Whether the game has recipes for it at all: Herbalism and Skinning have none. */
  crafts: boolean
  /** Whether its window was seen open: without, the recipes not known are not there and the known ones may be few. */
  seen: boolean
  known: Recipe[]
  /** Those its window lists that the character has not learned. */
  unknown: Recipe[]
}

/** The colour of a recipe at a skill, as the game gives it: yellow from `yellow`, green half way to `grey`, grey from it. */
export function difficulty(rank: number, yellow: number, grey: number): Difficulty {
  if (!grey) return 'trivial'
  if (rank >= grey) return 'trivial'
  if (rank >= Math.floor((yellow + grey) / 2)) return 'easy'
  return rank >= yellow ? 'medium' : 'optimal'
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const ids = (v: unknown): Set<number> => new Set(list(v).filter((n): n is number => Number.isInteger(n)))

/** The character's professions, primary first. Known recipes the hardest first (those that still raise the skill on top),
 * the others the nearest first: by the skill they turn yellow at, then by name. */
export function professionsOf(pieces: Record<string, unknown>, facts: SpellFacts): Profession[] {
  const recipes = (pieces.recipes ?? {}) as { known?: unknown; seen?: unknown }
  const known = ids(recipes.known), seen = ids(recipes.seen)
  const out: Profession[] = []
  for (const s of list(pieces.skills)) {
    const [line, rank, most] = list(s) as number[]
    const fact = facts.lines[line!]
    if (!fact || fact[3] || (fact[2] !== LINE.professions && fact[2] !== LINE.secondary)) continue
    // A spell the game lists twice for the line is one recipe.
    const all = (facts.abilities[line!] ?? []).filter((a, i, list) => a[3] && list.findIndex((b) => b[0] === a[0]) === i)
    const recipe = (a: (typeof all)[number]): Recipe => ({
      spell: a[0],
      name: facts.spells[a[0]]?.[0] ?? '',
      item: facts.makes[a[0]] ?? 0,
      icon: facts.spells[a[0]]?.[2] ?? 0,
      difficulty: difficulty(rank ?? 0, a[1], a[2]),
      yellow: a[1],
    })
    const order = (a: Recipe, b: Recipe): number => a.yellow - b.yellow || a.name.localeCompare(b.name)
    out.push({
      line: line!,
      name: fact[0],
      icon: fact[1],
      rank: rank ?? 0,
      most: most ?? 0,
      secondary: fact[2] === LINE.secondary,
      crafts: all.length > 0,
      seen: seen.has(line!),
      known: all.filter((a) => known.has(a[0])).map(recipe).sort((a, b) => b.yellow - a.yellow || a.name.localeCompare(b.name)),
      unknown: seen.has(line!) ? all.filter((a) => !known.has(a[0])).map(recipe).sort(order) : [],
    })
  }
  return out.sort((a, b) => Number(a.secondary) - Number(b.secondary) || a.name.localeCompare(b.name))
}

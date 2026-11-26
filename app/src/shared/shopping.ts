// The shopping list (M10-F4, preview design/vendors/mockup/shopping.html): for one character, what it wants to make or to
// have, worked out against its bags and bank. The parts whose recipe it knows are broken down into what they take; what
// is still short is missing, what it has enough of is ready. Recipes are the game's own (trainers.json, `crafts`).
// The lists are kept for every screen with the route and My pins (shared/kept.ts).
import type { Holder } from './tips'

/** Something wanted: an item and how many; by a recipe (its spell) when one was chosen. */
export interface Goal {
  item: number
  n: number
  spell?: number
}

/** By the character's full name. */
export type ShoppingLists = Record<string, Goal[]>

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0

/** The lists as a file or a screen gives them, checked: what is not readable was never on a list. */
export function shoppingFrom(text: string | null): ShoppingLists {
  let read: unknown = null
  try {
    read = JSON.parse(text ?? 'null')
  } catch {
    // nothing readable
  }
  const out: ShoppingLists = {}
  if (typeof read !== 'object' || read === null || Array.isArray(read)) return out
  for (const [key, list] of Object.entries(read)) {
    const goals = (Array.isArray(list) ? list : []).flatMap((g: Partial<Goal> | null): Goal[] =>
      g && isCount(g.item) && isCount(g.n) ? [{ item: g.item, n: g.n, ...(isCount(g.spell) && { spell: g.spell }) }] : [],
    )
    if (goals.length) out[key] = goals
  }
  return out
}

const same = (g: Goal, item: number, spell?: number): boolean => g.item === item && g.spell === spell

/** The lists with one more of something on a character's list: a new goal of 1, or one more of a goal already there. */
export function addTo(lists: ShoppingLists, key: string, item: number, spell?: number): ShoppingLists {
  const list = lists[key] ?? []
  const had = list.find((g) => same(g, item, spell))
  return { ...lists, [key]: had ? list.map((g) => (g === had ? { ...g, n: g.n + 1 } : g)) : [...list, { item, n: 1, ...(spell && { spell }) }] }
}

/** The lists with a goal set to n; at 0 it leaves the list, and an empty list leaves the lists. */
export function setGoal(lists: ShoppingLists, key: string, goal: Goal, n: number): ShoppingLists {
  const list = (lists[key] ?? []).flatMap((g) => (same(g, goal.item, goal.spell) ? (n > 0 ? [{ ...g, n }] : []) : [g]))
  const { [key]: _, ...rest } = lists
  return list.length ? { ...rest, [key]: list } : rest
}

/** A recipe as trainers.json keeps it: skill line, item, how many it makes, then item and count of each it takes. */
export interface Recipe {
  spell: number
  line: number
  item: number
  makes: number
  takes: [number, number][]
}

export const recipeOf = (crafts: Record<string, number[]>, spell: number): Recipe | null => {
  const c = crafts[spell]
  if (!c || c.length < 5) return null
  const takes: [number, number][] = []
  for (let i = 3; i + 1 < c.length; i += 2) takes.push([c[i]!, c[i + 1]!])
  return { spell, line: c[0]!, item: c[1]!, makes: c[2]!, takes }
}

/** The recipes that make each item. */
export function recipesByItem(crafts: Record<string, number[]>): Map<number, Recipe[]> {
  const out = new Map<number, Recipe[]>()
  for (const spell of Object.keys(crafts)) {
    const r = recipeOf(crafts, Number(spell))
    if (r) out.set(r.item, [...(out.get(r.item) ?? []), r])
  }
  return out
}

/** A line of the list: an item, how many are needed in all, how many the character has in bags and bank. */
export interface Need {
  item: number
  need: number
  bags: number
  bank: number
}

/** One to make first: how many to make, by which recipe the character knows. */
export interface Part extends Need {
  make: number
  recipe: Recipe
}

export interface Plan {
  first: Part[]
  missing: Need[]
  ready: Need[]
}

/**
 * The list worked out: what the goals take (a goal by recipe takes its reagents, one without is wanted as it is), and
 * then, for what is short and has a recipe the character knows, what that takes, a few levels down. held: what the
 * character has of an item.
 */
export function planOf(goals: Goal[], crafts: Record<string, number[]>, known: Set<number>, held: (item: number) => { bags: number; bank: number }): Plan {
  const byItem = recipesByItem(crafts)
  const knownFor = (item: number): Recipe | undefined => byItem.get(item)?.find((r) => known.has(r.spell))
  const have = (item: number): number => {
    const h = held(item)
    return h.bags + h.bank
  }
  // An item made, through recipes the character knows, out of itself: Lesser and Greater essences, the transmutes. Such
  // an item is made only while none of what it takes is being made already, so the loop is broken once and stays so.
  const loops = (item: number): boolean => {
    const seen = new Set<number>(), stack = (knownFor(item)?.takes ?? []).map(([i]) => i)
    while (stack.length) {
      const at = stack.pop()!
      if (at === item) return true
      if (seen.has(at)) continue
      seen.add(at)
      for (const [i] of knownFor(at)?.takes ?? []) stack.push(i)
    }
    return false
  }
  const takes = (need: Map<number, number>, recipe: Recipe, times: number): void => {
    for (const [item, n] of recipe.takes) need.set(item, (need.get(item) ?? 0) + n * times)
  }
  // Worked out again until what is made stops changing: an item may be both wanted and a part of something made.
  let make = new Map<number, number>(), need = new Map<number, number>()
  for (let round = 0; round < 6; round++) {
    need = new Map()
    for (const g of goals) {
      const recipe = g.spell ? recipeOf(crafts, g.spell) : null
      if (recipe) takes(need, recipe, Math.ceil(g.n / recipe.makes))
      else need.set(g.item, (need.get(g.item) ?? 0) + g.n)
    }
    for (const [item, n] of make) takes(need, knownFor(item)!, Math.ceil(n / knownFor(item)!.makes))
    const next = new Map<number, number>()
    for (const [item, n] of need) {
      const recipe = knownFor(item)
      if (n > have(item) && recipe && !(loops(item) && recipe.takes.some(([i]) => next.has(i)))) next.set(item, n - have(item))
    }
    if (JSON.stringify([...next]) === JSON.stringify([...make])) break
    make = next
  }
  const plan: Plan = { first: [], missing: [], ready: [] }
  for (const [item, n] of need) {
    const line = { item, need: n, ...held(item) }
    if (make.has(item)) plan.first.push({ ...line, make: make.get(item)!, recipe: knownFor(item)! })
    else (n > have(item) ? plan.missing : plan.ready).push(line)
  }
  return plan
}

/** What a character holds of an item, from who holds it (shared/tips.ts, holdersOf). */
export const heldBy = (holders: Holder[], key: string): { bags: number; bank: number } => {
  const h = holders.find((x) => x.key === key)
  return { bags: h?.bags ?? 0, bank: h?.bank ?? 0 }
}

import { expect, test } from 'vitest'
import { addTo, planOf, setGoal, shoppingFrom } from './shopping'

// The recipes of the preview, as the game has them: Azure Silk Vest (3859) 5 Bolt of Silk Cloth, 4 Blue Dye; Black Mageweave
// Vest (12048) 3 Silken Thread, 2 Bolt of Mageweave; Bolt of Silk Cloth (3839) 4 Silk Cloth; Bolt of Mageweave (3865) 5
// Mageweave Cloth; Rough Dynamite (3919) makes 2 from Rough Blasting Powder and Linen Cloth.
const CRAFTS: Record<string, number[]> = {
  3859: [197, 4324, 1, 4305, 5, 6260, 4],
  12048: [197, 9998, 1, 4291, 3, 4339, 2],
  3839: [197, 4305, 1, 4306, 4],
  3865: [197, 4339, 1, 4338, 5],
  3919: [202, 4358, 2, 4357, 1, 2589, 1],
}
// Staliot's bags and bank: Silk Cloth 45 in the bank, Mageweave Cloth 17 and 278.
const HELD: Record<number, { bags: number; bank: number }> = { 4306: { bags: 0, bank: 45 }, 4338: { bags: 17, bank: 278 } }
const held = (item: number): { bags: number; bank: number } => HELD[item] ?? { bags: 0, bank: 0 }
const KNOWN = new Set([3859, 3839])

test('what a recipe takes: the parts known are made first, what is short is missing, the rest ready', () => {
  const plan = planOf([{ item: 4324, n: 1, spell: 3859 }, { item: 9998, n: 1, spell: 12048 }], CRAFTS, KNOWN, held)
  expect(plan.first.map((p) => [p.item, p.make, p.recipe.spell])).toEqual([[4305, 5, 3839]])
  expect(plan.missing.map((m) => [m.item, m.need])).toEqual([[6260, 4], [4291, 3], [4339, 2]]) // Bolt of Mageweave: its recipe not known
  expect(plan.ready).toEqual([{ item: 4306, need: 20, bags: 0, bank: 45 }])
})

test('what is held counts before anything is made, and a recipe that makes two needs half the times', () => {
  const some = (item: number): { bags: number; bank: number } => (item === 4305 ? { bags: 2, bank: 0 } : held(item))
  expect(planOf([{ item: 4324, n: 2, spell: 3859 }], CRAFTS, KNOWN, some).first).toMatchObject([{ item: 4305, need: 10, make: 8 }])
  expect(planOf([{ item: 4358, n: 5, spell: 3919 }], CRAFTS, KNOWN, held).missing.map((m) => [m.item, m.need])).toEqual([[4357, 3], [2589, 3]])
  // An item wanted as it is, with a recipe known: made from what it takes.
  expect(planOf([{ item: 4305, n: 3 }], CRAFTS, KNOWN, held)).toMatchObject({ first: [{ item: 4305, make: 3 }], ready: [{ item: 4306, need: 12 }] })
})

// Enchanting's essences, made out of each other: Greater Magic Essence (13361) from 3 Lesser, Lesser Magic Essence (13362)
// 3 from 1 Greater; a rod (7421) that takes 2 Greater.
const ESSENCES: Record<string, number[]> = { 13361: [333, 10939, 1, 10938, 3], 13362: [333, 10938, 3, 10939, 1], 7421: [333, 6218, 1, 10939, 2] }
const ENCHANTER = new Set([13361, 13362, 7421])

test('items made out of each other: the loop is broken once, what it takes in the end is missing or ready', () => {
  const none = (): { bags: number; bank: number } => ({ bags: 0, bank: 0 })
  const plan = planOf([{ item: 6218, n: 1, spell: 7421 }], ESSENCES, ENCHANTER, none)
  expect(plan.first.map((p) => [p.item, p.make])).toEqual([[10939, 2]])
  expect(plan.missing.map((m) => [m.item, m.need])).toEqual([[10938, 6]])
  const lesser = (item: number): { bags: number; bank: number } => (item === 10938 ? { bags: 6, bank: 0 } : none())
  expect(planOf([{ item: 6218, n: 1, spell: 7421 }], ESSENCES, ENCHANTER, lesser)).toMatchObject({ first: [{ item: 10939, make: 2 }], missing: [], ready: [{ item: 10938, need: 6 }] })
  // Both wanted as they are: the one first on the list is made, the other is not made out of it.
  expect(planOf([{ item: 10939, n: 1 }, { item: 10938, n: 3 }], ESSENCES, ENCHANTER, none).first.map((p) => p.item)).toEqual([10939])
})

test('a goal comes once and grows by one; at 0 it leaves, and an empty list with it', () => {
  let lists = addTo({}, 'Staliot Falsaperla', 4324, 3859)
  lists = addTo(lists, 'Staliot Falsaperla', 4324, 3859)
  lists = addTo(lists, 'Staliot Falsaperla', 4291)
  expect(lists).toEqual({ 'Staliot Falsaperla': [{ item: 4324, n: 2, spell: 3859 }, { item: 4291, n: 1 }] })
  lists = setGoal(lists, 'Staliot Falsaperla', { item: 4324, n: 2, spell: 3859 }, 0)
  expect(setGoal(lists, 'Staliot Falsaperla', { item: 4291, n: 1 }, 0)).toEqual({})
  expect(shoppingFrom(JSON.stringify({ A: [{ item: 1, n: 2 }, { item: 'x', n: 1 }, { item: 3, n: 0 }], B: 'junk' }))).toEqual({ A: [{ item: 1, n: 2 }] })
  expect(shoppingFrom(null)).toEqual({})
})

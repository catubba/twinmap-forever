import { expect, test } from 'vitest'
import { gridsOf, itemMatches, wornOf, WORN_LEFT, WORN_RIGHT, WORN_WEAPONS, type ItemFacts } from './items'
import type { Sheet } from './sheet'

const sheet = (pieces: Record<string, unknown>): Sheet => ({ code: 'c', rev: 1, pieces, at: {} })

test('the worn items by slot, with the durability of what wears; every slot of the game once in the window', () => {
  const worn = wornOf(sheet({ gear: [[1, 7050, 45, 45], [4, 3342], [9, 273808, 25, 30], [0, 0], 'bad'] }))
  expect([...worn]).toEqual([[1, { item: 7050, now: 45, most: 45 }], [4, { item: 3342 }], [9, { item: 273808, now: 25, most: 30 }]])
  const slots = [...WORN_LEFT, ...WORN_RIGHT, ...WORN_WEAPONS].map(([s]) => s).sort((a, b) => a - b)
  expect(slots).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
})

test('the backpack and the bags are one grid, packed in the game order, the free slots at the end; reagent bag, keyring and bank apart', () => {
  const g = gridsOf(sheet({
    bags: [
      { b: 1, n: 4, s: [[3, 30, 2]] },
      { b: 0, n: 3, s: [[2, 20, 1], [1, 10, 5]] },
      { b: 5, n: 2, s: [[1, 50, 3]] },
      { b: -1, n: 32, s: [] },
    ],
    // An older addon put the keyring in the bank: left out.
    bank: [{ b: -1, n: 32, s: [] }, { b: 7, n: 2, s: [[2, 70, 1]] }, { b: 6, n: 3, s: [[1, 60, 9]] }],
  }))
  expect(g.bags).toEqual({ cells: [{ item: 10, n: 5 }, { item: 20, n: 1 }, { item: 30, n: 2 }, null, null, null, null], used: 3, slots: 7 })
  expect(g.reagents).toEqual({ cells: [{ item: 50, n: 3 }, null], used: 1, slots: 2 })
  expect(g.keyring.slots).toBe(32)
  expect(g.keyring.used).toBe(0)
  expect(g.bank).toEqual({ cells: [{ item: 60, n: 9 }, { item: 70, n: 1 }, null, null, null], used: 2, slots: 5 })
  expect(gridsOf(sheet({})).bags).toEqual({ cells: [], used: 0, slots: 0 })
})

test('an item matches the filter by its name or its type', () => {
  const facts: ItemFacts = { 2592: ['Wool Cloth', 1, 33, 7, 5, 135, 1, 0], 273808: ['Bridgebreaker Bindings', 3, 1022, 4, 1, 5113, 1, 0] }
  expect(itemMatches(2592, facts, '')).toBe(true)
  expect(itemMatches(2592, facts, 'wool')).toBe(true)
  expect(itemMatches(273808, facts, 'armor cloth')).toBe(true)
  expect(itemMatches(2592, facts, 'armor')).toBe(false)
  expect(itemMatches(1, facts, 'item 1')).toBe(true)
})

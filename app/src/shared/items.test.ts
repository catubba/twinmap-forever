import { expect, test } from 'vitest'
import { coins, filterRows, itemRows, othersHolding, shopRows, sortRows, type Column, type ItemFacts } from './items'
import type { Sheet } from './sheet'

const FACTS: ItemFacts = {
  858: ['Lesser Healing Potion', 1, 25, 0, 1, 100, 1, 0],
  2589: ['Linen Cloth', 1, 13, 7, 5, 0, 1, 0],
  4373: ['Shadow Goggles', 2, 722, 4, 1, 0, 1, 0],
  5396: ['Key to Searing Gorge', 1, 0, 13, 0, 0, 1, 0],
  159: ['Refreshing Spring Water', 1, 1, 0, 5, 25, 5, 0],
  21815: ['Love Token', 1, 0, 15, 0, 10, 10, 335],
}
const sheet = (pieces: Record<string, unknown>): Sheet => ({ code: 'c', rev: 1, pieces, at: {} })
const CATUBBIO = sheet({
  bags: [
    { b: 0, n: 16, s: [[1, 858, 5], [2, 858, 4], [3, 2589, 20]] },
    { b: 1, n: 6, s: [[1, 858, 5], [2, 99999, 1]] },
    { b: -1, n: 4, s: [[1, 5396, 1]] },
  ],
  bank: [{ b: 6, n: 48, s: [[7, 2589, 35]] }],
  gear: [[1, 4373, 30, 40]],
})

test('stacks of an item add up in each place; keyring, bank and what is worn are places of their own', () => {
  expect(itemRows(CATUBBIO, FACTS).map((r) => [r.place, r.name, r.n, r.value, r.type])).toEqual([
    ['Bags', 'Lesser Healing Potion', 14, 14 * 25, 'Consumable'],
    ['Bags', 'Linen Cloth', 20, 20 * 13, 'Trade Goods'],
    ['Bags', 'Item 99999', 1, 0, 'Other'],
    ['Keyring', 'Key to Searing Gorge', 1, 0, 'Key'],
    ['Bank', 'Linen Cloth', 35, 35 * 13, 'Trade Goods'],
    ['Worn', 'Shadow Goggles', 1, 722, 'Armor · Cloth'],
  ])
})

test('every column sorts both ways', () => {
  const rows = itemRows(CATUBBIO, FACTS)
  const first: Record<Column, [string, string]> = {
    name: ['Item 99999', 'Shadow Goggles'],
    type: ['Shadow Goggles', 'Linen Cloth'],
    place: ['Item 99999', 'Shadow Goggles'],
    n: ['Item 99999', 'Linen Cloth'],
    value: ['Item 99999', 'Shadow Goggles'],
  }
  for (const [column, [up, down]] of Object.entries(first) as [Column, [string, string]][]) {
    expect([sortRows(rows, column, true)[0]!.name, sortRows(rows, column, false)[0]!.name], column).toEqual([up, down])
  }
})

test('the filter looks at name and type, every word', () => {
  const rows = itemRows(CATUBBIO, FACTS)
  expect(filterRows(rows, 'linen').length).toBe(2)
  expect(filterRows(rows, 'cloth').map((r) => r.name)).toEqual(['Linen Cloth', 'Linen Cloth', 'Shadow Goggles'])
  expect(filterRows(rows, 'armor goggles').map((r) => r.name)).toEqual(['Shadow Goggles'])
})

test('the other characters holding what is typed, the one shown left out', () => {
  const sheets = { 'Catubbio Sucameli': CATUBBIO, 'Brunilde Ferrozampa': sheet({ bank: [{ b: 6, n: 48, s: [[1, 2589, 60]] }] }), 'Ottavio Malvento': sheet({}) }
  expect(othersHolding(sheets, 'Catubbio Sucameli', FACTS, 'linen').map((o) => [o.key, o.rows.map((r) => [r.place, r.n])])).toEqual([['Brunilde Ferrozampa', [['Bank', 60]]]])
  expect(othersHolding(sheets, 'Catubbio Sucameli', FACTS, ' ')).toEqual([])
})

test('copper as coins', () => {
  expect(coins(107605)).toEqual([[10, 'g'], [76, 's'], [5, 'c']])
  expect(coins(500)).toEqual([[5, 's']])
})

test('a vendor sells by name, at its price for so many; what the game has no row of has no price; holiday goods are left out', () => {
  expect(shopRows([159, 21815, 858, 240024], FACTS)).toEqual([
    { id: 240024, name: 'Item 240024', quality: 1, buy: null, perBuy: 1 },
    { id: 858, name: 'Lesser Healing Potion', quality: 1, buy: 100, perBuy: 1 },
    { id: 159, name: 'Refreshing Spring Water', quality: 1, buy: 25, perBuy: 5 },
  ])
})

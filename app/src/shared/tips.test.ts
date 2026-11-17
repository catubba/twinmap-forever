import { expect, test } from 'vitest'
import type { Sheet } from './sheet'
import { holdersOf, shownLines, tipKey, tipsFrom } from './tips'

test('the tooltips sent are taken as they are; a line or a key of another shape is left out', () => {
  expect(
    tipsFrom({
      'item:159': [['Refreshing Spring Water', ''], ['Use: Restores 151 mana over 18 sec.', '00ff00']],
      'item:1155::::::853:1234567': [['Rod of the Sleepwalker of the Eagle', '1eff00'], ['Two-Hand', '', 'Staff', '']],
      'item:2': [[5, ''], ['ok', 'red'], 'line'],
      spell: [['x', '']],
    }),
  ).toEqual({
    'item:159': [['Refreshing Spring Water', ''], ['Use: Restores 151 mana over 18 sec.', '00ff00']],
    'item:1155::::::853:1234567': [['Rod of the Sleepwalker of the Eagle', '1eff00'], ['Two-Hand', '', 'Staff', '']],
  })
  expect(tipsFrom([])).toEqual({})
  expect(tipsFrom(null)).toEqual({})
})

test("an item's key is the one the sheet carries, or its number; the durability shown is today's", () => {
  expect(tipKey(1155, 'item:1155::::::853:1234567')).toBe('item:1155::::::853:1234567')
  expect(tipKey(1155, undefined)).toBe('item:1155')
  expect(tipKey(1155, 'item:99')).toBe('item:1155')
  const lines = tipsFrom({ 'item:1': [['Staff', ''], ['Durability 90 / 100', '']] })['item:1']!
  expect(shownLines(lines, { now: 12, most: 100 })).toEqual([['Staff', ''], ['Durability 12 / 100', '']])
  expect(shownLines(lines)).toBe(lines)
})

test('who holds an item: bags with the keyring and the reagent bag, the bank (6 and after), what is worn', () => {
  const sheet = (pieces: Record<string, unknown>): Sheet => ({ code: 'c', rev: 1, pieces, at: {} })
  const sheets = {
    'Catubbio Sucameli': sheet({ bags: [{ b: 0, n: 4, s: [[1, 858, 5], [2, 858, 5]] }, { b: 5, n: 2, s: [[1, 858, 3]] }], bank: [{ b: -1, n: 32, s: [[1, 858, 9]] }, { b: 6, n: 2, s: [[1, 858, 2]] }], gear: [[16, 1155, 90, 100]] }),
    'Brunilde Ferrozampa': sheet({ bags: [], bank: [{ b: 6, n: 1, s: [[1, 858, 4]] }] }),
    'Ottavio Malvento': sheet({ bags: [{ b: 0, n: 1, s: [[1, 159, 1]] }] }),
  }
  expect(holdersOf(sheets, 858)).toEqual([
    { key: 'Catubbio Sucameli', bags: 13, bank: 2, worn: 0 },
    { key: 'Brunilde Ferrozampa', bags: 0, bank: 4, worn: 0 },
  ])
  expect(holdersOf(sheets, 1155)).toEqual([{ key: 'Catubbio Sucameli', bags: 0, bank: 0, worn: 1 }])
})

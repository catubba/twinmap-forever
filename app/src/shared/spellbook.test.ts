import { expect, test } from 'vitest'
import { bookOf } from './spellbook'
import { SPELLS_FORMAT, type SpellFacts } from './spells'

const facts: SpellFacts = {
  format: SPELLS_FORMAT,
  spells: { 6603: ['Attack', '', 1, 1], 81: ['Dodge', 'Passive', 2, 1], 1293657: ['Languages', '', 3, 1], 686: ['Shadow Bolt', 'Rank 1', 4, 32], 695: ['Shadow Bolt', 'Rank 2', 4, 32], 705: ['Shadow Bolt', 'Rank 3', 4, 32], 348: ['Immolate', 'Rank 1', 5, 4] },
  lines: {},
  abilities: {},
  makes: {},
}

test("the book's tabs in its order, the highest rank of each spell where the spell stands, the passive ones last", () => {
  const book = [
    ['General', 136830, [6603], [81, 1293657]],
    ['Destruction', 136186, [348, 686, 695, 705, 999999], []],
    ['Pet', 0, [['Attack', 'Pet Command', 7], ['Lash of Pain', 'Rank 2', 8]], [['Avoidance', '', 9]]],
  ]
  const tabs = bookOf({ book }, facts)
  expect(tabs.map((t) => [t.name, t.icon])).toEqual([['General', 136830], ['Destruction', 136186], ['Pet', 7]])
  expect(tabs[0]!.spells.map((s) => [s.name, s.passive])).toEqual([['Attack', false], ['Dodge', true], ['Languages', true]])
  // A spell the files do not name (999999) is left out.
  expect(tabs[1]!.spells.map((s) => [s.spell, s.rank])).toEqual([[348, 'Rank 1'], [705, 'Rank 3']])
  expect(tabs[2]!.spells).toEqual([
    { spell: 0, name: 'Attack', rank: 'Pet Command', icon: 7, passive: false },
    { spell: 0, name: 'Lash of Pain', rank: 'Rank 2', icon: 8, passive: false },
    { spell: 0, name: 'Avoidance', rank: '', icon: 9, passive: true },
  ])
})

test('no book from an addon before it, or none sent: no tabs', () => {
  expect(bookOf({ spells: [686] }, facts)).toEqual([])
  expect(bookOf({ book: [] }, facts)).toEqual([])
  expect(bookOf({ book: [['General', 1, [], []], 'x'] }, facts)).toEqual([])
})

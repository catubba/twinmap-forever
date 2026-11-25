import { expect, test } from 'vitest'
import type { Sheet } from './sheet'
import { GAP, holdersOf, piecesOf, shownLines, talentLines, tipKey, tipsFrom } from './tips'

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
  // In the game's language, and only the line of the item's most: another "n / m" stays.
  const russian = tipsFrom({ 'item:1': [['Посох', ''], ['Прочность: 90 / 100', ''], ['Комплект 1 / 5', '']] })['item:1']!
  expect(shownLines(russian, { now: 12, most: 100 })).toEqual([['Посох', ''], ['Прочность: 12 / 100', ''], ['Комплект 1 / 5', '']])
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

test('a line with colours inside is cut in pieces of one colour; pictures go, a link keeps its words', () => {
  expect(piecesOf('|cff00ff00<Made by Catubbio Sucameli>|r', '')).toEqual([{ text: '<Made by Catubbio Sucameli>', color: '00ff00' }])
  expect(piecesOf('Requires |cffFF2020Engineering (50)|r now', 'ffd200')).toEqual([
    { text: 'Requires ', color: 'ffd200' },
    { text: 'Engineering (50)', color: 'ff2020' },
    { text: ' now', color: 'ffd200' },
  ])
  expect(piecesOf('|TInterface\Icons\coin:0|t 5 a || b |Hitem:1|h[Bolt]|h', '')).toEqual([{ text: ' 5 a | b [Bolt]', color: '' }])
  expect(piecesOf('Plain', '')).toEqual([{ text: 'Plain', color: '' }])
})

test("the tooltips of spells and talents are the character's own: kept under its name; without one they are not taken", () => {
  const sent = { 'spell:709': [['Drain Life', '', 'Rank 3', '']], 'talent:105918:2': [['Passive', '']], 'item:159': [['Water', '']] }
  expect(Object.keys(tipsFrom(sent, 'Catubbio Sucameli'))).toEqual(['spell:709@Catubbio Sucameli', 'talent:105918:2@Catubbio Sucameli', 'item:159'])
  expect(Object.keys(tipsFrom(sent))).toEqual(['item:159'])
  // As the file keeps them, read back.
  expect(Object.keys(tipsFrom({ 'spell:709@Catubbio Sucameli': [['Drain Life', '']] }))).toEqual(['spell:709@Catubbio Sucameli'])
})

test("a talent's popup as the game's window: its rank, the next under its heading, what it still asks in red", () => {
  const who = 'Catubbio Sucameli'
  const tips = tipsFrom({ 'talent:105918:2': [['Passive', ''], ['47% chance', 'ffd200']], 'talent:105918:3': [['Passive', ''], ['70% chance', 'ffd200']], 'talent:105909:1': [['Channeled', '']] }, who)
  const words = { rank: 'Rank 2/3', next: 'Next Rank:' }
  expect(talentLines(tips, who, { node: 105918, name: 'Fel Concentration', rank: 2, most: 3 }, words)).toEqual([
    ['Fel Concentration', ''], ['Rank 2/3', ''], GAP, ['Passive', ''], ['47% chance', 'ffd200'], GAP, ['Next Rank:', ''], ['Passive', ''], ['70% chance', 'ffd200'],
  ])
  expect(talentLines(tips, who, { node: 105909, name: 'Wrack', rank: 0, most: 1 }, { rank: 'Rank 0/1', next: 'Next Rank:', need: 'Spend 6 more points in Affliction Talents' })).toEqual([
    ['Wrack', ''], ['Rank 0/1', ''], GAP, ['Channeled', ''], GAP, ['Spend 6 more points in Affliction Talents', 'ff2020'],
  ])
  expect(talentLines(tips, 'Padre Gaetano', { node: 105909, name: 'Wrack', rank: 0, most: 1 }, { rank: 'Rank 0/1', next: '' })).toEqual([['Wrack', ''], ['Rank 0/1', '']])
})

test('a new line of the game ("|n") is a new line', () => {
  expect(piecesOf('Reagents: |nSoul Shard', '')).toEqual([{ text: 'Reagents: \nSoul Shard', color: '' }])
})

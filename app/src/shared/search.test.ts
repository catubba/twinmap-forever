import { expect, test } from 'vitest'
import { best, fold, rank, wordsMatch } from './search'

test('a name is ranked by where what was typed is in it', () => {
  expect(rank('thelsamar', 'thel')).toBe(0)
  expect(rank('innkeeper hearthstove', 'hearth')).toBe(1)
  expect(rank('stormwind city', 'wind')).toBe(2)
  expect(rank('ironforge', 'storm')).toBeNull()
})

test('the best names first: the start, then a word, then anywhere; the shorter before the longer', () => {
  const names = ['Mountain Silversage', 'Silverleaf', 'Silver Vein', 'Quicksilver', 'Ooze Covered Silver Vein', 'Copper Vein', 'WANTED: "Hogger"', "Khadgar's Whisker"].map((name) => ({ name, lower: fold(name) }))
  expect(best(names, ' SILVER ', 10).map((n) => n.name)).toEqual(['Silverleaf', 'Silver Vein', 'Mountain Silversage', 'Ooze Covered Silver Vein', 'Quicksilver'])
  expect(best(names, 'silver', 2).map((n) => n.name)).toEqual(['Silverleaf', 'Silver Vein'])
  // Punctuation and capitals do not matter, on either side.
  expect(best(names, 'wanted: hogger', 10).map((n) => n.name)).toEqual(['WANTED: "Hogger"'])
  expect(best(names, 'Wanted Hog', 10).map((n) => n.name)).toEqual(['WANTED: "Hogger"'])
  expect(best(names, 'khadgars', 10).map((n) => n.name)).toEqual(["Khadgar's Whisker"])
  expect(best(names, "khadgar's w", 10).map((n) => n.name)).toEqual(["Khadgar's Whisker"])
  expect(best(names, '', 10)).toEqual([])
  expect(best(names, ' : ', 10)).toEqual([])
  expect(best(names, 'gold', 10)).toEqual([])
})

test('what one does is matched word by word, each from its start, in any order', () => {
  expect(wordsMatch('first aid trainer', 'first aid')).toBe(true)
  expect(wordsMatch('first aid trainer', 'train fir')).toBe(true)
  expect(wordsMatch('first aid trainer', 'aid')).toBe(true)
  expect(wordsMatch('first aid trainer', 'irst')).toBe(false)
  expect(wordsMatch('first aid trainer', 'first cooking')).toBe(false)
})

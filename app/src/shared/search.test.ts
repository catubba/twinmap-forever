import { expect, test } from 'vitest'
import { best, dungeonsOf, fold, rank, wordsMatch } from './search'

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

test('the dungeons behind the doors, with the wings of the ones that share a map', () => {
  const found = dungeonsOf([
    { continent: 0, x: 10, y: 20, names: ['Deadmines'], maps: [36] },
    { continent: 1, x: 30, y: 40, names: ["Ruins of Ahn'Qiraj", "Ahn'Qiraj Temple"], maps: [509, 531], raid: true },
    { continent: 0, x: 50, y: 60, names: ['Scarlet Monastery'], maps: [189] },
    { continent: 0, x: 1, y: 1, names: ['An old door'] }, // a file of an older format: no maps
  ])
  expect(found.map((d) => [d.name, d.id, d.raid, d.wing ?? ''])).toEqual([
    ['Deadmines', 36, false, ''],
    ["Ruins of Ahn'Qiraj", 509, true, ''],
    ["Ahn'Qiraj Temple", 531, true, ''],
    ['Scarlet Monastery', 189, false, ''],
    ['Scarlet Monastery: Armory', 189, false, 'Scarlet Monastery: Armory'],
    ['Scarlet Monastery: Cathedral', 189, false, 'Scarlet Monastery: Cathedral'],
    ['Scarlet Monastery: Graveyard', 189, false, 'Scarlet Monastery: Graveyard'],
    ['Scarlet Monastery: Library', 189, false, 'Scarlet Monastery: Library'],
  ])
  expect(found[1]).toMatchObject({ continent: 1, at: { x: 30, y: 40 } })
})

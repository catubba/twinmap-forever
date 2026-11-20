import { expect, test } from 'vitest'
import { COMPANION_COLOURS, coloursFor, GROUP_STALE, groupFrom } from './group'

test('the companions are read from the section, with or without a place', () => {
  const section = { list: [{ n: 'Staliot Falsaperla', c: 'MAGE', m: 1434, x: 48.47, y: 9.57 }, { n: 'Inside', c: 'PRIEST', r: 'H' }, { n: 'Half', m: 1434, x: 3, r: 'X' }] }
  expect(groupFrom(section)).toEqual([{ name: 'Staliot Falsaperla', cls: 'MAGE', map: 1434, x: 48.47, y: 9.57 }, { name: 'Inside', cls: 'PRIEST', role: 'H' }, { name: 'Half' }])
})

test('what is not a group gives no one, and neither does a group too old', () => {
  expect(groupFrom(undefined)).toEqual([])
  expect(groupFrom({ list: 'x' })).toEqual([])
  expect(groupFrom({ list: [null, 5, { c: 'MAGE' }, { n: '' }] })).toEqual([])
  expect(groupFrom({ list: [{ n: 'A' }] }, GROUP_STALE + 1)).toEqual([])
  expect(groupFrom({ list: [{ n: 'A' }] }, GROUP_STALE)).toEqual([{ name: 'A' }])
})

test('a companion is in the colour of their class, as in the game', () => {
  const colours = coloursFor([{ name: 'Carlo', cls: 'WARRIOR' }, { name: 'Piero', cls: 'PALADIN' }, { name: 'Anna' }])
  expect(colours.get('Carlo')).toBe('#c79c6e')
  expect(colours.get('Piero')).toBe('#f58cba')
  expect(colours.get('Anna')).toBe(COMPANION_COLOURS[0])
  // A class told late wins over the colour given while it was missing.
  expect(coloursFor([{ name: 'Anna', cls: 'MAGE' }], colours).get('Anna')).toBe('#69ccf0')
})

const named = (names: string[]): { name: string }[] => names.map((name) => ({ name }))

test('a companion with no class has a colour of their own, and keeps it as others come and go', () => {
  const four = coloursFor(named(['Anna', 'Bruno', 'Carla', 'Dino']))
  expect(new Set(four.values()).size).toBe(4)
  // Bruno leaves, Elsa joins: the three who stay keep theirs, Elsa has one none of them has.
  const after = coloursFor(named(['Anna', 'Carla', 'Dino', 'Elsa']), four)
  for (const name of ['Anna', 'Carla', 'Dino']) expect(after.get(name)).toBe(four.get(name))
  expect(new Set(after.values()).size).toBe(4)
  expect(after.has('Bruno')).toBe(false)
  // A raid has more companions than colours: everyone has one all the same.
  const raid = coloursFor(named(Array.from({ length: 12 }, (_, i) => `R${i}`)))
  expect([...raid.values()].every((c) => (COMPANION_COLOURS as readonly string[]).includes(c))).toBe(true)
})

test('a companion inside a dungeon has the instance and the yards their Twinmap told, and no zone', () => {
  expect(groupFrom({ list: [{ n: 'Anna', c: 'MAGE', i: 34, wx: 120, wy: -45.5, l: 1 }, { n: 'Bruno', i: 34 }] })).toEqual([
    { name: 'Anna', cls: 'MAGE', inst: 34, wx: 120, wy: -45.5 },
    { name: 'Bruno' },
  ])
})

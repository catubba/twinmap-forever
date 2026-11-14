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

test('each companion has a colour of their own, and keeps it as others come and go', () => {
  const four = coloursFor(['Anna', 'Bruno', 'Carla', 'Dino'])
  expect(new Set(four.values()).size).toBe(4)
  // Bruno leaves, Elsa joins: the three who stay keep theirs, Elsa has one none of them has.
  const after = coloursFor(['Anna', 'Carla', 'Dino', 'Elsa'], four)
  for (const name of ['Anna', 'Carla', 'Dino']) expect(after.get(name)).toBe(four.get(name))
  expect(new Set(after.values()).size).toBe(4)
  expect(after.has('Bruno')).toBe(false)
  // A raid has more companions than colours: everyone has one all the same.
  const raid = coloursFor(Array.from({ length: 12 }, (_, i) => `R${i}`))
  expect([...raid.values()].every((c) => (COMPANION_COLOURS as readonly string[]).includes(c))).toBe(true)
})

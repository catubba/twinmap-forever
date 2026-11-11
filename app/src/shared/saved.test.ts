import { expect, test } from 'vitest'
import { MAX_PINS, removePin, renamePin, savedAt, savedFrom, savePin, type SavedPin } from './saved'

const pin = (name: string, x: number, continent: 0 | 1 = 0): SavedPin => ({ name, continent, at: { x, y: 2 }, pin: { m: 1429, x: 40, y: 60 } })
const five = (): SavedPin[] => ['Inn', 'Mine', 'Tower', 'Farm', 'Dock'].reduce((pins, name, i) => savePin(pins, pin(name, i)), [] as SavedPin[])

test('five pins come back from what was saved as they were, and anything else gives none', () => {
  const pins = five()
  expect(savedFrom(JSON.stringify(pins))).toEqual(pins)
  expect(savedFrom(null)).toEqual([])
  expect(savedFrom('{"stops":[]}')).toEqual([])
  expect(savedFrom(JSON.stringify([pin('Good', 1), { name: 'no place' }, 7])).map((p) => p.name)).toEqual(['Good'])
  expect(savedFrom(JSON.stringify(Array.from({ length: MAX_PINS + 40 }, (_, i) => pin('p' + i, i)))).length, 'more than the route holds, up to its own limit').toBe(MAX_PINS)
})

test('a point is saved once, found again by its place, renamed and removed', () => {
  const pins = five()
  expect(savePin(pins, pin('Inn again', 0)), 'the same point').toBe(pins)
  expect(savedAt(pins, 0, { x: 2, y: 2 })).toBe(2)
  expect(savedAt(pins, 1, { x: 2, y: 2 }), 'the other continent').toBe(-1)
  expect(savePin([], pin('   ', 1))[0]!.name).toBe('Pin')
  expect(renamePin(pins, 2, '  Tower of Ilgalar ').map((p) => p.name)).toEqual(['Inn', 'Mine', 'Tower of Ilgalar', 'Farm', 'Dock'])
  expect(renamePin(pins, 2, '   '), 'no name').toBe(pins)
  expect(renamePin(pins, 9, 'x')).toBe(pins)
  expect(renamePin(pins, 0, 'x'.repeat(100))[0]!.name.length).toBe(60)
  expect(removePin(pins, 1).map((p) => p.name)).toEqual(['Inn', 'Tower', 'Farm', 'Dock'])
  expect(removePin(pins, 9)).toBe(pins)
})

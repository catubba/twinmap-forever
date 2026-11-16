import { expect, test } from 'vitest'
import type { GameMap } from './maps'
import { MAX_PINS, pinOfMark, removePin, renamePin, savedAt, savedFrom, savePin, yardsBetween, type SavedPin } from './saved'

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

test('a mark set in the game is the same point on our map, named by its zone; set on the continent, it is told by the zone under it', () => {
  const map = (id: number, name: string, level: string, rect: GameMap['rect'], continent: 0 | null = 0): GameMap => ({ id, name, parent: 0, level, continent, rect, area: 0 }) as GameMap
  const maps = [map(1415, 'Eastern Kingdoms', 'continent', { minX: -10000, maxX: 10000, minY: -10000, maxY: 10000 }), map(1429, 'Elwynn Forest', 'zone', { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 }), map(947, 'Azeroth', 'world', null, null)]
  const inZone = pinOfMark(maps, { m: 1429, x: 25, y: 50, name: 'told by the game' })!
  expect(inZone.name).toBe('Elwynn Forest 25.0, 50.0')
  expect(inZone.continent).toBe(0)
  expect(inZone.pin!.m).toBe(1429)
  expect(inZone.pin!.x).toBeCloseTo(25, 6)
  expect(inZone.pin!.y).toBeCloseTo(50, 6)
  // The middle of the continent is the middle of the zone.
  const onContinent = pinOfMark(maps, { m: 1415, x: 50, y: 50, name: 'Eastern Kingdoms 50.0, 50.0' })!
  expect(onContinent.name).toBe('Elwynn Forest 50.0, 50.0')
  expect(onContinent.at.x).toBeCloseTo(pinOfMark(maps, { m: 1429, x: 50, y: 50, name: '' })!.at.x, 6)
  // Outside every zone the point is kept, under the name the game gave it, with no place the game could mark again.
  expect(pinOfMark(maps, { m: 1415, x: 5, y: 5, name: 'Eastern Kingdoms 5.0, 5.0' })).toMatchObject({ name: 'Eastern Kingdoms 5.0, 5.0', pin: null })
  expect(pinOfMark(maps, { m: 947, x: 5, y: 5, name: 'no continent' })).toBeNull()
  expect(pinOfMark(maps, { m: 7, x: 5, y: 5, name: 'no such map' })).toBeNull()
})

test('a temporary pin is kept as such, saved for good by Save, and its yards are counted on the map', () => {
  const temp: SavedPin = { ...pin('Elwynn Forest 40.0, 60.0', 7), temp: true }
  const pins = savePin(five(), temp)
  expect(savedFrom(JSON.stringify(pins)).at(-1)).toEqual(temp)
  expect(savePin(pins, { ...temp, temp: true }), 'set again in the game').toBe(pins)
  const kept = savePin(pins, pin('Another name', 7))
  expect(kept.at(-1), 'its own name, and no longer temporary').toEqual(pin('Elwynn Forest 40.0, 60.0', 7))
  expect(savePin(kept, temp), 'a saved pin set again in the game stays saved').toBe(kept)
  expect(yardsBetween({ x: 0, y: 0 }, { x: 3, y: 4 }), 'a map unit is a quarter of a block of 533 yards').toBeCloseTo(666.67, 1)
})

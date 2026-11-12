import { expect, test } from 'vitest'
import { ahead, walkAskFrom } from './walk'

test('what is left of a way starts at the place on it nearest to the character', () => {
  const way = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
  expect(ahead(way, { x: 4, y: 0 })).toEqual({ rest: [{ x: 4, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], off: 0 })
  expect(ahead(way, { x: 10, y: 6 }).rest).toEqual([{ x: 10, y: 6 }, { x: 10, y: 10 }])
  // A unit of the map is 133 yards: a character a tenth of a unit off the way is 13 yards from it.
  expect(ahead(way, { x: 4, y: 0.1 }).off).toBeCloseTo(13.33, 1)
  expect(ahead([], { x: 1, y: 1 })).toEqual({ rest: [], off: 0 })
})

test('what the window asks is checked', () => {
  expect(walkAskFrom({ continent: 1, from: { x: 1, y: 2 }, to: { x: 3, y: 4, more: 5 } })).toEqual({ continent: 1, from: { x: 1, y: 2 }, to: { x: 3, y: 4 } })
  expect(walkAskFrom({ continent: 2, from: { x: 1, y: 2 }, to: { x: 3, y: 4 } })).toBeNull()
  expect(walkAskFrom({ continent: 0, from: { x: NaN, y: 2 }, to: { x: 3, y: 4 } })).toBeNull()
  expect(walkAskFrom('a way')).toBeNull()
})

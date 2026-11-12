import { expect, test } from 'vitest'
import { ahead, farAskFrom, nearestOnFoot, walkAskFrom } from './walk'

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

test('what the window asks for many ends is checked', () => {
  expect(farAskFrom({ continent: 0, from: { x: 1, y: 2 }, to: [{ x: 3, y: 4, more: 5 }], reach: 900 })).toEqual({ continent: 0, from: { x: 1, y: 2 }, to: [{ x: 3, y: 4 }], reach: 900 })
  expect(farAskFrom({ continent: 0, from: { x: 1, y: 2 }, to: [{ x: 3 }], reach: 900 })).toBeNull()
  expect(farAskFrom({ continent: 0, from: { x: 1, y: 2 }, to: [], reach: 0 })).toBeNull()
  expect(farAskFrom({ continent: 0, from: { x: 1, y: 2 }, to: Array.from({ length: 201 }, () => ({ x: 1, y: 1 })), reach: 900 }), 'too many ends').toBeNull()
})

test('the nearest on foot come first, and those with no way known after them, as the crow flies', () => {
  const rows = [{ n: 'over the wall', foot: 600, crow: 100 }, { n: 'inside', foot: 150, crow: 140 }, { n: 'past the reach', crow: 90 }, { n: 'further past it', crow: 300 }]
  const order = (list: typeof rows): string[] => nearestOnFoot(list, (r) => r.foot, (r) => r.crow).map((r) => r.n)
  expect(order(rows)).toEqual(['inside', 'over the wall', 'past the reach', 'further past it'])
  expect(order(rows.map(({ n, crow }) => ({ n, crow, foot: undefined as unknown as number }))), 'no answer yet').toEqual(['past the reach', 'over the wall', 'inside', 'further past it'])
})

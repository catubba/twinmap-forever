import { expect, test } from 'vitest'
import { unitsOfPlace, unitsOfRect, unitsOfWorld } from './geo'

// Elwynn Forest, as the game's tables give it.
const ELWYNN = { minX: -10254.2, minY: -1935.4, maxX: -7939.6, maxY: 1535.4 }

test('the middle of the world is the middle of the map, and north and west are up and left', () => {
  expect(unitsOfWorld(0, 0)).toEqual({ x: 128, y: 128 })
  // One block (533.33 yards) north and west: four units up and left.
  const p = unitsOfWorld(1600 / 3, 1600 / 3)
  expect([p.x, p.y].map((v) => +v.toFixed(6))).toEqual([124, 124])
})

test('a place in percent of a zone lands inside the rectangle of the zone', () => {
  const [topLeft, bottomRight] = unitsOfRect(ELWYNN)
  expect(topLeft.x).toBeLessThan(bottomRight.x)
  expect(topLeft.y).toBeLessThan(bottomRight.y)
  // The inn of Goldshire, 42.1 65.9 on the map of Elwynn: world -9465, 74 or so.
  const inn = unitsOfPlace(ELWYNN, 42.1, 65.9)
  expect(inn.x).toBeCloseTo(topLeft.x + 0.421 * (bottomRight.x - topLeft.x), 6)
  expect(inn.y).toBeCloseTo(topLeft.y + 0.659 * (bottomRight.y - topLeft.y), 6)
  // In blocks: column 32 - 74 / 533.33, row 32 + 9465 / 533.33. The block of Goldshire is 31, 49.
  expect([Math.floor(inn.x / 4), Math.floor(inn.y / 4)]).toEqual([31, 49])
})

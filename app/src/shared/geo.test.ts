import { expect, test } from 'vitest'
import { unitsOfPlace, unitsOfRect, unitsOfWorld, clearOf, gathered } from './geo'

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

test('points that lie close are gathered into one, in their middle; the far ones stay alone', () => {
  const town = [{ x: 10, y: 10, n: 'a' }, { x: 12, y: 10, n: 'b' }, { x: 11, y: 13, n: 'c' }], far = { x: 40, y: 10, n: 'd' }
  const groups = gathered([...town, far], 5)
  expect(groups.map((g) => g.of.map((p) => p.n).join(''))).toEqual(['abc', 'd'])
  expect(groups[0]).toMatchObject({ x: 11, y: 11 })
  expect(groups[1]).toMatchObject({ x: 40, y: 10 })
  // With no reach nothing is gathered, and nothing is lost.
  expect(gathered([...town, far], 0).map((g) => g.of.length)).toEqual([1, 1, 1, 1])
  expect(gathered([], 5)).toEqual([])
})

test('a pin that stands for several moves off what it would lie on, and no farther than it takes', () => {
  const far = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y)
  expect(clearOf({ x: 10, y: 10 }, [{ x: 40, y: 40 }], 5), 'nothing near: where it was').toEqual({ x: 10, y: 10 })
  const moved = clearOf({ x: 12, y: 10 }, [{ x: 10, y: 10 }], 5)
  expect(moved.x).toBeCloseTo(15)
  expect(moved.y).toBeCloseTo(10)
  expect(clearOf({ x: 10, y: 10 }, [{ x: 10, y: 10 }], 5), 'right on it: to the east').toEqual({ x: 15, y: 10 })
  // Between two: clear of both.
  const others = [{ x: 10, y: 10 }, { x: 16, y: 10 }], between = clearOf({ x: 12, y: 11 }, others, 5)
  for (const o of others) expect(far(between, o)).toBeGreaterThanOrEqual(5 - 1e-6)
})

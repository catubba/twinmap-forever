import { expect, test } from 'vitest'
import { onShow, type Placed } from './buildings'

// a city, a house near it, a house far away, a castle past what the view shows: seen from 1,000 yards over the city
const list: Placed = { format: 4, placed: [['city', 0, 0, 0, 0, 1, 0], ['house', 50, 0, 0, 0, 1, 0], ['house', 0, 0, 4000, 0, 1, 0], ['castle', 0, 0, 9000, 0, 1, 0]], radius: { city: 500, house: 20, castle: 200 } }
const camera = { x: 0, y: 1000, z: 0 }, show = (shown: number[] = [], bytes: Record<string, number> = {}, roof = 1e9): number[] => onShow(list, camera, { x: 0, z: 0 }, 5000, 1000, (i) => shown.includes(i), (f) => bytes[f] ?? 0, roof).map(([i]) => i)

test('the buildings on show: wide enough on the view, on the ground it shows, the widest first', () => {
  // the near house is 20 px, the far one 4.9: its picture on the ground is enough; the castle would be 22
  expect(show()).toEqual([0, 1])
})

test('a building on show stays a little smaller than it came', () => {
  const far = { ...list, placed: list.placed.map((p, i) => (i === 2 ? (['house', 0, 0, 1300, 0, 1, 0] as Placed['placed'][0]) : p)) } // 12.2 px
  const at = (shown: number[]): number[] => onShow(far, camera, { x: 0, z: 0 }, 5000, 1000, (i) => shown.includes(i), () => 0, 1e9).map(([i]) => i)
  expect(at([])).toEqual([0, 1])
  expect(at([2])).toEqual([0, 1, 2])
})

test('under the roof the smallest are left out, a file counted once', () => {
  expect(show([], { city: 60, house: 50 }, 100)).toEqual([0])
  expect(show([], { city: 60, house: 40 }, 100)).toEqual([0, 1])
})

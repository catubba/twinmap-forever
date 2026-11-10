import { expect, test } from 'vitest'
import { addFix, BEHIND, PERIOD, whereAt, type Fix } from './glide'

const told = (fixes: Fix[]): Fix[] => fixes.reduce(addFix, [] as Fix[])

test('a steady run is shown at a steady speed, however unevenly the readings come', () => {
  // Ten yards a second, told at uneven moments.
  const way = told([0, 230, 520, 750, 1010].map((at) => ({ at, x: at / 100, y: 0 })))
  for (let time = 0; time <= 1010; time += 16) expect(whereAt(way, time).x).toBeCloseTo(time / 100, 5)
  expect(whereAt(way, 1010)).toEqual({ x: 10.1, y: 0, arrived: true })
})

test('a start from still takes one period, not the silence before it', () => {
  const way = told([{ at: 0, x: 5, y: 5 }, { at: 9000, x: 6, y: 5 }])
  expect(whereAt(way, 9000 - PERIOD).x).toBe(5)
  expect(whereAt(way, 9000 - PERIOD / 2).x).toBeCloseTo(5.5)
  expect(whereAt(way, 9000).arrived).toBe(true)
})

test('the same place told again changes nothing, and the way does not grow without end', () => {
  const one = told([{ at: 0, x: 1, y: 1 }])
  expect(addFix(one, { at: 100, x: 1, y: 1 })).toBe(one)
  expect(told(Array.from({ length: 50 }, (_, i) => ({ at: i * PERIOD, x: i, y: 0 }))).length).toBeLessThanOrEqual(8)
})

test('the arrow is behind by more than a period, so the next reading is there when it is needed', () => {
  expect(BEHIND).toBeGreaterThan(PERIOD)
})

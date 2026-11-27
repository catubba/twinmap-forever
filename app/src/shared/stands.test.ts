import { expect, test } from 'vitest'
import { standsOf, type Over } from './stands'

// 60 x 60 cells: a city 20 x 20 whose streets are the base surface at 30, over ground flat at 0; the land round it rolls
const W = 60, at = (x: number, y: number): number => y * W + x
const land = (cell: number): number => {
  const x = cell % W, y = Math.floor(cell / W)
  return x >= 10 && x < 30 && y >= 10 && y < 30 ? 0 : Math.sin(x) + Math.cos(y * 1.3)
}
function world(): Map<number, Over> {
  const over = new Map<number, Over>()
  for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) over.set(at(x, y), { base: 30, floors: [] })
  return over
}

test('in a city on its own floor things stand on the streets', () => {
  const stands = standsOf(W, world(), land)
  expect(stands.get(at(20, 20))).toBe(30)
  expect(stands.get(at(45, 45))).toBeUndefined()
})

test('a cell with no base surface takes the floor nearest to the streets round it, one with nothing stands as they do', () => {
  const over = world()
  over.set(at(20, 20), { base: null, floors: [12, 31, 45] }) // a cellar, a shop, the room over it
  over.delete(at(15, 15)) // a roof
  const stands = standsOf(W, over, land)
  expect(stands.get(at(20, 20))).toBe(31)
  expect(stands.get(at(15, 15))).toBeCloseTo(30, 1)
})

test('the flat floor under a city is the city as far as it goes, the land beside it is not', () => {
  // a cathedral 12 x 8 where the grid took the ground for the base surface: its nave a floor in half of the cells
  const over = world()
  for (let y = 16; y < 24; y++) for (let x = 14; x < 26; x++) (x + y) % 2 ? over.set(at(x, y), { base: null, floors: [31] }) : over.delete(at(x, y))
  // the floor goes on flat 5 cells past the streets to the east; the land past it rises
  const stands = standsOf(W, over, (cell) => (cell % W >= 30 && cell % W < 35 ? 0 : land(cell)))
  expect(Math.round(stands.get(at(20, 20))!)).toBeGreaterThanOrEqual(30) // as the streets and the nave round it
  expect(stands.get(at(21, 20))).toBe(31)
  expect(stands.get(at(33, 20))).toBeCloseTo(30, 0)
  expect(stands.get(at(40, 20))).toBeUndefined()
})

test('a slope, a narrow bridge and a lone tower are not a city', () => {
  const over = new Map<number, Over>()
  for (let x = 5; x < 55; x++) over.set(at(x, 10), { base: 5, floors: [] }) // a slope: its cells a little over the ground at their middle
  for (let x = 5; x < 55; x++) for (const y of [30, 31]) over.set(at(x, y), { base: 40, floors: [] }) // a bridge two cells wide
  over.set(at(30, 50), { base: 25, floors: [] })
  expect(standsOf(W, over, (cell) => Math.sin(cell % W) + Math.cos(Math.floor(cell / W) * 1.3)).size).toBe(0)
})

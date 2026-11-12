import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { navFrom } from '../shared/nav-data'
import { readAddonNav, shortestPathFolder, thin, walker, type Yards } from './walk'

const shipped = navFrom(readFileSync(join(__dirname, '..', '..', 'resources', 'nav', 'nav0.json'), 'utf8'))!
// Elwynn Forest as the game's tables have it: a percent of its map to yards north and west.
const ELWYNN = { minX: -10254.166015625, minY: -1935.4166259765625, maxX: -7939.5830078125, maxY: 1535.4166259765625 }
const elwynn = (px: number, py: number): Yards => [ELWYNN.maxX - (py / 100) * (ELWYNN.maxX - ELWYNN.minX), ELWYNN.maxY - (px / 100) * (ELWYNN.maxY - ELWYNN.minY)]
const crow = (a: Yards, b: Yards): number => Math.hypot(a[0] - b[0], a[1] - b[1])

test('from Goldshire to the door of Northshire Abbey the way goes round, by the road, and ends where asked', () => {
  const find = walker(shipped), from = elwynn(42.1, 65.9), to = elwynn(48.2, 42.9)
  const walk = find(from, to)!
  expect(walk.points[0]).toEqual(from)
  expect(walk.points.at(-1)).toEqual(to)
  expect(walk.yards).toBeGreaterThan(crow(from, to))
  expect(walk.yards).toBeLessThan(crow(from, to) * 1.6)
  // Thinned to its turns: far fewer points than cells walked, none a jump of more than a few hundred yards.
  expect(walk.points.length).toBeLessThan(walk.yards / 8 / 2)
  for (let i = 1; i < walk.points.length; i++) expect(crow(walk.points[i - 1]!, walk.points[i]!)).toBeLessThan(600)
})

test('out of Northshire Valley the way goes through the gate, not over the wall', () => {
  const find = walker(shipped), from = elwynn(45.5, 48.2), to = elwynn(42.1, 65.9)
  expect(find(from, to)!.yards).toBeGreaterThan(crow(from, to) * 1.15)
})

test('where nothing can be walked there is no way', () => {
  const find = walker(shipped)
  expect(find(elwynn(42.1, 65.9), [0, 30000])).toBeNull() // far out at sea
})

test('a line is thinned to its turns', () => {
  expect(thin([[0, 0], [1, 0.1], [2, 0], [3, 5], [4, 10]], 0.5)).toEqual([[0, 0], [2, 0], [4, 10]])
})

// The player's own Shortest Path Forever, when TWINMAP_GAME names a game folder that has it: the same reading as the shipped copy.
const INSTALLED = process.env.TWINMAP_GAME ? shortestPathFolder(process.env.TWINMAP_GAME) : ''
test.skipIf(!INSTALLED || !existsSync(INSTALLED))('the grid in the folder of Shortest Path Forever reads as the shipped one does', () => {
  const own = readAddonNav(INSTALLED, 0)!
  expect(own.format).toBe(shipped.format)
  expect(Object.keys(own.packed.grid).length).toBeGreaterThan(700)
  const there = walker(shipped)(elwynn(42.1, 65.9), elwynn(48.2, 42.9))!.yards
  expect(Math.abs(walker(own)(elwynn(42.1, 65.9), elwynn(48.2, 42.9))!.yards - there)).toBeLessThan(there * 0.2)
})

test('a folder with no Shortest Path Forever in it gives no grid', () => {
  expect(readAddonNav(join(__dirname, 'nowhere'), 0)).toBeNull()
})

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

// Places of Shortest Path Forever's own checks of its grid (tests/path_spec.lua), in yards of the world.
const GOLDSHIRE: Yards = [-9459, 43], NORTHSHIRE: Yards = [-8914, -135], STORMWIND_FLIGHT: Yards = [-8840.56, 489.7]

test('from one point to many in one search: behind the wall of Stormwind is further on foot than out in the forest', () => {
  const find = walker(shipped), forest: Yards = [-9459, -850], south: Yards = [-9900, 43]
  expect(crow(GOLDSHIRE, STORMWIND_FLIGHT), 'nearer as the crow flies').toBeLessThan(crow(GOLDSHIRE, forest))
  const [toForest, toStormwind, toNorthshire, atSea] = find.far(GOLDSHIRE, [forest, STORMWIND_FLIGHT, NORTHSHIRE, [0, 30000]], 1400)
  expect(toStormwind!, 'further on foot').toBeGreaterThan(toForest!)
  expect(toForest!).toBeGreaterThanOrEqual(Math.round(crow(GOLDSHIRE, forest)))
  expect(toNorthshire, 'the same way the search for one end finds').toBe(find(GOLDSHIRE, NORTHSHIRE)!.yards)
  expect(atSea).toBeNull()
  const [toSouth] = find.far(GOLDSHIRE, [south], 600)
  expect(find.far(GOLDSHIRE, [south, NORTHSHIRE], 600), 'not past the reach').toEqual([toSouth, null])
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

test('Stormwind is walked into by its gate, and the Dun Algaz road through its tunnel, a floor under the ridge', () => {
  const find = walker(shipped), passes = (points: Yards[], at: Yards): number => Math.min(...points.slice(1).map((b, i) => {
    const a = points[i]!, dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
    return Math.hypot(a[0] + t * dx - at[0], a[1] + t * dy - at[1])
  }))
  const town = find(GOLDSHIRE, STORMWIND_FLIGHT)!
  expect(town.yards).toBeGreaterThan(crow(GOLDSHIRE, STORMWIND_FLIGHT) * 1.3)
  expect(town.yards).toBeLessThan(1300)
  expect(passes(town.points, [-9068, 417]), 'by the gate').toBeLessThan(30)
  const south: Yards = [-4350.2, -2463.7], north: Yards = [-4087.6, -2463.7]
  for (const [a, b] of [[south, north], [north, south]] as const) expect(passes(find(a, b)!.points, [-4220, -2464]), 'through the tunnel').toBeLessThan(30)
  expect(find(NORTHSHIRE, GOLDSHIRE)!.yards).toBeLessThan(740) // Shortest Path finds 580 to 700, smoothed
})

test('a character followed through Fargodeep Mine is told the floor it stands on, under the hill', () => {
  // Walks taken step by step over the grid, so the height stood at is known; the tracker gets every second point.
  const find = walker(shipped)
  let seed = 11, right = 0, layered = 0, below = 0
  const random = (): number => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  for (let w = 0; w < 60; w++) {
    const track = find.track()
    const path = find.wander([-9900 + random() * 150, 50 + random() * 150], 300, random)
    for (let i = 0; i < path.length; i += 2) {
      const [at, z] = path[i]!, told = track(at)
      if (!told || told.over + told.under === 0) continue
      layered++
      if (Math.abs(told.z - z) <= 3) right++
      if (told.over > 0) below++
    }
  }
  expect(layered).toBeGreaterThan(200)
  expect(right / layered, `${right} of ${layered}`).toBeGreaterThan(0.9) // the bar of M16-F4; 95% in this run
  expect(below).toBeGreaterThan(0) // in the mine, the hill is over the character
})
